/**
 * Shared Authentication Database & Configuration Safeguards (Node.js Runtime).
 * Prevents orphaned user writes when session signing is unconfigured,
 * resolves department foreign keys safely, and maps PostgreSQL errors cleanly.
 */

import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { isSessionSigningConfigured } from "@/lib/auth/session";
import { logSecurityEvent } from "@/lib/security/logger";

export interface AuthErrorClassification {
  error: string;
  message: string;
  statusCode: number;
}

export function checkSessionSigningReady(context: {
  path: string;
  method: string;
  ip: string;
}): { ok: true } | ({ ok: false } & AuthErrorClassification) {
  if (isSessionSigningConfigured()) {
    return { ok: true };
  }

  logSecurityEvent({
    event: "MISCONFIGURED_AUTH_SECRET",
    severity: "CRITICAL",
    ip: context.ip,
    path: context.path,
    method: context.method,
    reason:
      "SESSION_SECRET (>= 32 chars) or valid CLERK_SECRET_KEY is not configured in production",
  });

  return {
    ok: false,
    error: "ServiceUnavailable",
    message:
      "Authentication service configuration is incomplete. Please contact an administrator.",
    statusCode: 503,
  };
}

/**
 * Resolves a valid department UUID in PostgreSQL before inserting a user.
 * Prevents foreign-key crashes when the departments table has not been seeded yet.
 */
export async function resolveSafeDepartmentId(
  preferredDepartmentId: string,
  strictRequested: boolean
): Promise<{ ok: true; departmentId: string | null } | { ok: false; message: string }> {
  const matched = await db
    .select({ id: schema.departments.id })
    .from(schema.departments)
    .where(eq(schema.departments.id, preferredDepartmentId))
    .limit(1);

  if (matched.length > 0) {
    return { ok: true, departmentId: matched[0].id };
  }

  if (strictRequested) {
    return { ok: false, message: "Selected department does not exist" };
  }

  const fallback = await db
    .select({ id: schema.departments.id })
    .from(schema.departments)
    .orderBy(asc(schema.departments.createdAt))
    .limit(1);

  return {
    ok: true,
    departmentId: fallback[0]?.id ?? null,
  };
}

export function extractPgErrorCode(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const e = err as { code?: unknown; cause?: { code?: unknown } };
  if (typeof e.code === "string" && e.code) return e.code;
  if (e.cause && typeof e.cause.code === "string" && e.cause.code) {
    return e.cause.code;
  }
  return null;
}

export function classifyAuthDbError(
  err: unknown,
  context: { path: string; method: string; ip: string; userId?: string | null }
): AuthErrorClassification | null {
  const code = extractPgErrorCode(err);
  const rawMessage = err instanceof Error ? err.message : String(err ?? "");

  if (code === "23505") {
    return {
      error: "AccountExists",
      message: "Unable to register with this email",
      statusCode: 409,
    };
  }

  if (code === "42703" || code === "42P01") {
    logSecurityEvent({
      event: "UNHANDLED_SERVER_ERROR",
      severity: "CRITICAL",
      userId: context.userId ?? null,
      ip: context.ip,
      path: context.path,
      method: context.method,
      reason: `PostgreSQL schema mismatch (${code}): run npm run db:push (${rawMessage})`,
    });
    return {
      error: "ServiceUnavailable",
      message: "Database setup is incomplete. Please contact an administrator.",
      statusCode: 503,
    };
  }

  if (code === "23503") {
    logSecurityEvent({
      event: "UNHANDLED_SERVER_ERROR",
      severity: "HIGH",
      userId: context.userId ?? null,
      ip: context.ip,
      path: context.path,
      method: context.method,
      reason: `PostgreSQL foreign-key violation (${code}): ${rawMessage}`,
    });
    return {
      error: "ServiceUnavailable",
      message: "Database reference setup is incomplete. Please contact an administrator.",
      statusCode: 503,
    };
  }

  if (
    code === "28P01" ||
    code === "28000" ||
    code === "ENOTFOUND" ||
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    rawMessage.includes("DATABASE_URL is not configured") ||
    rawMessage.includes("fetch failed")
  ) {
    logSecurityEvent({
      event: "UNHANDLED_SERVER_ERROR",
      severity: "CRITICAL",
      userId: context.userId ?? null,
      ip: context.ip,
      path: context.path,
      method: context.method,
      reason: `Database connectivity/configuration error (${code || "CONN"}): ${rawMessage}`,
    });
    return {
      error: "ServiceUnavailable",
      message: "Database service is temporarily unavailable.",
      statusCode: 503,
    };
  }

  return null;
}

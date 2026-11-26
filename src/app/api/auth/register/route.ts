import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withApiReliability, createErrorResponse } from "@/lib/http/api-handler";
import { registerSchema } from "@/lib/validators/auth.schema";
import { hashPassword } from "@/lib/auth/password";
import { attachSessionCookie, signSessionToken } from "@/lib/auth/session";
import { db, schema, mockDataStore } from "@/lib/db";
import { isDatabaseMocked } from "@/lib/mock/utils";
import { normalizeDepartmentUuid } from "@/lib/utils";
import { logSecurityEvent } from "@/lib/security/logger";
import { extractTrustedClientIp } from "@/lib/security/rate-limit";
import {
  checkSessionSigningReady,
  classifyAuthDbError,
  resolveSafeDepartmentId,
} from "@/lib/auth/db-auth-utils";

const DEFAULT_DEPT_UUID = "10000000-0000-0000-0000-000000000001";

export const POST = withApiReliability(async (req: NextRequest) => {
  const clientIp = extractTrustedClientIp(req);

  const signingReady = checkSessionSigningReady({
    path: "/api/auth/register",
    method: "POST",
    ip: clientIp,
  });
  if (!signingReady.ok) {
    return createErrorResponse(signingReady.error, signingReady.message, signingReady.statusCode);
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return createErrorResponse("ValidationError", "Request body must be valid JSON", 400);
  }

  const parsed = registerSchema.safeParse(rawBody);
  if (!parsed.success) {
    return createErrorResponse(
      "ValidationError",
      parsed.error.issues[0]?.message || "Invalid registration details",
      400
    );
  }

  const { name, email, password, departmentSlug } = parsed.data;
  let departmentId = DEFAULT_DEPT_UUID;
  if (departmentSlug) {
    try {
      departmentId = normalizeDepartmentUuid(departmentSlug);
    } catch {
      return createErrorResponse("ValidationError", "Invalid department selected", 400);
    }
  }

  const passwordHash = await hashPassword(password);

  if (isDatabaseMocked()) {
    const existing = mockDataStore.findUserByEmail(email);
    if (existing) {
      return createErrorResponse("AccountExists", "Unable to register with this email", 409);
    }
    const created = mockDataStore.createLocalUser({
      email,
      name,
      passwordHash,
      departmentId,
    });

    const token = await signSessionToken({
      sub: created.id,
      role: "EMPLOYEE",
      dept: departmentId,
      email: created.email,
      name: created.name,
      ver: created.sessionVersion ?? 1,
    });

    logSecurityEvent({
      event: "AUTH_REGISTER",
      severity: "INFO",
      userId: created.id,
      role: "EMPLOYEE",
      ip: clientIp,
      path: "/api/auth/register",
      method: "POST",
    });

    const res = NextResponse.json(
      {
        success: true,
        user: {
          id: created.id,
          name: created.name,
          email: created.email,
          role: "EMPLOYEE",
          departmentId,
        },
      },
      { status: 201 }
    );
    attachSessionCookie(res, token);
    return res;
  }

  // Live PostgreSQL path
  let created: {
    id: string;
    name: string;
    email: string;
    role: "EMPLOYEE" | "MANAGER" | "ADMIN";
    departmentId: string | null;
    sessionVersion: number;
  };

  try {
    const existing = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (existing.length > 0) {
      return createErrorResponse("AccountExists", "Unable to register with this email", 409);
    }

    const deptResolution = await resolveSafeDepartmentId(
      departmentId,
      Boolean(departmentSlug)
    );
    if (!deptResolution.ok) {
      return createErrorResponse("ValidationError", deptResolution.message, 400);
    }

    const inserted = await db
      .insert(schema.users)
      .values({
        clerkId: `local_${crypto.randomUUID()}`,
        email,
        name,
        passwordHash,
        sessionVersion: 1,
        role: "EMPLOYEE", // Least-privilege default on self-registration
        departmentId: deptResolution.departmentId,
      })
      .returning({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        role: schema.users.role,
        departmentId: schema.users.departmentId,
        sessionVersion: schema.users.sessionVersion,
      });

    if (!inserted[0]) {
      throw new Error("Failed to create user record");
    }
    created = inserted[0];
  } catch (err) {
    const classified = classifyAuthDbError(err, {
      path: "/api/auth/register",
      method: "POST",
      ip: clientIp,
    });
    if (classified) {
      return createErrorResponse(classified.error, classified.message, classified.statusCode);
    }
    throw err;
  }

  const token = await signSessionToken({
    sub: created.id,
    role: "EMPLOYEE",
    dept: created.departmentId || DEFAULT_DEPT_UUID,
    email: created.email,
    name: created.name,
    ver: created.sessionVersion,
  });

  logSecurityEvent({
    event: "AUTH_REGISTER",
    severity: "INFO",
    userId: created.id,
    role: "EMPLOYEE",
    ip: clientIp,
    path: "/api/auth/register",
    method: "POST",
  });

  const res = NextResponse.json(
    {
      success: true,
      user: {
        id: created.id,
        name: created.name,
        email: created.email,
        role: created.role,
        departmentId: created.departmentId || DEFAULT_DEPT_UUID,
      },
    },
    { status: 201 }
  );
  attachSessionCookie(res, token);
  return res;
});

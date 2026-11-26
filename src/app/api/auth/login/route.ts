import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withApiReliability, createErrorResponse } from "@/lib/http/api-handler";
import { loginSchema } from "@/lib/validators/auth.schema";
import { verifyPassword } from "@/lib/auth/password";
import { attachSessionCookie, signSessionToken, UserRole } from "@/lib/auth/session";
import { db, schema, mockDataStore } from "@/lib/db";
import { isDatabaseMocked } from "@/lib/mock/utils";
import { logSecurityEvent } from "@/lib/security/logger";
import { extractTrustedClientIp } from "@/lib/security/rate-limit";
import { checkSessionSigningReady, classifyAuthDbError } from "@/lib/auth/db-auth-utils";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_DEPT_UUID = "10000000-0000-0000-0000-000000000001";

export const POST = withApiReliability(async (req: NextRequest) => {
  const clientIp = extractTrustedClientIp(req);

  const signingReady = checkSessionSigningReady({
    path: "/api/auth/login",
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

  const parsed = loginSchema.safeParse(rawBody);
  if (!parsed.success) {
    return createErrorResponse(
      "ValidationError",
      parsed.error.issues[0]?.message || "Invalid login credentials format",
      400
    );
  }

  const { email, password } = parsed.data;
  const now = new Date();

  if (isDatabaseMocked()) {
    const user = mockDataStore.findUserByEmail(email);
    if (user?.lockedUntil && new Date(user.lockedUntil).getTime() > now.getTime()) {
      logSecurityEvent({
        event: "AUTH_LOCKOUT",
        severity: "HIGH",
        userId: user.id,
        ip: clientIp,
        path: "/api/auth/login",
        method: "POST",
        reason: "Account temporarily locked due to repeated failed logins",
      });
      return createErrorResponse(
        "AccountLocked",
        "Too many failed login attempts. Please try again in 15 minutes.",
        429
      );
    }

    const isMatch = await verifyPassword(password, user?.passwordHash ?? null);
    if (!user || !isMatch) {
      if (user) {
        const attempts = (user.failedLoginAttempts ?? 0) + 1;
        mockDataStore.updateUserAuth(user.id, {
          failedLoginAttempts: attempts,
          lockedUntil:
            attempts >= MAX_FAILED_ATTEMPTS
              ? new Date(now.getTime() + LOCKOUT_DURATION_MS)
              : null,
        });
      }
      logSecurityEvent({
        event: "AUTH_LOGIN_FAILURE",
        severity: "WARN",
        userId: user?.id ?? null,
        ip: clientIp,
        path: "/api/auth/login",
        method: "POST",
        reason: "Invalid email or password",
      });
      return createErrorResponse("InvalidCredentials", "Invalid email or password", 401);
    }

    mockDataStore.updateUserAuth(user.id, { failedLoginAttempts: 0, lockedUntil: null });
    const token = await signSessionToken({
      sub: user.id,
      role: user.role,
      dept: user.departmentId || DEFAULT_DEPT_UUID,
      email: user.email,
      name: user.name,
      ver: user.sessionVersion ?? 1,
    });

    logSecurityEvent({
      event: "AUTH_LOGIN_SUCCESS",
      severity: "INFO",
      userId: user.id,
      role: user.role,
      ip: clientIp,
      path: "/api/auth/login",
      method: "POST",
    });

    const res = NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          departmentId: user.departmentId || DEFAULT_DEPT_UUID,
        },
      },
      { status: 200 }
    );
    attachSessionCookie(res, token);
    return res;
  }

  // Live PostgreSQL path
  let user: {
    id: string;
    name: string;
    email: string;
    role: "EMPLOYEE" | "MANAGER" | "ADMIN";
    departmentId: string | null;
    passwordHash: string | null;
    sessionVersion: number;
    failedLoginAttempts: number;
    lockedUntil: Date | null;
  } | null = null;

  try {
    const rows = await db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        role: schema.users.role,
        departmentId: schema.users.departmentId,
        passwordHash: schema.users.passwordHash,
        sessionVersion: schema.users.sessionVersion,
        failedLoginAttempts: schema.users.failedLoginAttempts,
        lockedUntil: schema.users.lockedUntil,
      })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    user = rows[0] ?? null;

    if (user?.lockedUntil && new Date(user.lockedUntil).getTime() > now.getTime()) {
      logSecurityEvent({
        event: "AUTH_LOCKOUT",
        severity: "HIGH",
        userId: user.id,
        ip: clientIp,
        path: "/api/auth/login",
        method: "POST",
        reason: "Account temporarily locked due to repeated failed logins",
      });
      return createErrorResponse(
        "AccountLocked",
        "Too many failed login attempts. Please try again in 15 minutes.",
        429
      );
    }

    const isMatch = await verifyPassword(password, user?.passwordHash ?? null);
    if (!user || !isMatch) {
      if (user) {
        const nextAttempts = (user.failedLoginAttempts ?? 0) + 1;
        await db
          .update(schema.users)
          .set({
            failedLoginAttempts: nextAttempts,
            lockedUntil:
              nextAttempts >= MAX_FAILED_ATTEMPTS
                ? new Date(now.getTime() + LOCKOUT_DURATION_MS)
                : null,
            updatedAt: now,
          })
          .where(eq(schema.users.id, user.id));
      }
      logSecurityEvent({
        event: "AUTH_LOGIN_FAILURE",
        severity: "WARN",
        userId: user?.id ?? null,
        ip: clientIp,
        path: "/api/auth/login",
        method: "POST",
        reason: "Invalid email or password",
      });
      return createErrorResponse("InvalidCredentials", "Invalid email or password", 401);
    }

    await db
      .update(schema.users)
      .set({ failedLoginAttempts: 0, lockedUntil: null, updatedAt: now })
      .where(eq(schema.users.id, user.id));
  } catch (err) {
    const classified = classifyAuthDbError(err, {
      path: "/api/auth/login",
      method: "POST",
      ip: clientIp,
      userId: user?.id ?? null,
    });
    if (classified) {
      return createErrorResponse(classified.error, classified.message, classified.statusCode);
    }
    throw err;
  }

  const token = await signSessionToken({
    sub: user.id,
    role: user.role as UserRole,
    dept: user.departmentId || DEFAULT_DEPT_UUID,
    email: user.email,
    name: user.name,
    ver: user.sessionVersion,
  });

  logSecurityEvent({
    event: "AUTH_LOGIN_SUCCESS",
    severity: "INFO",
    userId: user.id,
    role: user.role,
    ip: clientIp,
    path: "/api/auth/login",
    method: "POST",
  });

  const res = NextResponse.json(
    {
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        departmentId: user.departmentId || DEFAULT_DEPT_UUID,
      },
    },
    { status: 200 }
  );
  attachSessionCookie(res, token);
  return res;
});

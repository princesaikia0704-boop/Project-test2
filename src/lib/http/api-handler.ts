/**
 * Corporate Office Store - Global API Reliability, Zero-Trust Auth & Error Wrapper
 * Provides 8000ms SLA timeout, Redis idempotency locks, replay caching,
 * verified session RBAC authorization, CSRF Origin verification,
 * structured security telemetry, and production-safe error envelopes.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  acquireIdempotencyLock,
  saveIdempotencyResponse,
  releaseIdempotencyLock,
  redis,
  getIdempotencyKey,
  IdempotencyEntry,
} from "@/lib/cache/redis";
import { resolveServerSession, AuthenticatedUser } from "@/lib/auth/server-auth";
import { verifyCsrfOrigin } from "@/lib/security/csrf";
import { applySecurityHeaders } from "@/lib/security/headers";
import { logSecurityEvent } from "@/lib/security/logger";
import { extractTrustedClientIp } from "@/lib/security/rate-limit";

export type UserRole = "EMPLOYEE" | "MANAGER" | "ADMIN";

export interface ApiHandlerOptions {
  timeoutMs?: number; // default: 8000
  requireIdempotency?: boolean; // default: false
  allowedRoles?: UserRole[];
  skipCsrfCheck?: boolean; // only for QStash webhook endpoints verified by HMAC
}

export interface ApiErrorEnvelope {
  error: string;
  message: string;
  statusCode: number;
}

export type ApiRouteHandler = (
  req: NextRequest,
  context?: any
) => Promise<NextResponse> | NextResponse;

const verifiedAuthMap = new WeakMap<NextRequest, AuthenticatedUser>();

/**
 * Retrieves the cryptographically verified user attached by withApiReliability,
 * or resolves directly from the request cookies/Clerk session. Never reads raw headers.
 */
export async function getRequestAuth(req: NextRequest): Promise<AuthenticatedUser | null> {
  const cached = verifiedAuthMap.get(req);
  if (cached) return cached;
  const resolved = await resolveServerSession(req);
  if (resolved) {
    verifiedAuthMap.set(req, resolved);
  }
  return resolved;
}

// Redacts database credentials, passwords, and API secrets from output envelopes (T2-F07-03)
export function sanitizeErrorMessage(msg: string): string {
  if (typeof msg !== "string") return String(msg);
  return msg
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[REDACTED_DB_URL]")
    .replace(/CLERK_SECRET_KEY=[^\s"']+/gi, "CLERK_SECRET_KEY=[REDACTED]")
    .replace(/SESSION_SECRET=[^\s"']+/gi, "SESSION_SECRET=[REDACTED]")
    .replace(/UPSTASH_REDIS_REST_TOKEN=[^\s"']+/gi, "UPSTASH_REDIS_REST_TOKEN=[REDACTED]")
    .replace(/QSTASH_TOKEN=[^\s"']+/gi, "QSTASH_TOKEN=[REDACTED]")
    .replace(/R2_SECRET_ACCESS_KEY=[^\s"']+/gi, "R2_SECRET_ACCESS_KEY=[REDACTED]")
    .replace(/RESEND_API_KEY=[^\s"']+/gi, "RESEND_API_KEY=[REDACTED]")
    .replace(/sk_(?:test|live)_[a-zA-Z0-9_-]+/gi, "[REDACTED_SECRET]")
    .replace(/sig(?:key)?_[a-zA-Z0-9_-]+/gi, "[REDACTED_SIGKEY]")
    .replace(/re_[a-zA-Z0-9_-]{12,}/gi, "[REDACTED_RESEND_KEY]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");
}

export function createErrorResponse(
  error: string,
  message: string,
  statusCode: number
): NextResponse<ApiErrorEnvelope> {
  const sanitizedMessage = sanitizeErrorMessage(message);
  const res = NextResponse.json(
    { error, message: sanitizedMessage, statusCode },
    {
      status: statusCode,
      headers: { "content-type": "application/json" },
    }
  );
  applySecurityHeaders(res.headers);
  return res;
}

export function withApiReliability(
  handler: ApiRouteHandler,
  options: ApiHandlerOptions = {}
): (req: NextRequest, context?: any) => Promise<NextResponse> {
  const {
    timeoutMs = 8000,
    requireIdempotency = false,
    allowedRoles,
    skipCsrfCheck = false,
  } = options;

  return async (req: NextRequest, context?: any): Promise<NextResponse> => {
    const clientIp = extractTrustedClientIp(req);
    const pathname = req.nextUrl?.pathname || new URL(req.url).pathname;

    // 1. CSRF Origin Verification on state-changing requests (Defense-in-Depth)
    if (!skipCsrfCheck) {
      const csrf = verifyCsrfOrigin(req);
      if (!csrf.ok) {
        logSecurityEvent({
          event: "CSRF_ORIGIN_BLOCKED",
          severity: "HIGH",
          ip: clientIp,
          path: pathname,
          method: req.method,
          reason: csrf.reason,
        });
        return createErrorResponse("Forbidden", "Origin verification failed", 403);
      }
    }

    // 2. Cryptographic Authentication & Role Verification (Zero-Trust)
    const authUser = await getRequestAuth(req);

    if (allowedRoles && allowedRoles.length > 0) {
      if (!authUser) {
        logSecurityEvent({
          event: "RBAC_ACCESS_DENIED",
          severity: "WARN",
          ip: clientIp,
          path: pathname,
          method: req.method,
          reason: "Unauthenticated request to protected endpoint",
        });
        return createErrorResponse(
          "Unauthorized",
          "Missing or invalid authentication session",
          401
        );
      }

      if (!allowedRoles.includes(authUser.role)) {
        logSecurityEvent({
          event: "RBAC_ACCESS_DENIED",
          severity: "HIGH",
          userId: authUser.id,
          role: authUser.role,
          ip: clientIp,
          path: pathname,
          method: req.method,
          reason: `Role ${authUser.role} attempted access requiring [${allowedRoles.join(", ")}]`,
        });
        return createErrorResponse(
          "Forbidden",
          "Insufficient role permissions for this resource",
          403
        );
      }
    }

    // 3. Idempotency Key Handling (F05)
    const rawIdempKey =
      req.headers.get("idempotency-key") ||
      req.headers.get("Idempotency-Key");
    const idempotencyKey = rawIdempKey ? rawIdempKey.trim().slice(0, 256) : null;

    if (requireIdempotency && !idempotencyKey) {
      return createErrorResponse(
        "MissingIdempotencyKey",
        "Header Idempotency-Key is required for checkout",
        400
      );
    }

    const effectiveUserId = authUser?.id || "anonymous";
    let lockAcquired = false;

    if (idempotencyKey) {
      const lock = await acquireIdempotencyLock(effectiveUserId, idempotencyKey);

      if (!lock.acquired) {
        const cacheKey = getIdempotencyKey(effectiveUserId, idempotencyKey);
        const existing = lock.existing ?? (await redis.get<IdempotencyEntry>(cacheKey));
        if (!existing || existing.state === "IN_PROGRESS") {
          return createErrorResponse(
            "IdempotencyConflict",
            "Order submission currently in-flight",
            409
          );
        }
        const replayRes = NextResponse.json(existing.data, {
          status: existing.status,
          headers: {
            "content-type": "application/json",
            "x-cache": "IDEMPOTENT_HIT",
          },
        });
        applySecurityHeaders(replayRes.headers);
        return replayRes;
      }

      lockAcquired = lock.acquired;
    }

    // 4. Timeout Controller (8000ms SLA - T1-F07-03, T2-F07-01)
    const controller = new AbortController();
    let hasTimedOut = false;

    // Prevent clients in production from triggering artificial 504 DoS via x-timeout-ms
    const clientTimeoutHeader = req.headers.get("x-timeout-ms");
    const parsedClientTimeout = clientTimeoutHeader ? Number(clientTimeoutHeader) : NaN;
    const effectiveTimeoutMs =
      process.env.NODE_ENV !== "production" &&
      Number.isFinite(parsedClientTimeout) &&
      parsedClientTimeout >= 100
        ? Math.min(parsedClientTimeout, timeoutMs)
        : timeoutMs;

    let timeoutTimer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<NextResponse>((_, reject) => {
      timeoutTimer = setTimeout(() => {
        hasTimedOut = true;
        controller.abort();
        reject(new Error("REQUEST_TIMEOUT"));
      }, effectiveTimeoutMs);
    });

    try {
      const executionPromise = (async () => {
        return await handler(req, context);
      })();

      const response = await Promise.race([executionPromise, timeoutPromise]);
      if (timeoutTimer) clearTimeout(timeoutTimer);

      if (idempotencyKey && lockAcquired) {
        if (response.status >= 200 && response.status < 300) {
          try {
            const clone = response.clone();
            const responseData = await clone.json();
            await saveIdempotencyResponse(
              effectiveUserId,
              idempotencyKey,
              response.status,
              responseData
            );
          } catch {
            await releaseIdempotencyLock(effectiveUserId, idempotencyKey);
          }
        } else {
          await releaseIdempotencyLock(effectiveUserId, idempotencyKey);
        }
      }

      applySecurityHeaders(response.headers);
      return response;
    } catch (thrown: any) {
      if (timeoutTimer) clearTimeout(timeoutTimer);

      if (idempotencyKey && lockAcquired) {
        await releaseIdempotencyLock(effectiveUserId, idempotencyKey);
      }

      if (hasTimedOut || thrown?.message === "REQUEST_TIMEOUT" || thrown?.name === "TimeoutError") {
        return createErrorResponse(
          "TimeoutError",
          `Request execution exceeded ${effectiveTimeoutMs}ms SLA limit`,
          504
        );
      }

      const rawErrorMsg =
        typeof thrown === "string"
          ? thrown
          : thrown?.message || "Internal server error occurred";

      const statusCode =
        typeof thrown?.statusCode === "number"
          ? thrown.statusCode
          : typeof thrown?.status === "number"
          ? thrown.status
          : 500;

      const errorType =
        thrown?.name && thrown.name !== "Error"
          ? thrown.name
          : "InternalServerError";

      if (statusCode >= 500) {
        logSecurityEvent({
          event: "UNHANDLED_SERVER_ERROR",
          severity: "HIGH",
          userId: authUser?.id ?? null,
          role: authUser?.role ?? null,
          ip: clientIp,
          path: pathname,
          method: req.method,
          reason: rawErrorMsg,
        });
      }

      // Never expose raw DB/internal error strings to clients in production on 500s
      const clientErrorMsg =
        statusCode >= 500 && process.env.NODE_ENV === "production"
          ? "An unexpected internal server error occurred"
          : rawErrorMsg;

      return createErrorResponse(errorType, clientErrorMsg, statusCode);
    }
  };
}

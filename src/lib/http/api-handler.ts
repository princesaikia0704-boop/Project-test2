/**
 * Corporate Office Store - Global API Reliability & Idempotency Wrapper
 * Provides 8000ms SLA timeout, Redis idempotency locks, replay caching,
 * RBAC authorization, and structured sanitized error envelopes.
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

export type UserRole = "EMPLOYEE" | "MANAGER" | "ADMIN";

export interface ApiHandlerOptions {
  timeoutMs?: number; // default: 8000
  requireIdempotency?: boolean; // default: false
  allowedRoles?: UserRole[];
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

// Redacts database credentials, passwords, and API secrets from output envelopes (T2-F07-03)
export function sanitizeErrorMessage(msg: string): string {
  if (typeof msg !== "string") return String(msg);
  return msg
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[REDACTED_DB_URL]")
    .replace(/CLERK_SECRET_KEY=[^\s"']+/gi, "CLERK_SECRET_KEY=[REDACTED]")
    .replace(/sk_test_[a-zA-Z0-9_]+/gi, "[REDACTED_SECRET]")
    .replace(/sigkey_[a-zA-Z0-9_]+/gi, "[REDACTED_SIGKEY]");
}

export function createErrorResponse(
  error: string,
  message: string,
  statusCode: number
): NextResponse<ApiErrorEnvelope> {
  const sanitizedMessage = sanitizeErrorMessage(message);
  return NextResponse.json(
    { error, message: sanitizedMessage, statusCode },
    {
      status: statusCode,
      headers: { "content-type": "application/json" },
    }
  );
}

export function withApiReliability(
  handler: ApiRouteHandler,
  options: ApiHandlerOptions = {}
): (req: NextRequest, context?: any) => Promise<NextResponse> {
  const { timeoutMs = 8000, requireIdempotency = false, allowedRoles } = options;

  return async (req: NextRequest, context?: any): Promise<NextResponse> => {
    // 1. RBAC Authentication & Role Verification (T1-F07-02)
    let userRole = req.headers.get("x-user-role") as UserRole | null;
    let userId = req.headers.get("x-user-id");

    // Extract from mock Bearer token if not in direct headers
    if (!userRole) {
      const authHeader = req.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer mock_jwt_")) {
        const parts = authHeader.replace("Bearer mock_jwt_", "").split("_");
        if (parts.length >= 2) {
          userRole = parts[0].toUpperCase() as UserRole;
          userId = parts.slice(1).join("_");
        }
      }
    }

    // Extract from mock cookies if not in headers or auth bearer
    if (!userRole) {
      const cookieRole = req.cookies.get("mock_user_role")?.value?.toUpperCase() as UserRole | undefined;
      const cookiePersona = req.cookies.get("mock_persona")?.value;
      const cookieToken = req.cookies.get("mock_token")?.value;

      if (cookieRole) {
        userRole = cookieRole;
        userId = cookiePersona || userId || "user-admin";
      } else if (cookieToken && cookieToken.startsWith("mock_jwt_")) {
        const parts = cookieToken.replace("mock_jwt_", "").split("_");
        if (parts.length >= 2) {
          userRole = parts[0].toUpperCase() as UserRole;
          userId = parts.slice(1).join("_");
        }
      } else if (cookiePersona) {
        if (cookiePersona.includes("adm")) userRole = "ADMIN";
        else if (cookiePersona.includes("mgr")) userRole = "MANAGER";
        else if (cookiePersona.includes("emp")) userRole = "EMPLOYEE";
        userId = cookiePersona;
      }
    }

    if (allowedRoles && allowedRoles.length > 0) {
      if (!userRole || !userId) {
        return createErrorResponse(
          "Unauthorized",
          "Missing or invalid authentication token",
          401
        );
      }
      if (!allowedRoles.includes(userRole)) {
        return createErrorResponse(
          "Forbidden",
          "Insufficient role permissions for administrative resource",
          403
        );
      }
    }

    // 2. Idempotency Key Handling (F05)
    const idempotencyKey =
      req.headers.get("idempotency-key") ||
      req.headers.get("Idempotency-Key");

    if (requireIdempotency && !idempotencyKey) {
      return createErrorResponse(
        "MissingIdempotencyKey",
        "Header Idempotency-Key is required for checkout",
        400
      );
    }

    const effectiveUserId = userId || "anonymous";
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
        return NextResponse.json(existing.data, {
          status: existing.status,
          headers: {
            "content-type": "application/json",
            "x-cache": "IDEMPOTENT_HIT",
          },
        });
      }

      lockAcquired = lock.acquired;
    }

    // 3. Timeout Controller (8000ms SLA - T1-F07-03, T2-F07-01)
    const controller = new AbortController();
    let hasTimedOut = false;

    // Check client override timeout header or option
    const clientTimeoutHeader = req.headers.get("x-timeout-ms");
    const effectiveTimeoutMs = clientTimeoutHeader
      ? Math.min(Number(clientTimeoutHeader), timeoutMs)
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
      // Race execution against SLA limit
      const executionPromise = (async () => {
        return await handler(req, context);
      })();

      const response = await Promise.race([executionPromise, timeoutPromise]);
      if (timeoutTimer) clearTimeout(timeoutTimer);

      // 4. Successful Execution - Cache Payload or Purge on Validation Failure
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
            // Non-JSON response, release mutex
            await releaseIdempotencyLock(effectiveUserId, idempotencyKey);
          }
        } else {
          // If response is 4xx or 5xx, purge the lock to allow retry (T2-F05-04)
          await releaseIdempotencyLock(effectiveUserId, idempotencyKey);
        }
      }

      return response;
    } catch (thrown: any) {
      if (timeoutTimer) clearTimeout(timeoutTimer);

      // Always purge idempotency lock on thrown exceptions so client can retry
      if (idempotencyKey && lockAcquired) {
        await releaseIdempotencyLock(effectiveUserId, idempotencyKey);
      }

      // Handle SLA Timeout (T2-F07-01: 'Request execution exceeded 8000ms SLA limit')
      if (hasTimedOut || thrown?.message === "REQUEST_TIMEOUT" || thrown?.name === "TimeoutError") {
        return createErrorResponse(
          "TimeoutError",
          `Request execution exceeded ${effectiveTimeoutMs}ms SLA limit`,
          504
        );
      }

      // Handle String Primitives & Custom Errors (T2-F07-04)
      const errorMsg =
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

      return createErrorResponse(errorType, errorMsg, statusCode);
    }
  };
}

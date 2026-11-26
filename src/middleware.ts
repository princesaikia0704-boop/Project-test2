/**
 * Corporate Office Store - Zero-Trust Edge Security, Auth, RBAC & Rate-Limiting Middleware
 * Next.js 15 App Router - Edge Runtime
 *
 * Implements:
 * - Untrusted identity header stripping (x-user-*, x-department-id)
 * - Production HTTPS enforcement
 * - Explicit CORS allowlist & CSRF Origin verification
 * - Multi-tier distributed sliding-window rate limiting
 * - Clerk JWT / Signed HttpOnly Cookie authentication & strict RBAC
 * - Enterprise Security Headers (HSTS, CSP, XFO, XCTO, Referrer-Policy, Permissions-Policy)
 */

import { NextRequest, NextResponse } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";
import { isClerkConfigured, isDemoAuthEnabled } from "@/lib/mock/utils";
import {
  SESSION_COOKIE_NAME,
  UserRole,
  verifySessionToken,
} from "@/lib/auth/session";
import { applySecurityHeaders } from "@/lib/security/headers";
import { applyCorsHeaders, isOriginAllowed } from "@/lib/security/cors";
import { verifyCsrfOrigin } from "@/lib/security/csrf";
import {
  evaluateRateLimitDistributed,
  extractTrustedClientIp,
  RateLimitResult,
  selectRateLimitPolicy,
} from "@/lib/security/rate-limit";
import { logSecurityEvent } from "@/lib/security/logger";

export type { UserRole };

function stripUntrustedIdentityHeaders(headers: Headers): void {
  const spoofable = [
    "x-user-id",
    "x-user-role",
    "x-user-department-id",
    "x-department-id",
    "x-auth-verified",
  ];
  for (const h of spoofable) {
    headers.delete(h);
  }
}

function applyRateLimitHeaders(headers: Headers, rl: RateLimitResult): void {
  headers.set("x-ratelimit-limit", String(rl.limit));
  headers.set("x-ratelimit-remaining", String(rl.remaining));
  headers.set("x-ratelimit-reset", String(rl.reset));
}

function createJsonErrorResponse(
  error: string,
  message: string,
  statusCode: number,
  rl?: RateLimitResult,
  extraHeaders?: Record<string, string>
): NextResponse {
  const headers = new Headers({
    "content-type": "application/json",
    ...(extraHeaders || {}),
  });
  if (rl) applyRateLimitHeaders(headers, rl);
  applySecurityHeaders(headers);

  return new NextResponse(
    JSON.stringify({ error, message, statusCode }),
    { status: statusCode, headers }
  );
}

function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/api/health" ||
    pathname === "/api/products" ||
    pathname.startsWith("/api/products/") ||
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/workers/")
  );
}

function isManagerAllowedPath(pathname: string, method: string): boolean {
  if (
    pathname === "/admin" ||
    pathname === "/admin/approvals" ||
    pathname.startsWith("/admin/approvals/") ||
    pathname === "/admin/settings" ||
    pathname.startsWith("/admin/settings/")
  ) {
    return true;
  }

  if (
    pathname === "/api/admin/approvals" ||
    pathname.startsWith("/api/admin/approvals/") ||
    pathname === "/api/admin/orders" ||
    pathname.startsWith("/api/admin/orders/") ||
    pathname === "/api/admin/kpis" ||
    pathname.startsWith("/api/admin/kpis/") ||
    pathname === "/api/admin/billing/export" ||
    pathname.startsWith("/api/admin/billing/")
  ) {
    return true;
  }

  // Managers can READ products/categories/store-config, but CANNOT mutate global settings, catalog, stock, uploads, audit-logs, or seed
  if (
    method === "GET" &&
    (pathname === "/api/admin/products" ||
      pathname === "/api/admin/categories" ||
      pathname === "/api/admin/store-config")
  ) {
    return true;
  }

  return false;
}

async function handleCoreMiddleware(
  req: NextRequest,
  clerkSession?: { userId: string | null; role?: UserRole | null }
): Promise<NextResponse> {
  const pathname = new URL(req.url).pathname;

  // 1. HTTPS Enforcement in Production (ignore local loopback health/dev traffic)
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").toLowerCase();
  const forwardedProto = (req.headers.get("x-forwarded-proto") || "").split(",")[0].trim().toLowerCase();
  const isLocalHost = host.startsWith("localhost") || host.startsWith("127.0.0.1");

  if (process.env.NODE_ENV === "production" && forwardedProto === "http" && !isLocalHost) {
    const httpsUrl = new URL(req.url);
    httpsUrl.protocol = "https:";
    const redirect = NextResponse.redirect(httpsUrl, 308);
    applySecurityHeaders(redirect.headers);
    return redirect;
  }

  const clientIp = extractTrustedClientIp(req);

  // 2. Explicit CORS Policy Check on /api/*
  const originHeader = req.headers.get("origin");
  if (pathname.startsWith("/api/") && originHeader) {
    if (!isOriginAllowed(req, originHeader)) {
      logSecurityEvent({
        event: "CORS_ORIGIN_BLOCKED",
        severity: "HIGH",
        ip: clientIp,
        path: pathname,
        method: req.method,
        reason: `Rejected CORS origin: ${originHeader}`,
      });
      return createJsonErrorResponse("Forbidden", "Origin is not in CORS allowlist", 403);
    }

    if (req.method === "OPTIONS") {
      const preflight = new NextResponse(null, { status: 204 });
      applyCorsHeaders(preflight.headers, new URL(originHeader).origin);
      applySecurityHeaders(preflight.headers);
      return preflight;
    }
  }

  // 3. Multi-Tier Rate Limiting (Strict on /api/auth/*, sensitive mutations, and public APIs)
  const policy = selectRateLimitPolicy(pathname, req.method);
  const rateLimit = await evaluateRateLimitDistributed(clientIp, policy);

  if (!rateLimit.success) {
    logSecurityEvent({
      event: "RATE_LIMIT_TRIGGERED",
      severity: "WARN",
      ip: clientIp,
      path: pathname,
      method: req.method,
      reason: `Exceeded ${policy.bucket} quota (${policy.limit}/min)`,
    });
    return createJsonErrorResponse(
      "RateLimitExceeded",
      "Rate limit quota exceeded. Slow down.",
      429,
      rateLimit,
      { "retry-after": "60" }
    );
  }

  // 4. CSRF Origin Verification on state-changing requests
  const csrfCheck = verifyCsrfOrigin(req);
  if (!csrfCheck.ok) {
    logSecurityEvent({
      event: "CSRF_ORIGIN_BLOCKED",
      severity: "HIGH",
      ip: clientIp,
      path: pathname,
      method: req.method,
      reason: csrfCheck.reason,
    });
    return createJsonErrorResponse("Forbidden", "CSRF origin check failed", 403, rateLimit);
  }

  // 5. Authenticate via Clerk OR Signed HttpOnly Session Cookie (NEVER raw client headers or mock_* cookies)
  let sessionUserId: string | null = null;
  let sessionRole: UserRole | null = null;

  if (clerkSession?.userId) {
    sessionUserId = clerkSession.userId;
    sessionRole = clerkSession.role ?? null;
  } else {
    const rawCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const verified = await verifySessionToken(rawCookie);
    if (verified && (!verified.demo || isDemoAuthEnabled())) {
      sessionUserId = verified.sub;
      sessionRole = verified.role;
    }
  }

  const publicRoute = isPublicPath(pathname);

  if (!publicRoute && !sessionUserId) {
    if (pathname.startsWith("/api/")) {
      return createJsonErrorResponse(
        "Unauthorized",
        "Missing or invalid authentication session",
        401,
        rateLimit
      );
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect_url", pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    applyRateLimitHeaders(redirectResponse.headers, rateLimit);
    applySecurityHeaders(redirectResponse.headers);
    return redirectResponse;
  }

  // 6. Strict Server-Side Edge RBAC (API routes also independently enforce DB roles via withApiReliability)
  const isAdminRoute = pathname.startsWith("/api/admin/") || pathname.startsWith("/admin");
  if (sessionUserId && sessionRole && isAdminRoute) {
    const isAllowedEmployeeBrandingGet =
      pathname === "/api/admin/store-config" && req.method === "GET";

    if (sessionRole === "EMPLOYEE" && !isAllowedEmployeeBrandingGet) {
      logSecurityEvent({
        event: "RBAC_ACCESS_DENIED",
        severity: "HIGH",
        userId: sessionUserId,
        role: sessionRole,
        ip: clientIp,
        path: pathname,
        method: req.method,
        reason: "Employee attempted admin route access",
      });

      if (pathname.startsWith("/api/")) {
        return createJsonErrorResponse(
          "Forbidden",
          "Insufficient role permissions for administrative resource",
          403,
          rateLimit
        );
      }
      const homeUrl = new URL("/", req.url);
      const redirectResponse = NextResponse.redirect(homeUrl);
      applyRateLimitHeaders(redirectResponse.headers, rateLimit);
      applySecurityHeaders(redirectResponse.headers);
      return redirectResponse;
    }

    if (sessionRole === "MANAGER" && !isManagerAllowedPath(pathname, req.method)) {
      logSecurityEvent({
        event: "RBAC_ACCESS_DENIED",
        severity: "HIGH",
        userId: sessionUserId,
        role: sessionRole,
        ip: clientIp,
        path: pathname,
        method: req.method,
        reason: "Manager attempted restricted ADMIN-only resource access",
      });

      if (pathname.startsWith("/api/")) {
        return createJsonErrorResponse(
          "Forbidden",
          "Admin privileges required for this resource",
          403,
          rateLimit
        );
      }
      const approvalsUrl = new URL("/admin/approvals", req.url);
      const redirectResponse = NextResponse.redirect(approvalsUrl);
      applyRateLimitHeaders(redirectResponse.headers, rateLimit);
      applySecurityHeaders(redirectResponse.headers);
      return redirectResponse;
    }
  }

  // 7. Strip untrusted incoming identity headers before passing request downstream
  const sanitizedHeaders = new Headers(req.headers);
  stripUntrustedIdentityHeaders(sanitizedHeaders);

  const response = NextResponse.next({
    request: {
      headers: sanitizedHeaders,
    },
  });

  if (pathname.startsWith("/api/") && originHeader && isOriginAllowed(req, originHeader)) {
    applyCorsHeaders(response.headers, new URL(originHeader).origin);
  }
  applyRateLimitHeaders(response.headers, rateLimit);
  applySecurityHeaders(response.headers);

  return response;
}

let cachedClerkHandler:
  | ReturnType<typeof clerkMiddleware>
  | undefined;

function getClerkMiddlewareHandler() {
  if (!cachedClerkHandler) {
    cachedClerkHandler = clerkMiddleware(async (auth, req: NextRequest) => {
      const { userId, sessionClaims } = await auth();
      const metadataRole = (sessionClaims?.metadata as { role?: string } | undefined)?.role;
      const normalizedRole =
        metadataRole === "ADMIN" || metadataRole === "MANAGER" || metadataRole === "EMPLOYEE"
          ? metadataRole
          : null;

      return await handleCoreMiddleware(req, {
        userId: userId ?? null,
        role: normalizedRole,
      });
    });
  }
  return cachedClerkHandler;
}

export default async function middleware(req: NextRequest, event: any) {
  if (isClerkConfigured()) {
    const clerkHandler = getClerkMiddlewareHandler();
    return await clerkHandler(req, event);
  }
  return await handleCoreMiddleware(req);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js)$).*)",
  ],
};

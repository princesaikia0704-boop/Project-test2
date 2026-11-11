/**
 * Corporate Office Store - Edge Authentication, RBAC & Rate Limiting Middleware
 * Next.js 15 App Router - Edge Runtime (<5ms SLA)
 *
 * Implements:
 * - Feature F13: Edge Middleware Auth & RBAC Guard (EMPLOYEE, MANAGER, ADMIN)
 * - Feature F14: Edge Rate Limiting Guard (100 req/min sliding window, fail-open)
 */

import { NextRequest, NextResponse } from "next/server";

export type UserRole = "EMPLOYEE" | "MANAGER" | "ADMIN";

export interface ResolvedPersona {
  id: string;
  role: UserRole;
  departmentId: string;
  name?: string;
  email?: string;
}

// Canonical Persona Catalog for Test Token & Mock Resolution
const KNOWN_PERSONAS: Record<string, ResolvedPersona> = {
  "user-alice-emp": {
    id: "user-alice-emp",
    role: "EMPLOYEE",
    departmentId: "dept-eng",
    name: "Alice Engineer",
    email: "alice@company.com",
  },
  "user-bob-emp": {
    id: "user-bob-emp",
    role: "EMPLOYEE",
    departmentId: "dept-eng",
    name: "Bob Staff Engineer",
    email: "bob@company.com",
  },
  "user-carol-mgr": {
    id: "user-carol-mgr",
    role: "MANAGER",
    departmentId: "dept-eng",
    name: "Carol Manager",
    email: "carol@company.com",
  },
  "user-dave-adm": {
    id: "user-dave-adm",
    role: "ADMIN",
    departmentId: "dept-ops",
    name: "Dave Administrator",
    email: "dave@company.com",
  },
};

// -----------------------------------------------------------------------------
// 1. Sliding Window Rate Limiter (In-Memory Fail-Open Engine)
// -----------------------------------------------------------------------------

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __edgeRateLimitStore: Map<string, number[]> | undefined;
}

function getRateLimitStore(): Map<string, number[]> {
  if (!globalThis.__edgeRateLimitStore) {
    globalThis.__edgeRateLimitStore = new Map<string, number[]>();
  }
  return globalThis.__edgeRateLimitStore;
}

export function evaluateRateLimit(
  ip: string,
  maxLimit = 100,
  windowMs = 60_000
): RateLimitResult {
  try {
    const now = Date.now();
    const store = getRateLimitStore();
    const existing = store.get(ip) || [];

    // Filter out timestamps older than the sliding window
    const timestamps = existing.filter((t) => now - t < windowMs);
    timestamps.push(now);
    store.set(ip, timestamps);

    const remaining = Math.max(0, maxLimit - timestamps.length);
    const reset = Math.ceil((now + windowMs) / 1000);
    const success = timestamps.length <= maxLimit;

    return {
      success,
      limit: maxLimit,
      remaining,
      reset,
    };
  } catch {
    // Fail-open fallback: never block healthy traffic on rate-limiter failure
    return {
      success: true,
      limit: maxLimit,
      remaining: maxLimit,
      reset: Math.ceil((Date.now() + windowMs) / 1000),
    };
  }
}

export function extractClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0].trim();
    if (firstIp) return firstIp;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp && realIp.trim()) return realIp.trim();
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp && cfIp.trim()) return cfIp.trim();
  return "127.0.0.1";
}

// -----------------------------------------------------------------------------
// 2. Mock & Clerk Edge Persona Resolver
// -----------------------------------------------------------------------------

export function resolveEdgePersona(req: NextRequest): ResolvedPersona | null {
  // A. Check explicit persona headers (highest priority, used by TestClient & proxies)
  const headerRole = req.headers.get("x-user-role");
  const headerUserId = req.headers.get("x-user-id");
  const headerDeptId =
    req.headers.get("x-user-department-id") || req.headers.get("x-department-id");

  if (headerRole && headerUserId) {
    const roleUpper = headerRole.toUpperCase() as UserRole;
    if (roleUpper === "EMPLOYEE" || roleUpper === "MANAGER" || roleUpper === "ADMIN") {
      return {
        id: headerUserId,
        role: roleUpper,
        departmentId: headerDeptId || KNOWN_PERSONAS[headerUserId]?.departmentId || "dept-eng",
        name: KNOWN_PERSONAS[headerUserId]?.name || headerUserId,
        email: KNOWN_PERSONAS[headerUserId]?.email || `${headerUserId}@company.local`,
      };
    }
  }

  // B. Check Bearer mock_jwt tokens: Bearer mock_jwt_<role>_<userId>
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer mock_jwt_")) {
    const tokenPayload = authHeader.replace("Bearer mock_jwt_", "");
    const parts = tokenPayload.split("_");
    if (parts.length >= 2) {
      const rawRole = parts[0].toUpperCase() as UserRole;
      const rawUserId = parts.slice(1).join("_");
      const matched = KNOWN_PERSONAS[rawUserId];

      if (rawRole === "EMPLOYEE" || rawRole === "MANAGER" || rawRole === "ADMIN") {
        return {
          id: rawUserId,
          role: rawRole,
          departmentId: headerDeptId || matched?.departmentId || "dept-eng",
          name: matched?.name || rawUserId,
          email: matched?.email || `${rawUserId}@company.local`,
        };
      }
    }
  }

  // C. Fallback for Known Persona IDs in headerUserId alone
  if (headerUserId && KNOWN_PERSONAS[headerUserId]) {
    return KNOWN_PERSONAS[headerUserId];
  }

  // D. Check Cookies for browser sessions
  const cookiePersonaId = req.cookies.get("mock_persona")?.value;
  if (cookiePersonaId && KNOWN_PERSONAS[cookiePersonaId]) {
    return KNOWN_PERSONAS[cookiePersonaId];
  }

  return null;
}

// -----------------------------------------------------------------------------
// 3. Response Helpers
// -----------------------------------------------------------------------------

function applyRateLimitHeaders(headers: Headers, rl: RateLimitResult): void {
  headers.set("x-ratelimit-limit", String(rl.limit));
  headers.set("x-ratelimit-remaining", String(rl.remaining));
  headers.set("x-ratelimit-reset", String(rl.reset));
}

function createJsonErrorResponse(
  error: string,
  message: string,
  statusCode: number,
  rl: RateLimitResult,
  extraHeaders?: Record<string, string>
): NextResponse {
  const headers = new Headers({
    "content-type": "application/json",
    ...(extraHeaders || {}),
  });
  applyRateLimitHeaders(headers, rl);

  return new NextResponse(
    JSON.stringify({ error, message, statusCode }),
    { status: statusCode, headers }
  );
}

// -----------------------------------------------------------------------------
// 4. Main Edge Middleware Handler
// -----------------------------------------------------------------------------

export async function middleware(req: NextRequest): Promise<NextResponse> {
  // Normalize pathname to prevent path traversal bypasses (e.g. /api/admin/../admin/store-config)
  const pathname = new URL(req.url).pathname;

  // 1. Rate Limiting Check (Feature F14)
  const clientIp = extractClientIp(req);
  const rateLimit = evaluateRateLimit(clientIp, 100, 60_000);

  if (!rateLimit.success) {
    return createJsonErrorResponse(
      "RateLimitExceeded",
      "Rate limit quota exceeded. Slow down.",
      429,
      rateLimit,
      { "retry-after": "60" }
    );
  }

  // 2. Identify Public Routes
  const isPublicRoute =
    pathname === "/api/health" ||
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/(auth)/") ||
    pathname.startsWith("/api/workers/") ||
    pathname === "/api/products" ||
    pathname.startsWith("/api/products?") ||
    pathname === "/";

  // 3. Resolve Persona / JWT
  const persona = resolveEdgePersona(req);

  // 4. Authenticate Protected Routes (Feature F13)
  if (!isPublicRoute && !persona) {
    // API routes return 401 JSON
    if (pathname.startsWith("/api/")) {
      return createJsonErrorResponse(
        "Unauthorized",
        "Missing or invalid authentication token",
        401,
        rateLimit
      );
    }
    // Web pages redirect to /login
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect_url", pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    applyRateLimitHeaders(redirectResponse.headers, rateLimit);
    return redirectResponse;
  }

  // 5. RBAC Route Guard Checks
  if (persona) {
    // Protect Admin Routes: /api/admin/* and /admin/*
    const isAdminRoute = pathname.startsWith("/api/admin/") || pathname.startsWith("/admin");

    if (isAdminRoute) {
      // EMPLOYEE is completely forbidden from admin routes
      if (persona.role === "EMPLOYEE") {
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
        return redirectResponse;
      }

      // MANAGER restrictions: Manager can access approvals queue, but NOT store settings, audit logs, or product mutations
      if (persona.role === "MANAGER") {
        const isManagerAllowed =
          pathname === "/api/admin/approvals" ||
          pathname.startsWith("/api/admin/approvals/") ||
          pathname === "/admin/approvals" ||
          pathname.startsWith("/admin/approvals/");

        const isRestrictedAdminAction =
          pathname.startsWith("/api/admin/store-config") ||
          pathname.startsWith("/api/admin/audit-logs") ||
          pathname.startsWith("/api/admin/products") ||
          pathname.startsWith("/api/admin/categories") ||
          pathname.startsWith("/api/admin/kpis") ||
          pathname.startsWith("/admin/settings") ||
          pathname.startsWith("/admin/audit-logs") ||
          pathname.startsWith("/admin/products");

        if (isRestrictedAdminAction && !isManagerAllowed) {
          if (pathname.startsWith("/api/")) {
            return createJsonErrorResponse(
              "Forbidden",
              "Insufficient role permissions for administrative resource",
              403,
              rateLimit
            );
          }
          const approvalsUrl = new URL("/admin/approvals", req.url);
          const redirectResponse = NextResponse.redirect(approvalsUrl);
          applyRateLimitHeaders(redirectResponse.headers, rateLimit);
          return redirectResponse;
        }
      }
    }
  }

  // 6. Header Propagation for Downstream Route Handlers & Server Components
  const requestHeaders = new Headers(req.headers);
  if (persona) {
    requestHeaders.set("x-user-id", persona.id);
    requestHeaders.set("x-user-role", persona.role);
    requestHeaders.set("x-user-department-id", persona.departmentId);
    requestHeaders.set("x-department-id", persona.departmentId);
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Attach rate limit headers to all outgoing responses
  applyRateLimitHeaders(response.headers, rateLimit);

  return response;
}

// -----------------------------------------------------------------------------
// 5. Config Matcher
// -----------------------------------------------------------------------------

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images and static files (*.svg, *.png, *.jpg, *.jpeg, *.gif, *.webp, *.css, *.js)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js)$).*)",
  ],
};

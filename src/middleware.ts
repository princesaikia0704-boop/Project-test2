/**
 * Corporate Office Store - Edge Authentication, RBAC & Rate Limiting Middleware
 * Next.js 15 App Router - Edge Runtime (<5ms SLA)
 *
 * Implements:
 * - Feature F13: Edge Middleware Auth & RBAC Guard (EMPLOYEE, MANAGER, ADMIN)
 * - Feature F14: Edge Rate Limiting Guard (100 req/min sliding window, fail-open)
 */

import { NextRequest, NextResponse } from "next/server";
import { normalizeDepartmentUuid, normalizeUserUuid } from "@/lib/utils";

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
    id: "30000000-0000-0000-0000-000000000001",
    role: "EMPLOYEE",
    departmentId: "10000000-0000-0000-0000-000000000001",
    name: "Alice Engineer",
    email: "alice@company.com",
  },
  "user-bob-emp": {
    id: "30000000-0000-0000-0000-000000000004",
    role: "EMPLOYEE",
    departmentId: "10000000-0000-0000-0000-000000000001",
    name: "Bob Staff Engineer",
    email: "bob@company.com",
  },
  "user-carol-mgr": {
    id: "30000000-0000-0000-0000-000000000002",
    role: "MANAGER",
    departmentId: "10000000-0000-0000-0000-000000000001",
    name: "Carol Manager",
    email: "carol@company.com",
  },
  "user-dave-adm": {
    id: "30000000-0000-0000-0000-000000000003",
    role: "ADMIN",
    departmentId: "10000000-0000-0000-0000-000000000005",
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
      const dept = headerDeptId || KNOWN_PERSONAS[headerUserId]?.departmentId;
      return {
        id: normalizeUserUuid(headerUserId),
        role: roleUpper,
        departmentId: normalizeDepartmentUuid(dept),
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
        const dept = headerDeptId || matched?.departmentId;
        return {
          id: normalizeUserUuid(matched?.id || rawUserId),
          role: rawRole,
          departmentId: normalizeDepartmentUuid(dept),
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

  // E. Fallback: Parse mock_token cookie
  const cookieToken = req.cookies.get("mock_token")?.value;
  if (cookieToken && cookieToken.startsWith("mock_jwt_")) {
    const parts = cookieToken.replace("mock_jwt_", "").split("_");
    if (parts.length >= 2) {
      const rawRole = parts[0].toUpperCase() as UserRole;
      const rawUserId = parts.slice(1).join("_");
      const matched = KNOWN_PERSONAS[rawUserId];
      return {
        id: normalizeUserUuid(matched?.id || rawUserId),
        role: rawRole,
        departmentId: normalizeDepartmentUuid(matched?.departmentId),
        name: matched?.name || rawUserId,
        email: matched?.email || `${rawUserId}@company.local`,
      };
    }
  }

  // F. Fallback: Parse mock_user_role cookie
  const cookieRole = req.cookies.get("mock_user_role")?.value?.toUpperCase() as UserRole | undefined;
  if (cookieRole && (cookieRole === "EMPLOYEE" || cookieRole === "MANAGER" || cookieRole === "ADMIN")) {
    const defaultId = cookieRole === "ADMIN" ? "user-dave-adm" : cookieRole === "MANAGER" ? "user-carol-mgr" : "user-alice-emp";
    const uid = cookiePersonaId || defaultId;
    const matched = KNOWN_PERSONAS[uid];
    return {
      id: normalizeUserUuid(matched?.id || uid),
      role: cookieRole,
      departmentId: normalizeDepartmentUuid(matched?.departmentId),
      name: matched?.name || uid,
      email: matched?.email || `${uid}@company.local`,
    };
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
    pathname === "/api/admin/seed" ||
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/(auth)/") ||
    pathname.startsWith("/api/workers/") ||
    pathname === "/api/products" ||
    pathname.startsWith("/api/products/") ||
    pathname === "/";           // catalog is public; /cart /orders /admin all require login

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
    // ── Storefront Guard: MANAGER & ADMIN don't belong on the employee storefront ──
    const isStorefrontRoute =
      pathname === "/" ||
      pathname === "/cart" ||
      pathname.startsWith("/cart/") ||
      pathname === "/orders" ||
      pathname.startsWith("/orders/");

    if (isStorefrontRoute && (persona.role === "MANAGER" || persona.role === "ADMIN")) {
      const panelUrl = new URL(
        persona.role === "MANAGER" ? "/admin/approvals" : "/admin",
        req.url
      );
      const redirectResponse = NextResponse.redirect(panelUrl);
      applyRateLimitHeaders(redirectResponse.headers, rateLimit);
      return redirectResponse;
    }

    // ── Admin Guard: EMPLOYEE cannot access /admin/* ──
    const isAdminRoute = pathname.startsWith("/api/admin/") || pathname.startsWith("/admin");

    if (isAdminRoute) {
      // EMPLOYEE is completely forbidden from admin routes (except public database seed)
      if (persona.role === "EMPLOYEE" && pathname !== "/api/admin/seed") {
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

      // MANAGER permissions: Manager can access approvals, KPIs, billing, settings view, and audit logs
      if (persona.role === "MANAGER") {
        const isManagerAllowed =
          pathname === "/admin" ||
          pathname === "/admin/approvals" ||
          pathname.startsWith("/admin/approvals/") ||
          pathname === "/api/admin/approvals" ||
          pathname.startsWith("/api/admin/approvals/") ||
          pathname === "/api/admin/orders" ||
          pathname.startsWith("/api/admin/orders/") ||
          pathname === "/api/admin/kpis" ||
          pathname.startsWith("/api/admin/kpis/") ||
          pathname === "/api/admin/billing/export" ||
          pathname.startsWith("/api/admin/billing") ||
          pathname === "/admin/settings" ||
          pathname.startsWith("/admin/settings") ||
          pathname === "/api/admin/store-config" ||
          pathname.startsWith("/api/admin/store-config") ||
          pathname === "/admin/audit-logs" ||
          pathname.startsWith("/admin/audit-logs") ||
          pathname === "/api/admin/audit-logs" ||
          pathname.startsWith("/api/admin/audit-logs") ||
          pathname === "/admin/catalog" ||
          pathname.startsWith("/admin/catalog") ||
          pathname === "/api/admin/products" ||
          pathname.startsWith("/api/admin/products") ||
          pathname === "/api/admin/categories" ||
          pathname.startsWith("/api/admin/categories");

        const isRestrictedAdminAction =
          pathname.startsWith("/api/admin/products") ||
          pathname.startsWith("/api/admin/categories");

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

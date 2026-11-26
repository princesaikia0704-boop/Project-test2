/**
 * Explicit CORS Origin Allowlist Helper (Zero Wildcard Policy).
 * Edge + Node compatible.
 */

import type { NextRequest } from "next/server";

const ALLOWED_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
const ALLOWED_HEADERS = "Content-Type, Authorization, Idempotency-Key, X-Requested-With";

export function getAllowedOrigins(req: NextRequest): string[] {
  const origins = new Set<string>();

  // 1. Explicit comma-separated allowlist from server env
  const configured = process.env.ALLOWED_ORIGINS?.split(",") || [];
  for (const entry of configured) {
    const trimmed = entry.trim();
    if (!trimmed || trimmed === "*") continue; // never accept wildcard
    try {
      origins.add(new URL(trimmed).origin);
    } catch {
      // ignore invalid origin
    }
  }

  // 2. Application canonical URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl && appUrl !== "*") {
    try {
      origins.add(new URL(appUrl).origin);
    } catch {
      // ignore invalid URL
    }
  }

  // 3. Same-origin host from request
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").split(",")[0].trim();
  const rawProto = (req.headers.get("x-forwarded-proto") || "").split(",")[0].trim().toLowerCase();
  const proto =
    rawProto === "http" || rawProto === "https"
      ? rawProto
      : process.env.NODE_ENV === "production"
      ? "https"
      : "http";
  if (host) {
    try {
      origins.add(new URL(`${proto}://${host}`).origin);
    } catch {
      // ignore invalid host
    }
  }

  return Array.from(origins);
}

export function isOriginAllowed(req: NextRequest, origin: string): boolean {
  try {
    const normalized = new URL(origin).origin;
    return getAllowedOrigins(req).includes(normalized);
  } catch {
    return false;
  }
}

export function applyCorsHeaders(headers: Headers, allowedOrigin: string): void {
  headers.set("Access-Control-Allow-Origin", allowedOrigin);
  headers.set("Vary", "Origin");
  headers.set("Access-Control-Allow-Methods", ALLOWED_METHODS);
  headers.set("Access-Control-Allow-Headers", ALLOWED_HEADERS);
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Max-Age", "600");
}

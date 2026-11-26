/**
 * Enterprise HTTP Security Headers (OWASP / ASVS).
 * Applied in both next.config.ts and Edge Middleware.
 */

export function buildContentSecurityPolicy(): string {
  const clerkOrigin = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim()
    ? "https://*.clerk.accounts.dev https://*.clerk.com https://clerk.com"
    : "";

  const directives = [
    "default-src 'self'",
    // Next.js hydration & Clerk require 'self' + inline scripts unless per-request nonces are wired across all static routes.
    `script-src 'self' 'unsafe-inline' ${clerkOrigin}`.trim(),
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://img.clerk.com https://images.unsplash.com https://*.r2.cloudflarestorage.com https://pub-*.r2.dev",
    `connect-src 'self' ${clerkOrigin} https://*.r2.cloudflarestorage.com`.trim(),
    "frame-src 'self' https://*.clerk.accounts.dev https://*.clerk.com",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
  ];

  return directives.join("; ");
}

export function getSecurityHeadersRecord(): Record<string, string> {
  return {
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "Content-Security-Policy": buildContentSecurityPolicy(),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "X-DNS-Prefetch-Control": "off",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
  };
}

export function applySecurityHeaders(headers: Headers): void {
  const record = getSecurityHeadersRecord();
  for (const [key, value] of Object.entries(record)) {
    if (!headers.has(key)) {
      headers.set(key, value);
    }
  }
}

/**
 * CSRF & Origin/Referer Verification Guard for State-Changing Requests.
 * Edge + Node compatible.
 */

import type { NextRequest } from "next/server";
import { isOriginAllowed } from "./cors";

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Verifies that state-changing requests originate from an allowlisted origin.
 * Signed QStash webhook callbacks (/api/workers/*) authenticate via cryptographic
 * HMAC signature and are exempt from browser Origin checks.
 */
export function verifyCsrfOrigin(req: NextRequest): { ok: true } | { ok: false; reason: string } {
  if (!STATE_CHANGING_METHODS.has(req.method.toUpperCase())) {
    return { ok: true };
  }

  const pathname = req.nextUrl?.pathname || new URL(req.url).pathname;

  // Signed external webhooks verify Upstash-Signature HMAC instead of Origin
  if (pathname.startsWith("/api/workers/")) {
    return { ok: true };
  }

  const originHeader = req.headers.get("origin");
  if (originHeader) {
    if (originHeader === "null") {
      return { ok: false, reason: "Opaque 'null' Origin rejected on state-changing request" };
    }
    if (!isOriginAllowed(req, originHeader)) {
      return { ok: false, reason: `Disallowed Origin: ${originHeader}` };
    }
    return { ok: true };
  }

  // Fallback to Referer header when browser omits Origin
  const refererHeader = req.headers.get("referer");
  if (refererHeader) {
    if (!isOriginAllowed(req, refererHeader)) {
      return { ok: false, reason: "Disallowed Referer origin on state-changing request" };
    }
    return { ok: true };
  }

  // Also reject Sec-Fetch-Site: cross-site if reported by modern browsers
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") {
    return { ok: false, reason: "Cross-site fetch rejected" };
  }

  // Non-browser API/CLI calls authenticated with explicit Authorization header (not cookies)
  // are not vulnerable to ambient browser cookie CSRF; however, browser cookie sessions
  // in production should supply Origin or Referer on cross-origin/form posts.
  const hasSessionCookie = Boolean(
    req.cookies.get("office_store_session")?.value || req.cookies.get("__session")?.value
  );
  const hasBearerAuth = Boolean(req.headers.get("authorization"));

  if (hasSessionCookie && !hasBearerAuth && fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return { ok: false, reason: "Missing Origin/Referer for cookie-authenticated mutation" };
  }

  return { ok: true };
}

/**
 * Utility functions for detecting mock service modes and placeholder credentials.
 */

export function isMockKey(key: string | undefined | null): boolean {
  if (!key) return true;
  const k = key.trim().toLowerCase();
  return (
    k === "" ||
    k === "undefined" ||
    k === "null" ||
    k.includes("placeholder") ||
    k.includes("mock") ||
    k.includes("dummy") ||
    k.includes("example.com") ||
    k.startsWith("pk_test_placeholder") ||
    k.startsWith("sk_test_placeholder")
  );
}

export function isDatabaseMocked(): boolean {
  if (process.env.MOCK_DATABASE === "false") return false;
  if (process.env.MOCK_DATABASE === "true") return true;
  if (process.env.ENABLE_MOCK_SERVICES === "true") return true;

  const url = process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL;
  if (!url || isMockKey(url)) return true;

  const lower = url.trim().toLowerCase();
  return (
    lower.includes("ep-mock") ||
    lower.includes("mock.neon.tech") ||
    lower.startsWith("postgres://mock") ||
    lower.startsWith("postgresql://mock")
  );
}

export function isServiceMocked(
  service: "clerk" | "neon" | "redis" | "qstash" | "r2" | "resend"
): boolean {
  if (process.env.ENABLE_MOCK_SERVICES === "true") return true;

  switch (service) {
    case "neon":
      return isDatabaseMocked();
    case "clerk":
      return !isClerkConfigured();
    case "redis":
      return (
        isMockKey(process.env.UPSTASH_REDIS_REST_URL) ||
        isMockKey(process.env.UPSTASH_REDIS_REST_TOKEN)
      );
    case "qstash":
      return isMockKey(process.env.QSTASH_TOKEN);
    case "r2":
      return (
        isMockKey(process.env.R2_ACCESS_KEY_ID) ||
        isMockKey(process.env.R2_SECRET_ACCESS_KEY) ||
        isMockKey(process.env.R2_ACCOUNT_ID) ||
        isMockKey(process.env.R2_BUCKET_NAME)
      );
    case "resend":
      return isMockKey(process.env.RESEND_API_KEY);
    default:
      return false;
  }
}

/**
 * Verifies that Clerk has non-placeholder, syntactically valid publishable and secret keys
 * and that mock services are not forcing placeholder mode.
 */
export function isClerkConfigured(): boolean {
  if (process.env.ENABLE_MOCK_SERVICES === "true") return false;
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  const sk = process.env.CLERK_SECRET_KEY?.trim();
  if (!pk || !sk || isMockKey(pk) || isMockKey(sk)) return false;
  return (
    /^pk_(test|live)_[A-Za-z0-9+/=_-]{16,}$/.test(pk) &&
    /^sk_(test|live)_[A-Za-z0-9_-]{16,}$/.test(sk)
  );
}

/**
 * Demo persona switching is strictly disabled in production unless explicitly
 * opted in via ALLOW_DEMO_AUTH="true" (and never when Clerk is active).
 */
export function isDemoAuthEnabled(): boolean {
  if (isClerkConfigured()) return false;
  if (process.env.ALLOW_DEMO_AUTH === "true") return true;
  return process.env.NODE_ENV !== "production" && process.env.ENABLE_MOCK_SERVICES === "true";
}

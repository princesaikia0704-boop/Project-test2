/**
 * Structured Server-Side Security Logger & Secret Redaction Engine.
 * Edge + Node Runtime compatible. Never emits raw passwords, tokens, cookies,
 * or connection strings to logs or HTTP responses.
 */

export type SecurityEventType =
  | "AUTH_LOGIN_SUCCESS"
  | "AUTH_LOGIN_FAILURE"
  | "AUTH_REGISTER"
  | "AUTH_LOGOUT"
  | "AUTH_LOCKOUT"
  | "AUTH_DEMO_SESSION"
  | "AUTH_PASSWORD_RESET_REQUEST"
  | "AUTH_PASSWORD_RESET_SUCCESS"
  | "AUTH_PASSWORD_RESET_INVALID"
  | "AUTH_SESSION_INVALID"
  | "RBAC_ACCESS_DENIED"
  | "PRIVILEGE_ESCALATION_ATTEMPT"
  | "IDOR_ATTEMPT"
  | "RATE_LIMIT_TRIGGERED"
  | "CSRF_ORIGIN_BLOCKED"
  | "CORS_ORIGIN_BLOCKED"
  | "SSRF_BLOCKED"
  | "UPLOAD_REJECTED"
  | "VALIDATION_ANOMALY"
  | "UNHANDLED_SERVER_ERROR"
  | "MISCONFIGURED_AUTH_SECRET";

export type SecuritySeverity = "INFO" | "WARN" | "HIGH" | "CRITICAL";

export interface SecurityEventInput {
  event: SecurityEventType;
  severity?: SecuritySeverity;
  userId?: string | null;
  role?: string | null;
  ip?: string | null;
  path?: string | null;
  method?: string | null;
  reason?: string;
  metadata?: Record<string, unknown>;
}

const SENSITIVE_KEY_REGEX =
  /password|passwd|secret|token|authorization|cookie|set-cookie|apikey|api_key|signing_key|private_key|resettoken|session/i;

/**
 * Redacts PostgreSQL URLs, API keys, Clerk keys, QStash signing keys,
 * Bearer tokens, and Upstash/Resend secrets from strings.
 */
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

function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[TRUNCATED]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return sanitizeErrorMessage(value).slice(0, 500);
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => scrubValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_REGEX.test(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = scrubValue(v, depth + 1);
      }
    }
    return out;
  }
  return String(value);
}

/**
 * Emits a structured JSON security telemetry event to server logs.
 */
export function logSecurityEvent(input: SecurityEventInput): void {
  const entry = {
    timestamp: new Date().toISOString(),
    channel: "SECURITY_AUDIT",
    severity: input.severity ?? "WARN",
    event: input.event,
    userId: input.userId ?? null,
    role: input.role ?? null,
    ip: input.ip ?? null,
    method: input.method ?? null,
    path: input.path ?? null,
    reason: input.reason ? sanitizeErrorMessage(input.reason) : undefined,
    metadata: input.metadata ? scrubValue(input.metadata) : undefined,
  };

  const serialized = JSON.stringify(entry);
  if (entry.severity === "CRITICAL" || entry.severity === "HIGH") {
    console.error(serialized);
  } else if (entry.severity === "WARN") {
    console.warn(serialized);
  } else {
    console.info(serialized);
  }
}

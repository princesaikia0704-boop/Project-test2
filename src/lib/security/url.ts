/**
 * URL, Open-Redirect, ILIKE Wildcard, and CSV Formula Sanitization Helpers.
 * Edge + Node + Browser compatible.
 */

export interface SafeUrlOptions {
  allowRelative?: boolean;
  allowDataImage?: boolean;
}

const SAFE_DATA_IMAGE_REGEX = /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i;

/**
 * Validates and normalizes a URL to prevent javascript:, vbscript:,
 * data:text/html, data:image/svg+xml, and protocol-relative //evil.com XSS/open redirects.
 * Returns null if invalid or unsafe.
 */
export function sanitizeSafeUrl(
  rawUrl: string | null | undefined,
  options: SafeUrlOptions = {}
): string | null {
  const { allowRelative = true, allowDataImage = false } = options;
  if (!rawUrl || typeof rawUrl !== "string") return null;

  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  // Reject control characters / whitespace injection in URL schemes
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) return null;

  if (allowDataImage && SAFE_DATA_IMAGE_REGEX.test(trimmed)) {
    return trimmed;
  }

  // Allow safe same-origin relative paths (e.g. /uploads/foo.png, /logo.svg),
  // explicitly blocking protocol-relative //host and /\host.
  if (trimmed.startsWith("/")) {
    if (!allowRelative) return null;
    if (trimmed.startsWith("//") || trimmed.startsWith("/\\")) return null;
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Validates redirect targets so login redirects can NEVER redirect off-site
 * or execute javascript:/data: URIs.
 */
export function sanitizeRedirectPath(
  rawRedirect: string | null | undefined,
  fallback = "/"
): string {
  if (!rawRedirect || typeof rawRedirect !== "string") return fallback;
  const trimmed = rawRedirect.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("/\\") ||
    trimmed.includes("\\") ||
    /[\u0000-\u001F\u007F]/.test(trimmed)
  ) {
    return fallback;
  }
  try {
    const testUrl = new URL(trimmed, "http://localhost.internal");
    if (testUrl.origin !== "http://localhost.internal") return fallback;
    return `${testUrl.pathname}${testUrl.search}${testUrl.hash}`;
  } catch {
    return fallback;
  }
}

/**
 * Neutralizes CSV/Spreadsheet formula injection (=, +, -, @, tab, CR)
 * and safely quotes RFC 4180 cells.
 */
export function escapeCsvCell(value: unknown): string {
  let s = String(value ?? "");
  // Prefix dangerous leading characters that spreadsheets evaluate as formulas
  if (/^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`;
  }
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Escapes PostgreSQL LIKE/ILIKE pattern metacharacters (%, _, \).
 */
export function escapeLikePattern(term: string): string {
  return term.replace(/[\\%_]/g, "\\$&");
}

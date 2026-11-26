/**
 * SSRF Guard for Outbound Server Fetches (e.g., CSV Worker fetching uploaded files).
 * Node.js runtime only (uses node:dns/promises and node:net).
 */

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split(".").map((n) => parseInt(n, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a >= 224) return true; // Multicast / reserved
  return false;
}

function isPrivateOrReservedIp(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (isIP(normalized) === 4) {
    return isPrivateOrReservedIpv4(normalized);
  }
  if (isIP(normalized) === 6) {
    if (normalized === "::1" || normalized === "::") return true;
    if (normalized.startsWith("::ffff:")) {
      return isPrivateOrReservedIpv4(normalized.slice(7));
    }
    if (normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")) {
      return true;
    }
    return false;
  }
  return true;
}

function getAllowedStorageHosts(): string[] {
  const hosts = new Set<string>();
  const r2Public = process.env.R2_PUBLIC_URL?.trim();
  if (r2Public) {
    try {
      hosts.add(new URL(r2Public).hostname.toLowerCase());
    } catch {
      // ignore invalid URL
    }
  }
  const r2Account = process.env.R2_ACCOUNT_ID?.trim();
  if (r2Account && !r2Account.includes("mock")) {
    hosts.add(`${r2Account.toLowerCase()}.r2.cloudflarestorage.com`);
  }
  return Array.from(hosts);
}

function isAllowedStorageHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  const explicit = getAllowedStorageHosts();
  if (explicit.includes(lower)) return true;

  // Match configured Cloudflare R2 endpoints
  if (/^[a-z0-9-]+\.r2\.cloudflarestorage\.com$/i.test(lower)) return true;
  if (/^pub-[a-z0-9]+\.r2\.dev$/i.test(lower)) return true;

  return false;
}

/**
 * Validates that an outbound file fetch URL:
 * 1. Uses HTTPS (never file:, http:, ftp:, gopher:)
 * 2. Matches the configured object storage host allowlist
 * 3. Does not target loopback, private RFC1918, or cloud metadata (169.254.169.254) IPs
 */
export async function validateExternalStorageUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error("Invalid storage URL format");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Only HTTPS storage URLs are permitted");
  }

  if (parsed.username || parsed.password) {
    throw new Error("Credentials in URL are prohibited");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".local")
  ) {
    throw new Error("Local/internal hostnames are prohibited");
  }

  if (isIP(hostname) !== 0) {
    throw new Error("Direct IP addresses are prohibited for storage URLs");
  }

  if (!isAllowedStorageHostname(hostname)) {
    throw new Error("Storage host is not in allowlist");
  }

  const resolved = await lookup(hostname, { all: true });
  if (!resolved || resolved.length === 0) {
    throw new Error("Unable to resolve storage hostname");
  }
  for (const addr of resolved) {
    if (isPrivateOrReservedIp(addr.address)) {
      throw new Error("Resolved IP belongs to restricted private/metadata range");
    }
  }

  return parsed;
}

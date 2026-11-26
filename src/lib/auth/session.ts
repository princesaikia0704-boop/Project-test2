/**
 * Edge & Node Compatible Signed Session Cookie Management.
 * Uses Web Crypto HMAC-SHA256 with HttpOnly, Secure, SameSite=Lax, and explicit expiry.
 * Zero trust: never reads unsigned mock_* cookies or client x-user-* headers.
 */

import type { NextResponse } from "next/server";

export type UserRole = "EMPLOYEE" | "MANAGER" | "ADMIN";

export const SESSION_COOKIE_NAME = "office_store_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24 hours

export interface SessionPayload {
  sub: string; // user UUID
  role: UserRole;
  dept: string; // department UUID
  email: string;
  name: string;
  ver: number; // sessionVersion for instant revocation on password reset
  demo?: boolean;
  iat: number; // issued at (unix seconds)
  exp: number; // expires at (unix seconds)
  jti: string; // unique token id
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): Uint8Array | null {
  try {
    const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (input.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

function getSessionSecretString(): string | null {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured && configured.length >= 16) {
    return configured;
  }

  const clerkSecret = process.env.CLERK_SECRET_KEY?.trim();
  if (clerkSecret && !clerkSecret.includes("placeholder") && clerkSecret.length >= 24) {
    return `clerk-derived:${clerkSecret}`;
  }

  // In production, never fall back to any static or predictable signing key
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return (
    process.env.DATABASE_URL?.trim() ||
    "dev-only-local-session-signing-key-not-for-production"
  );
}

async function importHmacKey(secret: string, usage: ("sign" | "verify")[]): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  return await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    usage
  );
}

export async function signSessionToken(
  input: Omit<SessionPayload, "iat" | "exp" | "jti">,
  ttlSeconds = SESSION_TTL_SECONDS
): Promise<string> {
  const secret = getSessionSecretString();
  if (!secret) {
    throw new Error("SESSION_SECRET must be configured in production (minimum 32 characters)");
  }

  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    ...input,
    iat: now,
    exp: now + ttlSeconds,
    jti: crypto.randomUUID(),
  };

  const encoder = new TextEncoder();
  const encodedPayload = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const key = await importHmacKey(secret, ["sign"]);
  const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(encodedPayload));
  const encodedSig = toBase64Url(new Uint8Array(sigBuffer));

  return `${encodedPayload}.${encodedSig}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [encodedPayload, encodedSig] = parts;
  if (!encodedPayload || !encodedSig) return null;

  const secret = getSessionSecretString();
  if (!secret) return null;

  const sigBytes = fromBase64Url(encodedSig);
  const payloadBytes = fromBase64Url(encodedPayload);
  if (!sigBytes || !payloadBytes) return null;

  try {
    const key = await importHmacKey(secret, ["verify"]);
    const encoder = new TextEncoder();
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes.buffer as ArrayBuffer,
      encoder.encode(encodedPayload)
    );
    if (!isValid) return null;

    const decoded = JSON.parse(new TextDecoder().decode(payloadBytes)) as SessionPayload;
    if (
      !decoded ||
      typeof decoded.sub !== "string" ||
      typeof decoded.role !== "string" ||
      typeof decoded.exp !== "number"
    ) {
      return null;
    }

    if (decoded.role !== "EMPLOYEE" && decoded.role !== "MANAGER" && decoded.role !== "ADMIN") {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp <= now) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

export function getSessionCookieOptions(maxAgeSeconds = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export function attachSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions(SESSION_TTL_SECONDS));
}

export function clearSessionCookies(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE_NAME, "", getSessionCookieOptions(0));
  // Clear legacy mock cookies if any exist in older browsers
  for (const legacyName of ["mock_persona", "mock_user_role", "mock_token"]) {
    res.cookies.set(legacyName, "", {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
}

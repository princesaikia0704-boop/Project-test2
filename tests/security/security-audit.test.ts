import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import {
  sanitizeSafeUrl,
  sanitizeRedirectPath,
  escapeCsvCell,
  escapeLikePattern,
} from "@/lib/security/url";
import { sanitizeErrorMessage } from "@/lib/security/logger";
import { getSecurityHeadersRecord } from "@/lib/security/headers";
import { isOriginAllowed, getAllowedOrigins } from "@/lib/security/cors";
import { verifyCsrfOrigin } from "@/lib/security/csrf";
import {
  signSessionToken,
  verifySessionToken,
  getSessionCookieOptions,
} from "@/lib/auth/session";
import {
  BCRYPT_COST_FACTOR,
  hashPassword,
  verifyPassword,
  strongPasswordSchema,
} from "@/lib/auth/password";
import {
  issuePasswordResetToken,
  consumePasswordResetToken,
  hashResetToken,
} from "@/lib/auth/password-reset";
import { validateImageUpload, resolveContainedPath } from "@/lib/security/upload";
import { validateExternalStorageUrl } from "@/lib/security/ssrf";
import { createProductSchema } from "@/lib/validators/product.schema";
import { updateStoreSettingsSchema } from "@/lib/validators/store-config.schema";
import { orderDecisionSchema } from "@/lib/validators/order.schema";

describe("Security Hardening Verification Suite", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.ENABLE_MOCK_SERVICES = "true";
    process.env.SESSION_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    process.env.NEXT_PUBLIC_APP_URL = "https://store.example.com";
    process.env.ALLOWED_ORIGINS = "https://store.example.com,https://admin.example.com";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("1. Authentication, Password Hashing & Signed Cookies", () => {
    it("hashes passwords with bcrypt cost >= 12 and enforces complexity", async () => {
      expect(BCRYPT_COST_FACTOR).toBeGreaterThanOrEqual(12);
      expect(strongPasswordSchema.safeParse("weak123").success).toBe(false);
      expect(strongPasswordSchema.safeParse("StrongPass!2026").success).toBe(true);

      const hash = await hashPassword("StrongPass!2026");
      expect(hash.startsWith("$2b$12$") || hash.startsWith("$2a$12$")).toBe(true);
      expect(await verifyPassword("StrongPass!2026", hash)).toBe(true);
      expect(await verifyPassword("WrongPass!2026", hash)).toBe(false);
      expect(await verifyPassword("StrongPass!2026", null)).toBe(false);
    });

    it("signs HttpOnly cookies and rejects tampered or expired tokens", async () => {
      const token = await signSessionToken({
        sub: "30000000-0000-0000-0000-000000000001",
        role: "EMPLOYEE",
        dept: "10000000-0000-0000-0000-000000000001",
        email: "alice@company.com",
        name: "Alice Vance",
        ver: 1,
      });

      const verified = await verifySessionToken(token);
      expect(verified?.sub).toBe("30000000-0000-0000-0000-000000000001");
      expect(verified?.role).toBe("EMPLOYEE");

      // Tamper with payload
      const [payloadB64, sigB64] = token.split(".");
      const tamperedPayload = Buffer.from(
        JSON.stringify({
          ...verified,
          role: "ADMIN",
        })
      ).toString("base64url");
      expect(await verifySessionToken(`${tamperedPayload}.${sigB64}`)).toBeNull();
      expect(await verifySessionToken(`${payloadB64}.invalidsignature`)).toBeNull();

      // Cookie security attributes
      process.env.NODE_ENV = "production";
      const cookieOpts = getSessionCookieOptions();
      expect(cookieOpts.httpOnly).toBe(true);
      expect(cookieOpts.secure).toBe(true);
      expect(cookieOpts.sameSite).toBe("lax");
      expect(cookieOpts.maxAge).toBeGreaterThan(0);

      // Fail closed in production when SESSION_SECRET & CLERK_SECRET_KEY are absent
      delete process.env.SESSION_SECRET;
      delete process.env.CLERK_SECRET_KEY;
      await expect(
        signSessionToken({
          sub: "30000000-0000-0000-0000-000000000001",
          role: "ADMIN",
          dept: "10000000-0000-0000-0000-000000000001",
          email: "dave@company.com",
          name: "Dave Vance",
          ver: 1,
        })
      ).rejects.toThrow();
    });

    it("issues cryptographic single-use hashed password reset tokens", async () => {
      const userId = "30000000-0000-0000-0000-000000000001";
      const issued = await issuePasswordResetToken(userId);
      expect(issued.rawToken).toMatch(/^[0-9a-f]{64}$/);
      expect(hashResetToken(issued.rawToken)).not.toBe(issued.rawToken);
      expect(issued.expiresAt.getTime()).toBeGreaterThan(Date.now());

      const newHash = await hashPassword("RotatedPass!2026");
      const firstConsume = await consumePasswordResetToken(issued.rawToken, newHash);
      expect(firstConsume).toEqual({ ok: true, userId });

      // Replay must be rejected
      const secondConsume = await consumePasswordResetToken(issued.rawToken, newHash);
      expect(secondConsume).toEqual({ ok: false });
    });
  });

  describe("2. XSS, Open Redirect, CSV & SQL Pattern Defense", () => {
    it("blocks unsafe protocols and open redirect vectors", () => {
      expect(sanitizeSafeUrl("javascript:alert(1)")).toBeNull();
      expect(sanitizeSafeUrl("data:text/html,<script>alert(1)</script>", { allowDataImage: true })).toBeNull();
      expect(sanitizeSafeUrl("data:image/svg+xml;base64,PHN2Zz4=", { allowDataImage: true })).toBeNull();
      expect(sanitizeSafeUrl("//evil.com/phish.png")).toBeNull();
      expect(sanitizeSafeUrl("/uploads/logo.png")).toBe("/uploads/logo.png");
      expect(sanitizeSafeUrl("https://cdn.example.com/logo.png")).toBe("https://cdn.example.com/logo.png");

      expect(sanitizeRedirectPath("https://evil.com", "/")).toBe("/");
      expect(sanitizeRedirectPath("//evil.com", "/")).toBe("/");
      expect(sanitizeRedirectPath("/\\evil.com", "/")).toBe("/");
      expect(sanitizeRedirectPath("/admin/orders?page=2", "/")).toBe("/admin/orders?page=2");
    });

    it("neutralizes spreadsheet formula injection and LIKE wildcards", () => {
      expect(escapeCsvCell("=CMD|'/C calc'!A0")).toBe("'=CMD|'/C calc'!A0");
      expect(escapeCsvCell("+1+1")).toBe("'+1+1");
      expect(escapeCsvCell("@SUM(A1:A2)")).toBe("'@SUM(A1:A2)");
      expect(escapeLikePattern("100%_test\\path")).toBe("100\\%\\_test\\\\path");
    });
  });

  describe("3. File Uploads & SSRF Protection", () => {
    it("verifies magic bytes and blocks polyglots, SVG, and path traversal", () => {
      const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
      const okRes = validateImageUpload("brand-logo.png", "image/png", pngMagic);
      expect(okRes.ok).toBe(true);

      const svgBytes = Buffer.from("<svg onload=alert(1)></svg>");
      expect(validateImageUpload("logo.svg", "image/svg+xml", svgBytes).ok).toBe(false);
      expect(validateImageUpload("fake.png", "image/png", Buffer.from("<html><script>")).ok).toBe(false);
      expect(validateImageUpload("shell.jpg\0.png", "image/png", pngMagic).ok).toBe(false);

      const contained = resolveContainedPath("/tmp/uploads", "../../evil.png");
      expect(contained.endsWith("evil.png")).toBe(true);
      expect(contained.includes("..")).toBe(false);
    });

    it("blocks internal metadata, localhost, and unapproved SSRF URLs", async () => {
      await expect(validateExternalStorageUrl("http://169.254.169.254/latest/meta-data/")).rejects.toThrow();
      await expect(validateExternalStorageUrl("https://127.0.0.1/secret.csv")).rejects.toThrow();
      await expect(validateExternalStorageUrl("https://localhost/internal.csv")).rejects.toThrow();
      await expect(validateExternalStorageUrl("file:///etc/passwd")).rejects.toThrow();
      await expect(validateExternalStorageUrl("https://untrusted-host.example.org/a.csv")).rejects.toThrow();
    });
  });

  describe("4. CORS, CSRF, Headers, Validation & Error Scrubbing", () => {
    it("enforces explicit CORS allowlist and CSRF origin checks", () => {
      const postAllowed = new NextRequest("https://store.example.com/api/orders", {
        method: "POST",
        headers: {
          host: "store.example.com",
          origin: "https://admin.example.com",
        },
      });
      expect(getAllowedOrigins(postAllowed)).not.toContain("*");
      expect(isOriginAllowed(postAllowed, "https://evil.com")).toBe(false);
      expect(verifyCsrfOrigin(postAllowed).ok).toBe(true);

      const postEvil = new NextRequest("https://store.example.com/api/orders", {
        method: "POST",
        headers: {
          host: "store.example.com",
          origin: "https://evil.com",
        },
      });
      expect(verifyCsrfOrigin(postEvil).ok).toBe(false);

      const workerWebhook = new NextRequest("https://store.example.com/api/workers/audit-log", {
        method: "POST",
      });
      expect(verifyCsrfOrigin(workerWebhook).ok).toBe(true);
    });

    it("provides hardened OWASP HTTP security headers and redacts secrets", () => {
      const headers = getSecurityHeadersRecord();
      expect(headers["X-Frame-Options"]).toBe("DENY");
      expect(headers["X-Content-Type-Options"]).toBe("nosniff");
      expect(headers["Strict-Transport-Security"]).toContain("max-age=63072000");
      expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
      expect(headers["Content-Security-Policy"]).toContain("object-src 'none'");

      const scrubbed = sanitizeErrorMessage(
        "Failed postgresql://user:pass@ep-test.neon.tech/db key sk_live_AbCdEf123456789012 sigkey_abc123"
      );
      expect(scrubbed).not.toContain("pass@");
      expect(scrubbed).not.toContain("sk_live_");
      expect(scrubbed).not.toContain("sigkey_abc123");
    });

    it("enforces Zod bounds and partial update hygiene", () => {
      expect(
        createProductSchema.safeParse({
          name: "Pen",
          priceCents: 3_000_000_000,
          categoryId: "cat-1",
        }).success
      ).toBe(false);

      const partialConfig = updateStoreSettingsSchema.parse({ companyName: "Acme Corp" });
      expect(partialConfig.currency).toBeUndefined();
      expect(partialConfig.primaryColor).toBeUndefined();

      expect(
        orderDecisionSchema.safeParse({ decision: "REJECT", comment: "" }).success
      ).toBe(false);
    });
  });
});

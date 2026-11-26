/**
 * Secure File Upload Validation (MIME, Extension Allowlist, Magic Bytes & Path Safety).
 * Node.js runtime only.
 */

import path from "node:path";
import crypto from "node:crypto";

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export const ALLOWED_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif"] as const;

export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

/**
 * Inspects file magic bytes to detect true image container format independent
 * of client-supplied MIME headers or filenames.
 */
export function detectImageMimeFromMagicBytes(buffer: Buffer): AllowedImageMime | null {
  if (!buffer || buffer.length < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  // GIF: GIF87a or GIF89a
  const header6 = buffer.subarray(0, 6).toString("ascii");
  if (header6 === "GIF87a" || header6 === "GIF89a") {
    return "image/gif";
  }

  // WebP: RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

const MIME_TO_CANONICAL_EXT: Record<AllowedImageMime, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const EXT_TO_EXPECTED_MIME: Record<string, AllowedImageMime> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export interface ValidatedImageUpload {
  mimeType: AllowedImageMime;
  canonicalFilename: string;
}

/**
 * Performs Defense-in-Depth validation on uploaded image files:
 * 1. Rejects path traversal / null bytes in original filename
 * 2. Checks extension allowlist (blocks .svg, .html, .js, .exe, etc.)
 * 3. Checks declared MIME allowlist
 * 4. Verifies magic bytes match the declared type and extension
 * 5. Generates a collision-free UUID filename
 */
export function validateImageUpload(
  originalName: string,
  declaredMimeType: string,
  buffer: Buffer
): { ok: true; data: ValidatedImageUpload } | { ok: false; reason: string } {
  if (!originalName || originalName.includes("\0")) {
    return { ok: false, reason: "Invalid filename" };
  }

  const baseName = path.basename(originalName);
  const ext = path.extname(baseName).toLowerCase();

  if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext as (typeof ALLOWED_IMAGE_EXTENSIONS)[number])) {
    return {
      ok: false,
      reason: "Unsupported file extension. Allowed: PNG, JPG, JPEG, WebP, GIF",
    };
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.includes(declaredMimeType as AllowedImageMime)) {
    return {
      ok: false,
      reason: "Unsupported MIME type. Allowed: image/png, image/jpeg, image/webp, image/gif",
    };
  }

  const detectedMime = detectImageMimeFromMagicBytes(buffer);
  if (!detectedMime) {
    return {
      ok: false,
      reason: "File content does not match a valid PNG, JPEG, WebP, or GIF signature",
    };
  }

  if (detectedMime !== declaredMimeType || EXT_TO_EXPECTED_MIME[ext] !== detectedMime) {
    return {
      ok: false,
      reason: "File signature does not match declared extension or MIME type",
    };
  }

  const canonicalExt = MIME_TO_CANONICAL_EXT[detectedMime];
  const canonicalFilename = `${Date.now()}-${crypto.randomUUID()}${canonicalExt}`;

  return {
    ok: true,
    data: {
      mimeType: detectedMime,
      canonicalFilename,
    },
  };
}

/**
 * Ensures resolved target path strictly remains within baseDir (prevents path traversal).
 */
export function resolveContainedPath(baseDir: string, filename: string): string {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(resolvedBase, path.basename(filename));
  if (!resolvedTarget.startsWith(resolvedBase + path.sep)) {
    throw new Error("Path traversal detected");
  }
  return resolvedTarget;
}

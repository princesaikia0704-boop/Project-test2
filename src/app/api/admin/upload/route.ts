/**
 * POST /api/admin/upload
 * Hardened image upload endpoint:
 * - Strict ADMIN RBAC via withApiReliability
 * - Rejects SVG / HTML / JS / executables (prevents same-origin Stored XSS)
 * - Enforces extension allowlist, MIME allowlist, AND magic-byte signature verification
 * - Caps file size (5MB) and checks Content-Length prior to parsing
 * - Generates collision-free UUID filenames with path containment validation
 */

import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { withApiReliability, createErrorResponse, getRequestAuth } from "@/lib/http/api-handler";
import { validateImageUpload, resolveContainedPath } from "@/lib/security/upload";
import { logSecurityEvent } from "@/lib/security/logger";
import { extractTrustedClientIp } from "@/lib/security/rate-limit";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_MULTIPART_CONTENT_LENGTH = 6 * 1024 * 1024; // 6 MB overhead allowance

export const POST = withApiReliability(
  async (req: NextRequest): Promise<NextResponse> => {
    const authUser = await getRequestAuth(req);
    const clientIp = extractTrustedClientIp(req);

    const contentLengthHeader = req.headers.get("content-length");
    if (contentLengthHeader) {
      const contentLength = Number(contentLengthHeader);
      if (Number.isFinite(contentLength) && contentLength > MAX_MULTIPART_CONTENT_LENGTH) {
        return createErrorResponse("PayloadTooLarge", "Upload exceeds maximum allowed size (5 MB)", 413);
      }
    }

    const formData = await req.formData();
    const fileEntry = formData.get("file");

    if (!fileEntry || !(fileEntry instanceof File)) {
      return createErrorResponse("ValidationError", "No valid file provided", 400);
    }

    if (fileEntry.size <= 0) {
      return createErrorResponse("ValidationError", "Uploaded file cannot be empty", 400);
    }

    if (fileEntry.size > MAX_SIZE_BYTES) {
      return createErrorResponse(
        "PayloadTooLarge",
        `File too large (${(fileEntry.size / 1024 / 1024).toFixed(1)} MB). Max: 5 MB`,
        400
      );
    }

    const buffer = Buffer.from(await fileEntry.arrayBuffer());
    if (buffer.length > MAX_SIZE_BYTES) {
      return createErrorResponse("PayloadTooLarge", "File exceeds maximum 5 MB limit", 400);
    }

    const validated = validateImageUpload(fileEntry.name, fileEntry.type, buffer);
    if (!validated.ok) {
      logSecurityEvent({
        event: "UPLOAD_REJECTED",
        severity: "WARN",
        userId: authUser?.id ?? null,
        role: authUser?.role ?? null,
        ip: clientIp,
        path: "/api/admin/upload",
        method: "POST",
        reason: validated.reason,
        metadata: { declaredMime: fileEntry.type, size: fileEntry.size },
      });
      return createErrorResponse("DisallowedFileType", validated.reason, 400);
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });
    const targetPath = resolveContainedPath(uploadDir, validated.data.canonicalFilename);
    await writeFile(targetPath, buffer);

    const url = `/uploads/${validated.data.canonicalFilename}`;
    return NextResponse.json({ url }, { status: 200 });
  },
  { allowedRoles: ["ADMIN"] }
);

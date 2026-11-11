import { NextRequest, NextResponse } from "next/server";
import { withApiReliability, createErrorResponse } from "@/lib/http/api-handler";
import { generatePresignedUploadUrl } from "@/services/storage.service";
import { DomainError } from "@/services/order.service";

export const POST = withApiReliability(
  async (req: NextRequest) => {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return createErrorResponse(
        "ValidationError",
        "Request body must be valid JSON",
        400
      );
    }

    if (!body || typeof body !== "object") {
      return createErrorResponse(
        "MissingFilename",
        "Filename is required",
        400
      );
    }

    if (!body.filename || typeof body.filename !== "string" || !body.filename.trim()) {
      return createErrorResponse(
        "MissingFilename",
        "Filename is required",
        400
      );
    }

    if (body.fileSizeBytes !== undefined && (typeof body.fileSizeBytes !== "number" || body.fileSizeBytes > 10 * 1024 * 1024)) {
      return createErrorResponse(
        "PayloadTooLarge",
        "File size exceeds 10MB limit",
        400
      );
    }

    const disallowedExts = [".sh", ".exe", ".bat", ".cmd", ".ps1", ".js", ".vbs"];
    if (disallowedExts.some((ext) => body.filename.toLowerCase().endsWith(ext))) {
      return createErrorResponse(
        "DisallowedFileType",
        "Executable files are prohibited",
        400
      );
    }

    const adminUserId = req.headers.get("x-user-id") || "admin";

    try {
      const result = await generatePresignedUploadUrl({
        filename: body.filename.trim(),
        fileSizeBytes: body.fileSizeBytes,
        contentType: body.contentType,
        adminUserId,
      });

      return NextResponse.json(
        {
          success: true,
          key: result.key,
          presignedUrl: result.presignedUrl,
          expiresInSeconds: result.expiresInSeconds,
        },
        { status: 200 }
      );
    } catch (err: any) {
      if (err instanceof DomainError) {
        return createErrorResponse(err.name, err.message, err.statusCode);
      }
      throw err;
    }
  },
  { allowedRoles: ["ADMIN"] }
);

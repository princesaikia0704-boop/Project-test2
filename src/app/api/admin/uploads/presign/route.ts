import { NextRequest, NextResponse } from "next/server";
import { withApiReliability, createErrorResponse, getRequestAuth } from "@/lib/http/api-handler";
import { generatePresignedUploadUrl } from "@/services/storage.service";
import { DomainError } from "@/services/order.service";
import { presignUploadSchema } from "@/lib/validators/store-config.schema";
import { logSecurityEvent } from "@/lib/security/logger";
import { extractTrustedClientIp } from "@/lib/security/rate-limit";

export const POST = withApiReliability(
  async (req: NextRequest) => {
    const authUser = await getRequestAuth(req);
    if (!authUser) {
      return createErrorResponse("Unauthorized", "Authentication required", 401);
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return createErrorResponse(
        "ValidationError",
        "Request body must be valid JSON",
        400
      );
    }

    const parsed = presignUploadSchema.safeParse(rawBody);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || "Invalid presign upload request";
      const code = msg.toLowerCase().includes("10mb")
        ? "PayloadTooLarge"
        : msg.toLowerCase().includes("filename")
        ? "MissingFilename"
        : "ValidationError";
      return createErrorResponse(code, msg, 400);
    }

    try {
      const result = await generatePresignedUploadUrl({
        filename: parsed.data.filename,
        fileSizeBytes: parsed.data.fileSizeBytes,
        contentType: parsed.data.contentType,
        adminUserId: authUser.id,
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
        logSecurityEvent({
          event: "UPLOAD_REJECTED",
          severity: "WARN",
          userId: authUser.id,
          role: authUser.role,
          ip: extractTrustedClientIp(req),
          path: "/api/admin/uploads/presign",
          method: "POST",
          reason: err.message,
        });
        return createErrorResponse(err.name, err.message, err.statusCode);
      }
      throw err;
    }
  },
  { allowedRoles: ["ADMIN"] }
);

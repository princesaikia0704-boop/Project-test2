import { NextRequest, NextResponse } from "next/server";
import { withApiReliability, createErrorResponse } from "@/lib/http/api-handler";
import { getStoreSettings, updateStoreSettings } from "@/services/store-config.service";
import { DomainError } from "@/services/order.service";

export const GET = withApiReliability(
  async () => {
    const settings = await getStoreSettings();
    return NextResponse.json(
      {
        success: true,
        settings,
      },
      { status: 200 }
    );
  },
  { allowedRoles: ["ADMIN"] }
);

export const PUT = withApiReliability(
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
        "ValidationError",
        "Configuration payload is required",
        400
      );
    }

    if (body.autoApproveLimitCents !== undefined && (typeof body.autoApproveLimitCents !== "number" || body.autoApproveLimitCents < 0)) {
      return createErrorResponse(
        "InvalidThreshold",
        "Approval threshold cannot be negative",
        400
      );
    }

    if (body.primaryColor !== undefined) {
      const hex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
      if (!hex.test(body.primaryColor)) {
        return createErrorResponse(
          "InvalidColor",
          "Primary color must be valid hex code",
          400
        );
      }
    }

    const adminUserId = req.headers.get("x-user-id") || "admin";

    try {
      const updated = await updateStoreSettings({
        autoApproveLimitCents: body.autoApproveLimitCents,
        companyName: body.companyName,
        primaryColor: body.primaryColor,
        logoUrl: body.logoUrl,
        currency: body.currency,
        adminUserId,
      });

      return NextResponse.json(
        {
          success: true,
          settings: updated,
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

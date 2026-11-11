import { NextRequest, NextResponse } from "next/server";
import { withApiReliability, createErrorResponse } from "@/lib/http/api-handler";
import { adjustProductStock } from "@/services/inventory.service";
import { DomainError } from "@/services/order.service";

export const POST = withApiReliability(
  async (req: NextRequest, context?: { params: Promise<{ productId: string }> | { productId: string } }) => {
    const params = context?.params ? await context.params : null;
    const productId = params?.productId;

    if (!productId) {
      return createErrorResponse("InvalidProductId", "Product ID is required", 400);
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return createErrorResponse(
        "InvalidOrderPayload",
        "Request body must be valid JSON",
        400
      );
    }

    if (!body || typeof body !== "object") {
      return createErrorResponse(
        "MissingReason",
        "Adjustment reason is required",
        400
      );
    }

    if (!body.reason || typeof body.reason !== "string" || !body.reason.trim()) {
      return createErrorResponse(
        "MissingReason",
        "Adjustment reason is required",
        400
      );
    }

    const adminUserId = req.headers.get("x-user-id") || "admin";

    try {
      const result = await adjustProductStock({
        productId,
        newQuantity: typeof body.newQuantity === "number" ? body.newQuantity : undefined,
        delta: typeof body.delta === "number" ? body.delta : undefined,
        reason: body.reason.trim(),
        adminUserId,
      });

      return NextResponse.json(
        {
          success: true,
          productId: result.productId,
          oldStock: result.oldStock,
          newStock: result.newStock,
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

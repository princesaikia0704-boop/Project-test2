import { NextRequest, NextResponse } from "next/server";
import { withApiReliability, createErrorResponse, getRequestAuth } from "@/lib/http/api-handler";
import { adjustProductStock } from "@/services/inventory.service";
import { DomainError } from "@/services/order.service";
import { stockAdjustSchema } from "@/lib/validators/product.schema";
import { safeIdentifierSchema } from "@/lib/validators/order.schema";

export const POST = withApiReliability(
  async (
    req: NextRequest,
    context?: { params: Promise<{ productId: string }> | { productId: string } }
  ) => {
    const authUser = await getRequestAuth(req);
    if (!authUser) {
      return createErrorResponse("Unauthorized", "Authentication required", 401);
    }

    const params = context?.params ? await context.params : null;
    const productIdCheck = safeIdentifierSchema.safeParse(params?.productId);
    if (!productIdCheck.success) {
      return createErrorResponse("InvalidProductId", "Valid product ID is required", 400);
    }
    const productId = productIdCheck.data;

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

    const parsed = stockAdjustSchema.safeParse(rawBody);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || "Invalid stock adjustment payload";
      const code = msg.toLowerCase().includes("reason")
        ? "MissingReason"
        : msg.toLowerCase().includes("less than 0")
        ? "NegativeStockError"
        : "ValidationError";
      return createErrorResponse(code, msg, 400);
    }

    try {
      const result = await adjustProductStock({
        productId,
        newQuantity: parsed.data.newQuantity,
        delta: parsed.data.delta,
        reason: parsed.data.reason,
        adminUserId: authUser.id,
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

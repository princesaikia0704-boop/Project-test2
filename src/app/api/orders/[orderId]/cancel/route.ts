import { NextRequest, NextResponse } from "next/server";
import { withApiReliability, createErrorResponse } from "@/lib/http/api-handler";
import { cancelOrder, DomainError } from "@/services/order.service";
import { orderRepo } from "@/repositories/order.repo";

export const POST = withApiReliability(
  async (req: NextRequest, context?: { params: Promise<{ orderId: string }> | { orderId: string } }) => {
    const params = context?.params ? await context.params : null;
    const orderId = params?.orderId;

    if (!orderId) {
      return createErrorResponse("InvalidOrderId", "Order ID is required", 400);
    }

    const userId = req.headers.get("x-user-id");
    const userRole = req.headers.get("x-user-role");

    if (!userId) {
      return createErrorResponse(
        "Unauthorized",
        "Missing or invalid authentication token",
        401
      );
    }

    const order = await orderRepo.findByIdWithItems(orderId);
    if (!order) {
      return createErrorResponse(
        "OrderNotFound",
        `Order ${orderId} does not exist`,
        404
      );
    }

    if (order.userId !== userId && userRole !== "ADMIN") {
      return createErrorResponse(
        "Forbidden",
        "Cannot cancel order belonging to another user",
        403
      );
    }

    if (order.status !== "PENDING_APPROVAL") {
      return createErrorResponse(
        "InvalidOrderState",
        `Orders in ${order.status} state cannot be self-cancelled`,
        400
      );
    }

    let reason: string | undefined;
    try {
      const body = await req.json();
      reason = body?.reason;
    } catch {
      // Body is optional
    }

    try {
      await cancelOrder(orderId, userId, reason);
      return NextResponse.json(
        {
          success: true,
          orderId: order.id,
          status: "CANCELLED",
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
  { allowedRoles: ["EMPLOYEE", "MANAGER", "ADMIN"] }
);

import { NextRequest, NextResponse } from "next/server";
import { withApiReliability, createErrorResponse } from "@/lib/http/api-handler";
import { approveOrder, rejectOrder, DomainError } from "@/services/order.service";
import { orderRepo } from "@/repositories/order.repo";

export const POST = withApiReliability(
  async (req: NextRequest, context?: { params: Promise<{ orderId: string }> | { orderId: string } }) => {
    const params = context?.params ? await context.params : null;
    const orderId = params?.orderId;

    if (!orderId) {
      return createErrorResponse("InvalidOrderId", "Order ID is required", 400);
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

    if (body.decision !== "APPROVE" && body.decision !== "REJECT") {
      return createErrorResponse(
        "InvalidDecision",
        "Decision must be either 'APPROVE' or 'REJECT'",
        400
      );
    }

    if (body.decision === "REJECT" && (!body.comment || typeof body.comment !== "string" || !body.comment.trim())) {
      return createErrorResponse(
        "MissingRejectionReason",
        "Rejection reason comment is required",
        400
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

    if (order.status !== "PENDING_APPROVAL") {
      return createErrorResponse(
        "OrderAlreadyResolved",
        `Order is already in state ${order.status}`,
        409
      );
    }

    const managerUserId = req.headers.get("x-user-id") || "manager";

    try {
      if (body.decision === "APPROVE") {
        await approveOrder(orderId, managerUserId, body.comment);
        return NextResponse.json(
          {
            success: true,
            orderId,
            status: "APPROVED",
            ...(body.comment ? { comment: body.comment } : {}),
          },
          { status: 200 }
        );
      } else {
        await rejectOrder(orderId, managerUserId, body.comment.trim());
        return NextResponse.json(
          {
            success: true,
            orderId,
            status: "REJECTED",
            comment: body.comment.trim(),
          },
          { status: 200 }
        );
      }
    } catch (err: any) {
      if (err instanceof DomainError) {
        return createErrorResponse(err.name, err.message, err.statusCode);
      }
      throw err;
    }
  },
  { allowedRoles: ["MANAGER", "ADMIN"] }
);

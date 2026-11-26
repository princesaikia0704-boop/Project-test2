import { NextRequest, NextResponse } from "next/server";
import { withApiReliability, createErrorResponse, getRequestAuth } from "@/lib/http/api-handler";
import { cancelOrder, DomainError } from "@/services/order.service";
import { orderRepo } from "@/repositories/order.repo";
import { cancelOrderSchema, safeIdentifierSchema } from "@/lib/validators/order.schema";
import { normalizeUserUuid } from "@/lib/utils";
import { logSecurityEvent } from "@/lib/security/logger";
import { extractTrustedClientIp } from "@/lib/security/rate-limit";

export const POST = withApiReliability(
  async (
    req: NextRequest,
    context?: { params: Promise<{ orderId: string }> | { orderId: string } }
  ) => {
    const authUser = await getRequestAuth(req);
    if (!authUser) {
      return createErrorResponse("Unauthorized", "Missing or invalid authentication session", 401);
    }

    const params = context?.params ? await context.params : null;
    const orderIdCheck = safeIdentifierSchema.safeParse(params?.orderId);
    if (!orderIdCheck.success) {
      return createErrorResponse("InvalidOrderId", "Valid order ID is required", 400);
    }
    const orderId = orderIdCheck.data;

    const order = await orderRepo.findByIdWithItems(orderId);
    if (!order) {
      return createErrorResponse("OrderNotFound", "Order not found", 404);
    }

    const normalizedUserId = normalizeUserUuid(authUser.id);
    const isAdmin = authUser.role === "ADMIN";
    if (!isAdmin && order.userId !== authUser.id && order.userId !== normalizedUserId) {
      logSecurityEvent({
        event: "IDOR_ATTEMPT",
        severity: "HIGH",
        userId: authUser.id,
        role: authUser.role,
        ip: extractTrustedClientIp(req),
        path: req.nextUrl?.pathname,
        method: "POST",
        reason: `User attempted to cancel another user's order ${orderId}`,
      });
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
      const rawBody = await req.json();
      if (rawBody !== null && rawBody !== undefined) {
        const parsedBody = cancelOrderSchema.safeParse(rawBody);
        if (!parsedBody.success) {
          return createErrorResponse(
            "ValidationError",
            parsedBody.error.issues[0]?.message || "Invalid cancellation reason",
            400
          );
        }
        reason = parsedBody.data.reason;
      }
    } catch {
      // Optional empty JSON body
    }

    try {
      await cancelOrder(orderId, authUser.id, reason, isAdmin);
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

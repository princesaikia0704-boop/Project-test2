import { NextRequest, NextResponse } from "next/server";
import { withApiReliability, createErrorResponse, getRequestAuth } from "@/lib/http/api-handler";
import { approveOrder, rejectOrder, DomainError } from "@/services/order.service";
import { orderRepo } from "@/repositories/order.repo";
import { orderDecisionSchema, safeIdentifierSchema } from "@/lib/validators/order.schema";
import { logSecurityEvent } from "@/lib/security/logger";
import { extractTrustedClientIp } from "@/lib/security/rate-limit";

export const POST = withApiReliability(
  async (
    req: NextRequest,
    context?: { params: Promise<{ orderId: string }> | { orderId: string } }
  ) => {
    const authUser = await getRequestAuth(req);
    if (!authUser || (authUser.role !== "MANAGER" && authUser.role !== "ADMIN")) {
      return createErrorResponse("Forbidden", "Insufficient role permissions", 403);
    }

    const params = context?.params ? await context.params : null;
    const orderIdCheck = safeIdentifierSchema.safeParse(params?.orderId);
    if (!orderIdCheck.success) {
      return createErrorResponse("InvalidOrderId", "Valid order ID is required", 400);
    }
    const orderId = orderIdCheck.data;

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return createErrorResponse(
        "InvalidOrderPayload",
        "Request body must be valid JSON",
        400
      );
    }

    const parsedDecision = orderDecisionSchema.safeParse(rawBody);
    if (!parsedDecision.success) {
      const issue = parsedDecision.error.issues[0];
      const msg = issue?.message || "Invalid approval payload";
      const code = msg.toLowerCase().includes("reason")
        ? "MissingRejectionReason"
        : "InvalidDecision";
      return createErrorResponse(code, msg, 400);
    }

    const order = await orderRepo.findByIdWithItems(orderId);
    if (!order) {
      return createErrorResponse("OrderNotFound", "Order not found", 404);
    }

    // Enforce department isolation for Managers & disallow self-approval
    if (authUser.role === "MANAGER" && order.departmentId !== authUser.departmentId) {
      logSecurityEvent({
        event: "IDOR_ATTEMPT",
        severity: "HIGH",
        userId: authUser.id,
        role: authUser.role,
        ip: extractTrustedClientIp(req),
        path: req.nextUrl?.pathname,
        method: "POST",
        reason: `Manager attempted cross-department order decision on ${orderId}`,
      });
      return createErrorResponse(
        "Forbidden",
        "Cannot approve or reject orders outside your department",
        403
      );
    }

    if (order.userId === authUser.id) {
      logSecurityEvent({
        event: "PRIVILEGE_ESCALATION_ATTEMPT",
        severity: "HIGH",
        userId: authUser.id,
        role: authUser.role,
        ip: extractTrustedClientIp(req),
        path: req.nextUrl?.pathname,
        method: "POST",
        reason: `User attempted self-approval on order ${orderId}`,
      });
      return createErrorResponse(
        "Forbidden",
        "Cannot approve or reject your own purchase order",
        403
      );
    }

    if (order.status !== "PENDING_APPROVAL") {
      return createErrorResponse(
        "OrderAlreadyResolved",
        `Order is already in state ${order.status}`,
        409
      );
    }

    const actorContext = {
      role: authUser.role,
      departmentId: authUser.departmentId,
    };

    try {
      if (parsedDecision.data.decision === "APPROVE") {
        await approveOrder(orderId, authUser.id, parsedDecision.data.comment, actorContext);
        return NextResponse.json(
          {
            success: true,
            orderId,
            status: "APPROVED",
            ...(parsedDecision.data.comment ? { comment: parsedDecision.data.comment } : {}),
          },
          { status: 200 }
        );
      } else {
        await rejectOrder(orderId, authUser.id, parsedDecision.data.comment, actorContext);
        return NextResponse.json(
          {
            success: true,
            orderId,
            status: "REJECTED",
            comment: parsedDecision.data.comment,
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

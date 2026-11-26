import { NextRequest, NextResponse } from "next/server";
import { withApiReliability, createErrorResponse, getRequestAuth } from "@/lib/http/api-handler";
import { createOrderWithACID, DomainError } from "@/services/order.service";
import { orderRepo } from "@/repositories/order.repo";
import { createOrderSchema } from "@/lib/validators/order.schema";

export const POST = withApiReliability(
  async (req: NextRequest) => {
    const authUser = await getRequestAuth(req);
    if (!authUser) {
      return createErrorResponse("Unauthorized", "Authentication required", 401);
    }

    const idempHeader =
      req.headers.get("idempotency-key") || req.headers.get("Idempotency-Key");

    if (!idempHeader || idempHeader.trim().length === 0) {
      return createErrorResponse(
        "MissingIdempotencyKey",
        "Header Idempotency-Key is required for checkout",
        400
      );
    }

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

    const parsed = createOrderSchema.safeParse(rawBody);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const isQuantityErr = firstIssue?.path.includes("quantity");
      return createErrorResponse(
        isQuantityErr ? "InvalidQuantity" : "InvalidOrderPayload",
        firstIssue?.message || "Invalid order payload",
        400
      );
    }

    try {
      // Strictly bind order ownership and budget department to server-verified session
      const result = await createOrderWithACID({
        userId: authUser.id,
        departmentId: authUser.departmentId,
        items: parsed.data.items,
        notes: parsed.data.notes || null,
        idempotencyKey: idempHeader.trim(),
      });

      return NextResponse.json(
        {
          success: true,
          orderId: result.orderId,
          status: result.status,
          totalCents: result.totalCents,
          remainingBudgetCents: result.remainingBudgetCents,
          itemsCount: result.itemsCount,
        },
        { status: 201 }
      );
    } catch (err: any) {
      if (err instanceof DomainError) {
        return createErrorResponse(err.name, err.message, err.statusCode);
      }
      throw err;
    }
  },
  { requireIdempotency: true, allowedRoles: ["EMPLOYEE", "MANAGER", "ADMIN"] }
);

export const GET = withApiReliability(
  async (req: NextRequest) => {
    const authUser = await getRequestAuth(req);
    if (!authUser) {
      return createErrorResponse("Unauthorized", "Authentication required", 401);
    }

    const orders = await orderRepo.listByUserId(authUser.id);

    return NextResponse.json(
      {
        success: true,
        count: orders.length,
        orders,
      },
      { status: 200 }
    );
  },
  { allowedRoles: ["EMPLOYEE", "MANAGER", "ADMIN"] }
);

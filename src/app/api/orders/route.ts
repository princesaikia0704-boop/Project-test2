import { NextRequest, NextResponse } from "next/server";
import { withApiReliability, createErrorResponse } from "@/lib/http/api-handler";
import { createOrderWithACID, DomainError } from "@/services/order.service";
import { orderRepo } from "@/repositories/order.repo";

export const POST = withApiReliability(
  async (req: NextRequest) => {
    const idempHeader =
      req.headers.get("idempotency-key") || req.headers.get("Idempotency-Key");

    if (!idempHeader || idempHeader.trim().length === 0) {
      return createErrorResponse(
        "MissingIdempotencyKey",
        "Header Idempotency-Key is required for checkout",
        400
      );
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
        "InvalidOrderPayload",
        "Request body cannot be empty",
        400
      );
    }

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return createErrorResponse(
        "InvalidOrderPayload",
        "Cart items cannot be empty",
        400
      );
    }

    for (const item of body.items) {
      if (
        !item ||
        typeof item !== "object" ||
        !item.productId ||
        typeof item.quantity !== "number" ||
        item.quantity <= 0 ||
        !Number.isInteger(item.quantity)
      ) {
        return createErrorResponse(
          "InvalidQuantity",
          "Item quantity must be greater than 0",
          400
        );
      }
    }

    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return createErrorResponse(
        "Unauthorized",
        "Missing or invalid authentication token",
        401
      );
    }

    const departmentId =
      req.headers.get("x-user-department-id") ||
      req.headers.get("x-department-id") ||
      "dept-eng";

    try {
      const result = await createOrderWithACID({
        userId,
        departmentId,
        items: body.items,
        notes: body.notes || null,
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
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return createErrorResponse(
        "Unauthorized",
        "Missing or invalid authentication token",
        401
      );
    }

    const orders = await orderRepo.listByUserId(userId);

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

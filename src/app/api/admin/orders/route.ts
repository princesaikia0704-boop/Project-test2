import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiReliability, createErrorResponse, getRequestAuth } from "@/lib/http/api-handler";
import { orderRepo } from "@/repositories/order.repo";
import { orderStatusSchema, safeIdentifierSchema } from "@/lib/validators/order.schema";

const adminOrdersQuerySchema = z.object({
  status: orderStatusSchema.optional(),
  departmentId: safeIdentifierSchema.optional(),
});

export const GET = withApiReliability(
  async (req: NextRequest) => {
    const authUser = await getRequestAuth(req);
    if (!authUser) {
      return createErrorResponse("Unauthorized", "Authentication required", 401);
    }

    const { searchParams } = new URL(req.url);
    const parsed = adminOrdersQuerySchema.safeParse({
      status: searchParams.get("status") || undefined,
      departmentId: searchParams.get("departmentId") || undefined,
    });

    if (!parsed.success) {
      return createErrorResponse(
        "ValidationError",
        parsed.error.issues[0]?.message || "Invalid query parameters",
        400
      );
    }

    // Managers are strictly locked to their authenticated departmentId.
    const deptFilter =
      authUser.role === "ADMIN" ? parsed.data.departmentId : authUser.departmentId;

    const orders = await orderRepo.listDepartmentOrders(deptFilter, {
      status: parsed.data.status,
    });

    return NextResponse.json(
      {
        success: true,
        count: orders.length,
        departmentId: deptFilter || "ALL",
        orders,
      },
      { status: 200 }
    );
  },
  { allowedRoles: ["MANAGER", "ADMIN"] }
);

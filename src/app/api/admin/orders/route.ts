import { NextRequest, NextResponse } from "next/server";
import { withApiReliability } from "@/lib/http/api-handler";
import { orderRepo } from "@/repositories/order.repo";
import { Order } from "@/lib/db/schema";

export const GET = withApiReliability(
  async (req: NextRequest) => {
    const userRole = req.headers.get("x-user-role");
    const departmentId =
      req.headers.get("x-user-department-id") ||
      req.headers.get("x-department-id") ||
      "dept-eng";

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status") as Order["status"] | null;

    // Managers are restricted to their department's orders.
    // Admins can query all departments or pass a specific departmentId.
    const deptFilter =
      userRole === "ADMIN"
        ? (searchParams.get("departmentId") || undefined)
        : departmentId;

    const orders = await orderRepo.listDepartmentOrders(deptFilter, {
      status: statusParam || undefined,
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

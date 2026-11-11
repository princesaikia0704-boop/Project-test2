import { NextRequest, NextResponse } from "next/server";
import { withApiReliability, createErrorResponse } from "@/lib/http/api-handler";
import { orderRepo } from "@/repositories/order.repo";

export const GET = withApiReliability(
  async (req: NextRequest) => {
    const userRole = req.headers.get("x-user-role");
    const departmentId =
      req.headers.get("x-user-department-id") ||
      req.headers.get("x-department-id");

    const deptFilter = userRole === "ADMIN" ? undefined : departmentId || undefined;
    const approvals = await orderRepo.listPendingApprovals(deptFilter);

    return NextResponse.json(
      {
        success: true,
        count: approvals.length,
        approvals,
      },
      { status: 200 }
    );
  },
  { allowedRoles: ["MANAGER", "ADMIN"] }
);

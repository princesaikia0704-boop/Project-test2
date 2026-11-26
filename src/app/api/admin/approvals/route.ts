import { NextRequest, NextResponse } from "next/server";
import { withApiReliability, createErrorResponse, getRequestAuth } from "@/lib/http/api-handler";
import { orderRepo } from "@/repositories/order.repo";

export const GET = withApiReliability(
  async (req: NextRequest) => {
    const authUser = await getRequestAuth(req);
    if (!authUser) {
      return createErrorResponse("Unauthorized", "Authentication required", 401);
    }

    // Managers are strictly scoped to their own department; only Admins see all
    const deptFilter = authUser.role === "ADMIN" ? undefined : authUser.departmentId;
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

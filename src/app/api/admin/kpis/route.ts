import { NextRequest, NextResponse } from "next/server";
import { withApiReliability, createErrorResponse, getRequestAuth } from "@/lib/http/api-handler";
import { db, schema, mockDataStore } from "@/lib/db";
import { isDatabaseMocked } from "@/lib/mock/utils";
import { and, eq, sql } from "drizzle-orm";

export const GET = withApiReliability(
  async (req: NextRequest) => {
    const authUser = await getRequestAuth(req);
    if (!authUser) {
      return createErrorResponse("Unauthorized", "Authentication required", 401);
    }

    const isAdmin = authUser.role === "ADMIN";
    const deptScope = isAdmin ? undefined : authUser.departmentId;

    if (isDatabaseMocked()) {
      const allOrders = mockDataStore.getOrders({ departmentId: deptScope });
      const allProds = mockDataStore.getProducts({}).products;

      const spendMtdCents = allOrders
        .filter((o) => o.status === "APPROVED")
        .reduce((sum, o) => sum + o.totalCents, 0);

      const pendingApprovalsCount = allOrders.filter(
        (o) => o.status === "PENDING_APPROVAL"
      ).length;

      const totalOrderVolume = allOrders.length;

      const lowStockAlertCount = allProds.filter(
        (p) => p.stockQuantity <= (p.lowStockThreshold ?? 5)
      ).length;

      return NextResponse.json(
        {
          success: true,
          spendMtdCents,
          pendingApprovalsCount,
          totalOrderVolume,
          lowStockAlertCount,
        },
        { status: 200 }
      );
    }

    // Live PostgreSQL (department-scoped for Managers, global for Admins)
    const approvedWhere = deptScope
      ? and(eq(schema.orders.status, "APPROVED"), eq(schema.orders.departmentId, deptScope))
      : eq(schema.orders.status, "APPROVED");

    const approvedOrders = await db
      .select({ totalCents: schema.orders.totalCents })
      .from(schema.orders)
      .where(approvedWhere);

    const spendMtdCents = approvedOrders.reduce((sum, o) => sum + o.totalCents, 0);

    const pendingWhere = deptScope
      ? and(eq(schema.orders.status, "PENDING_APPROVAL"), eq(schema.orders.departmentId, deptScope))
      : eq(schema.orders.status, "PENDING_APPROVAL");

    const pendingResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.orders)
      .where(pendingWhere);

    const pendingApprovalsCount = Number(pendingResult[0]?.count || 0);

    const totalOrdersQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.orders);
    if (deptScope) totalOrdersQuery.where(eq(schema.orders.departmentId, deptScope));
    const totalOrdersResult = await totalOrdersQuery;

    const totalOrderVolume = Number(totalOrdersResult[0]?.count || 0);

    const lowStockResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.products)
      .where(sql`${schema.products.stockQuantity} <= ${schema.products.lowStockThreshold}`);

    const lowStockAlertCount = Number(lowStockResult[0]?.count || 0);

    return NextResponse.json(
      {
        success: true,
        spendMtdCents,
        pendingApprovalsCount,
        totalOrderVolume,
        lowStockAlertCount,
      },
      { status: 200 }
    );
  },
  { allowedRoles: ["ADMIN", "MANAGER"] }
);

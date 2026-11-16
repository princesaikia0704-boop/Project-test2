import { NextRequest, NextResponse } from "next/server";
import { withApiReliability } from "@/lib/http/api-handler";
import { db, schema, mockDataStore } from "@/lib/db";
import { isDatabaseMocked } from "@/lib/mock/utils";
import { eq, sql } from "drizzle-orm";

export const GET = withApiReliability(
  async () => {
    if (isDatabaseMocked()) {
      const allOrders = mockDataStore.getOrders({});
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

    // Live PostgreSQL
    const approvedOrders = await db
      .select({ totalCents: schema.orders.totalCents })
      .from(schema.orders)
      .where(eq(schema.orders.status, "APPROVED"));

    const spendMtdCents = approvedOrders.reduce((sum, o) => sum + o.totalCents, 0);

    const pendingResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.orders)
      .where(eq(schema.orders.status, "PENDING_APPROVAL"));

    const pendingApprovalsCount = Number(pendingResult[0]?.count || 0);

    const totalOrdersResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.orders);

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

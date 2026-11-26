import { NextRequest, NextResponse } from "next/server";
import { withApiReliability, createErrorResponse, getRequestAuth } from "@/lib/http/api-handler";
import { db, schema, mockDataStore } from "@/lib/db";
import { isDatabaseMocked } from "@/lib/mock/utils";
import { desc, eq } from "drizzle-orm";
import { escapeCsvCell } from "@/lib/security/url";

export const GET = withApiReliability(
  async (req: NextRequest) => {
    const authUser = await getRequestAuth(req);
    if (!authUser) {
      return createErrorResponse("Unauthorized", "Authentication required", 401);
    }

    const deptScope = authUser.role === "ADMIN" ? undefined : authUser.departmentId;

    type BillingRow = {
      orderNumber: string;
      orderId: string;
      date: string;
      userId: string;
      department: string;
      status: string;
      sku: string;
      productName: string;
      quantity: number;
      unitPrice: string;
      itemTotal: string;
      orderTotal: string;
    };

    const rows: BillingRow[] = [];

    if (isDatabaseMocked()) {
      const orders = mockDataStore.getOrders({ departmentId: deptScope, limit: 2000 });
      for (const order of orders) {
        const detailed = mockDataStore.getOrderById(order.id);
        const items = detailed?.items || [];
        const deptName = detailed?.department?.name || order.departmentId;
        const userName = detailed?.user?.name || detailed?.user?.email || order.userId;
        const orderDate = new Date(order.createdAt).toISOString().replace("T", " ").slice(0, 19);
        const orderTotal = (order.totalCents / 100).toFixed(2);

        if (items.length === 0) {
          rows.push({
            orderNumber: order.orderNumber,
            orderId: order.id,
            date: orderDate,
            userId: userName,
            department: deptName,
            status: order.status,
            sku: "N/A",
            productName: "No Items",
            quantity: 0,
            unitPrice: "0.00",
            itemTotal: "0.00",
            orderTotal,
          });
        } else {
          for (const item of items) {
            const unitPrice = (item.unitPriceCents / 100).toFixed(2);
            const itemTotal = ((item.unitPriceCents * item.quantity) / 100).toFixed(2);
            rows.push({
              orderNumber: order.orderNumber,
              orderId: order.id,
              date: orderDate,
              userId: userName,
              department: deptName,
              status: order.status,
              sku: item.product?.sku || "N/A",
              productName: item.product?.name || "Unknown Product",
              quantity: item.quantity,
              unitPrice,
              itemTotal,
              orderTotal,
            });
          }
        }
      }
    } else {
      const baseQuery = db
        .select()
        .from(schema.orders)
        .orderBy(desc(schema.orders.createdAt))
        .limit(2000);
      const orders = deptScope
        ? await db
            .select()
            .from(schema.orders)
            .where(eq(schema.orders.departmentId, deptScope))
            .orderBy(desc(schema.orders.createdAt))
            .limit(2000)
        : await baseQuery;

      for (const order of orders) {
        const items = await db
          .select()
          .from(schema.orderItems)
          .leftJoin(schema.products, eq(schema.orderItems.productId, schema.products.id))
          .where(eq(schema.orderItems.orderId, order.id));

        const orderDate = new Date(order.createdAt).toISOString().replace("T", " ").slice(0, 19);
        const orderTotal = (order.totalCents / 100).toFixed(2);

        if (items.length === 0) {
          rows.push({
            orderNumber: order.orderNumber,
            orderId: order.id,
            date: orderDate,
            userId: order.userId,
            department: order.departmentId,
            status: order.status,
            sku: "N/A",
            productName: "No Items",
            quantity: 0,
            unitPrice: "0.00",
            itemTotal: "0.00",
            orderTotal,
          });
        } else {
          for (const row of items) {
            const item = row.order_items;
            const prod = row.products;
            const unitPrice = (item.unitPriceCents / 100).toFixed(2);
            const itemTotal = (item.totalPriceCents / 100).toFixed(2);
            rows.push({
              orderNumber: order.orderNumber,
              orderId: order.id,
              date: orderDate,
              userId: order.userId,
              department: order.departmentId,
              status: order.status,
              sku: prod?.sku || "N/A",
              productName: prod?.name || "Unknown Product",
              quantity: item.quantity,
              unitPrice,
              itemTotal,
              orderTotal,
            });
          }
        }
      }
    }

    const headers = [
      "Order Number",
      "Order ID",
      "Date & Time",
      "User / Employee",
      "Department",
      "Order Status",
      "Product SKU",
      "Product Name",
      "Quantity",
      "Unit Price (₹)",
      "Item Total (₹)",
      "Order Total (₹)",
    ];

    const csvRows = [
      headers.join(","),
      ...rows.map((r) =>
        [
          escapeCsvCell(r.orderNumber),
          escapeCsvCell(r.orderId),
          escapeCsvCell(r.date),
          escapeCsvCell(r.userId),
          escapeCsvCell(r.department),
          escapeCsvCell(r.status),
          escapeCsvCell(r.sku),
          escapeCsvCell(r.productName),
          r.quantity,
          r.unitPrice,
          r.itemTotal,
          r.orderTotal,
        ].join(",")
      ),
    ];

    const csvContent = "\uFEFF" + csvRows.join("\r\n");
    const today = new Date().toISOString().slice(0, 10);

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="billing-cost-sheet-${today}.csv"`,
        "Cache-Control": "no-store, private",
        "X-Content-Type-Options": "nosniff",
      },
    });
  },
  { allowedRoles: ["ADMIN", "MANAGER"] }
);

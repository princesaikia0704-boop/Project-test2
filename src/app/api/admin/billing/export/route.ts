import { NextRequest, NextResponse } from "next/server";
import { withApiReliability } from "@/lib/http/api-handler";
import { db, schema, mockDataStore } from "@/lib/db";
import { isDatabaseMocked } from "@/lib/mock/utils";
import { desc, eq } from "drizzle-orm";

export const GET = withApiReliability(
  async (req: NextRequest) => {
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
    const orders = mockDataStore.getOrders({ limit: 5000 });
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
    // Live PostgreSQL
    const orders = await db
      .select()
      .from(schema.orders)
      .orderBy(desc(schema.orders.createdAt));

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

  // Helper to escape CSV strings
  const escapeCsv = (str: any) => {
    const s = String(str ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

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
        escapeCsv(r.orderNumber),
        escapeCsv(r.orderId),
        escapeCsv(r.date),
        escapeCsv(r.userId),
        escapeCsv(r.department),
        escapeCsv(r.status),
        escapeCsv(r.sku),
        escapeCsv(r.productName),
        r.quantity,
        r.unitPrice,
        r.itemTotal,
        r.orderTotal,
      ].join(",")
    ),
  ];

  // Add UTF-8 BOM so Excel opens accented characters and symbols cleanly
  const csvContent = "\uFEFF" + csvRows.join("\r\n");

  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="billing-cost-sheet-${today}.csv"`,
      "Cache-Control": "no-cache",
    },
  });
  },
  { allowedRoles: ["ADMIN", "MANAGER"] }
);

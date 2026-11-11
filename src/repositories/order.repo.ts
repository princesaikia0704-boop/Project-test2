/**
 * Corporate Office Store - Order Repository
 * Handles transactional order placement, relations expansion, approval queue, and state mutations.
 */

import { desc, eq, and, sql } from "drizzle-orm";
import { db, schema, mockDataStore } from "@/lib/db";
import {
  Order,
  NewOrder,
  OrderItem,
  NewOrderItem,
  User,
  Department,
  Product,
} from "@/lib/db/schema";
import { isDatabaseMocked } from "@/lib/mock/utils";

export interface OrderWithRelations extends Order {
  items: (OrderItem & { product?: Product })[];
  user?: User;
  department?: Department;
}

export interface ListOrdersOptions {
  userId?: string;
  departmentId?: string;
  status?: Order["status"];
  limit?: number;
  offset?: number;
}

export interface IOrderRepository {
  createOrderRecord(
    orderData: Omit<NewOrder, "id" | "orderNumber" | "createdAt" | "updatedAt">,
    itemsData: Omit<NewOrderItem, "id" | "orderId" | "createdAt">[],
    tx?: any
  ): Promise<{ order: Order; items: OrderItem[] }>;
  findByIdWithItems(orderId: string, tx?: any): Promise<OrderWithRelations | null>;
  listByUserId(userId: string, options?: { limit?: number; offset?: number }): Promise<Order[]>;
  listPendingApprovals(departmentId?: string, options?: { limit?: number; offset?: number }): Promise<Order[]>;
  updateStatus(
    orderId: string,
    status: Order["status"],
    approvedByUserId?: string | null,
    rejectionReason?: string | null,
    tx?: any
  ): Promise<Order>;
  cancelOrder(orderId: string, userId: string, tx?: any): Promise<Order>;
}

export class OrderRepository implements IOrderRepository {
  async createOrderRecord(
    orderData: Omit<NewOrder, "id" | "orderNumber" | "createdAt" | "updatedAt">,
    itemsData: Omit<NewOrderItem, "id" | "orderId" | "createdAt">[],
    tx?: any
  ): Promise<{ order: Order; items: OrderItem[] }> {
    if (isDatabaseMocked()) {
      const res = mockDataStore.createOrder(
        orderData as any,
        itemsData as any
      );
      return {
        order: res.order as unknown as Order,
        items: res.items as unknown as OrderItem[],
      };
    }

    const client = tx || db;
    const orderNumber = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

    const [createdOrder] = await client
      .insert(schema.orders)
      .values({
        ...orderData,
        orderNumber,
      })
      .returning();

    const lineItemsToInsert = itemsData.map((item) => ({
      ...item,
      orderId: createdOrder.id,
    }));

    const createdItems = await client
      .insert(schema.orderItems)
      .values(lineItemsToInsert)
      .returning();

    return { order: createdOrder, items: createdItems };
  }

  async findByIdWithItems(orderId: string, tx?: any): Promise<OrderWithRelations | null> {
    if (isDatabaseMocked()) {
      return (mockDataStore.getOrderById(orderId) as unknown as OrderWithRelations) ?? null;
    }

    const client = tx || db;
    const [order] = await client
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId))
      .limit(1);

    if (!order) return null;

    const items = await client
      .select()
      .from(schema.orderItems)
      .leftJoin(schema.products, eq(schema.orderItems.productId, schema.products.id))
      .where(eq(schema.orderItems.orderId, orderId));

    const [user] = await client
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, order.userId))
      .limit(1);

    const [department] = await client
      .select()
      .from(schema.departments)
      .where(eq(schema.departments.id, order.departmentId))
      .limit(1);

    return {
      ...order,
      items: items.map((row: any) => ({
        ...row.order_items,
        product: row.products ?? undefined,
      })),
      user: user ?? undefined,
      department: department ?? undefined,
    };
  }

  async listByUserId(userId: string, options?: { limit?: number; offset?: number }): Promise<Order[]> {
    if (isDatabaseMocked()) {
      const orders = mockDataStore.getOrders({
        userId,
        limit: options?.limit,
        offset: options?.offset,
      });
      return orders as unknown as Order[];
    }

    const rows = await db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.userId, userId))
      .orderBy(desc(schema.orders.createdAt))
      .limit(options?.limit ?? 50)
      .offset(options?.offset ?? 0);

    return rows;
  }

  async listPendingApprovals(
    departmentId?: string,
    options?: { limit?: number; offset?: number }
  ): Promise<Order[]> {
    if (isDatabaseMocked()) {
      const orders = mockDataStore.getOrders({
        departmentId,
        status: "PENDING_APPROVAL",
        limit: options?.limit,
        offset: options?.offset,
      });
      return orders as unknown as Order[];
    }

    const conditions: any[] = [eq(schema.orders.status, "PENDING_APPROVAL")];
    if (departmentId) {
      conditions.push(eq(schema.orders.departmentId, departmentId));
    }

    const rows = await db
      .select()
      .from(schema.orders)
      .where(and(...conditions))
      .orderBy(desc(schema.orders.createdAt))
      .limit(options?.limit ?? 50)
      .offset(options?.offset ?? 0);

    return rows;
  }

  async updateStatus(
    orderId: string,
    status: Order["status"],
    approvedByUserId?: string | null,
    rejectionReason?: string | null,
    tx?: any
  ): Promise<Order> {
    if (isDatabaseMocked()) {
      return mockDataStore.updateOrderStatus(
        orderId,
        status,
        approvedByUserId ?? undefined,
        rejectionReason ?? undefined
      ) as unknown as Order;
    }

    const client = tx || db;
    const updatePayload: Partial<NewOrder> = {
      status,
      updatedAt: new Date(),
    };

    if (approvedByUserId !== undefined) {
      updatePayload.approvedByUserId = approvedByUserId;
    }
    if (rejectionReason !== undefined) {
      updatePayload.rejectionReason = rejectionReason;
    }

    const [updated] = await client
      .update(schema.orders)
      .set(updatePayload)
      .where(eq(schema.orders.id, orderId))
      .returning();

    if (!updated) {
      throw new Error(`Order not found: ${orderId}`);
    }

    return updated;
  }

  async cancelOrder(orderId: string, userId: string, tx?: any): Promise<Order> {
    const existing = await this.findByIdWithItems(orderId, tx);
    if (!existing) {
      throw new Error(`Order not found: ${orderId}`);
    }

    if (existing.status !== "PENDING_APPROVAL") {
      throw new Error(`InvalidOrderState: Cannot cancel order in state ${existing.status}`);
    }

    return await this.updateStatus(orderId, "CANCELLED", null, null, tx);
  }
}

export const orderRepo = new OrderRepository();

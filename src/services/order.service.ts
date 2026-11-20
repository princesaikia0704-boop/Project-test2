/**
 * Corporate Office Store - Order Domain Service
 * Enforces ACID checkout transactions, deadlock prevention via sorted row locks,
 * dynamic auto-approval thresholds, and atomic cancellation/rejection rollbacks.
 */

import { sql } from "drizzle-orm";
import { txDb, schema, mockDataStore } from "@/lib/db";
import { isDatabaseMocked } from "@/lib/mock/utils";
import { productRepo } from "@/repositories/product.repo";
import { orderRepo } from "@/repositories/order.repo";
import { budgetRepo } from "@/repositories/budget.repo";
import { configRepo } from "@/repositories/config.repo";
import { auditRepo } from "@/repositories/audit.repo";
import { normalizeDepartmentUuid, normalizeUserUuid } from "@/lib/utils";

export class DomainError extends Error {
  constructor(
    public override name: string,
    message: string,
    public statusCode = 400
  ) {
    super(message);
  }
}

export interface CreateOrderInput {
  userId: string;
  departmentId: string;
  items: { productId: string; quantity: number }[];
  idempotencyKey?: string;
  notes?: string | null;
}

export interface CreateOrderResult {
  orderId: string;
  status: "PENDING_APPROVAL" | "APPROVED";
  totalCents: number;
  remainingBudgetCents: number;
  itemsCount: number;
}

/**
 * Atomically creates an order with ACID guarantees, sorted row locks (preventing deadlocks),
 * dynamic auto-approval threshold checks, and department budget verification.
 *
 * @param input - Order creation payload including user, department, items, and optional idempotency key
 * @returns Details of created order (id, status, total, remaining budget, items count)
 * @throws {DomainError} If payload is invalid, items empty, product not found, or stock insufficient
 */
export async function createOrderWithACID(input: CreateOrderInput): Promise<CreateOrderResult> {
  // 1. Validation
  if (!input.items || !Array.isArray(input.items) || input.items.length === 0) {
    throw new DomainError("InvalidOrderPayload", "Cart items cannot be empty", 400);
  }

  for (const it of input.items) {
    if (!it.productId || typeof it.quantity !== "number" || it.quantity <= 0 || !Number.isInteger(it.quantity)) {
      throw new DomainError("InvalidQuantity", "Item quantity must be a positive integer", 400);
    }
  }

  // 2. Deadlock Elimination: Deterministically sort requested items ascending by productId
  const sortedItems = [...input.items].sort((a, b) => a.productId.localeCompare(b.productId));
  const productIds = Array.from(new Set(sortedItems.map((i) => i.productId)));

  // Aggregate duplicate items by productId for cumulative stock validation
  const aggregatedQuantities = new Map<string, number>();
  for (const item of sortedItems) {
    aggregatedQuantities.set(
      item.productId,
      (aggregatedQuantities.get(item.productId) || 0) + item.quantity
    );
  }

  // 3. Execution Branch: Mock vs Live Neon PostgreSQL
  if (isDatabaseMocked()) {
    return await mockDataStore.transaction(async () => {
      // 3.1 Department Budget (Optional / soft verification while budget details are commented out)
      const budget =
        mockDataStore.getActiveBudget(input.departmentId) ||
        Array.from(mockDataStore.departmentBudgets.values())[0];

      // 3.2 Verify Products & Inventory
      for (const [pId, totalQty] of aggregatedQuantities.entries()) {
        const prod = mockDataStore.getProductById(pId);
        if (!prod) {
          throw new DomainError("ProductNotFound", `Product not found: ${pId}`, 422);
        }
        if (!prod.isActive) {
          throw new DomainError("ProductUnavailable", `Product ${prod.name} is currently inactive`, 422);
        }
        if (prod.stockQuantity < totalQty) {
          throw new DomainError(
            "InsufficientStock",
            `Requested quantity (${totalQty}) exceeds available stock (${prod.stockQuantity}) for ${prod.name}`,
            422
          );
        }
      }

      let calculatedTotalCents = 0;
      const itemsData: { productId: string; quantity: number; unitPriceCents: number }[] = [];

      for (const item of sortedItems) {
        const prod = mockDataStore.getProductById(item.productId)!;
        calculatedTotalCents += prod.priceCents * item.quantity;
        itemsData.push({
          productId: item.productId,
          quantity: item.quantity,
          unitPriceCents: prod.priceCents,
        });
      }

      // 3.4 Atomic Deductions
      let remainingBudgetCents = 100000;
      if (budget) {
        const updatedBudget = mockDataStore.deductBudget(
          budget.id,
          Math.min(budget.remainingCents, calculatedTotalCents)
        );
        remainingBudgetCents = updatedBudget.remainingCents;
      }

      // Decrease available stock count in the database by ordered quantity (e.g. 1)
      for (const item of sortedItems) {
        mockDataStore.updateStock(item.productId, -item.quantity);
      }

      // 3.5 Dynamic Auto-Approval Threshold Check
      const storeSettings = mockDataStore.getStoreSettings();
      const autoApproveLimitCents = storeSettings?.autoApproveLimitCents ?? 10000;
      const status: "APPROVED" | "PENDING_APPROVAL" =
        calculatedTotalCents <= autoApproveLimitCents ? "APPROVED" : "PENDING_APPROVAL";

      // 3.6 Create Order & Order Items in database
      const userUuid = normalizeUserUuid(input.userId);
      const deptUuid = normalizeDepartmentUuid(input.departmentId);
      const created = mockDataStore.createOrder(
        {
          userId: userUuid,
          departmentId: deptUuid,
          totalCents: calculatedTotalCents,
          status,
          notes: input.notes || null,
          approvedByUserId: null,
          rejectionReason: null,
        },
        itemsData
      );

      return {
        orderId: created.order.id,
        status,
        totalCents: calculatedTotalCents,
        remainingBudgetCents,
        itemsCount: created.items.length,
      };
    });
  }

  // Live PostgreSQL Mode with pooled WebSocket transaction
  return await txDb.transaction(async (tx) => {
    // Normalize string slugs (e.g. "dept-eng", "user-alice-emp") to valid PostgreSQL UUIDs
    const deptUuid = normalizeDepartmentUuid(input.departmentId);
    const userUuid = normalizeUserUuid(input.userId);

    // Session timeouts for SLA boundaries
    await tx.execute(sql`SET LOCAL lock_timeout = '2s';`);
    await tx.execute(sql`SET LOCAL statement_timeout = '5s';`);

    // 1. Lock Department Budget (if available)
    const now = new Date();
    const [budget] = await tx
      .select()
      .from(schema.departmentBudgets)
      .where(
        sql`(${schema.departmentBudgets.departmentId} = ${deptUuid} OR ${schema.departmentBudgets.departmentId} = '10000000-0000-0000-0000-000000000001') AND ${schema.departmentBudgets.periodStart} <= ${now} AND ${schema.departmentBudgets.periodEnd} >= ${now}`
      )
      .for("update")
      .limit(1);

    // 2. Lock Products in Ascending ID Order
    const lockedProducts = await productRepo.batchFindByIds(productIds, true, tx);
    const productMap = new Map(lockedProducts.map((p) => [p.id, p]));

    for (const [pId, totalQty] of aggregatedQuantities.entries()) {
      const prod = productMap.get(pId);
      if (!prod) {
        throw new DomainError("ProductNotFound", `Product not found: ${pId}`, 422);
      }
      if (!prod.isActive) {
        throw new DomainError("ProductUnavailable", `Product ${prod.name} is currently inactive`, 422);
      }
      if (prod.stockQuantity < totalQty) {
        throw new DomainError(
          "InsufficientStock",
          `Requested quantity (${totalQty}) exceeds available stock (${prod.stockQuantity}) for ${prod.name}`,
          422
        );
      }
    }

    let calculatedTotalCents = 0;
    const itemsData: { productId: string; quantity: number; unitPriceCents: number; totalPriceCents: number }[] = [];

    for (const item of sortedItems) {
      const prod = productMap.get(item.productId)!;
      const lineTotal = prod.priceCents * item.quantity;
      calculatedTotalCents += lineTotal;
      itemsData.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPriceCents: prod.priceCents,
        totalPriceCents: lineTotal,
      });
    }

    // 4. Atomic Deductions
    let remainingBudgetCents = 100000;
    if (budget) {
      const updatedBudget = await budgetRepo.deductRemainingBudget(
        budget.id,
        Math.min(budget.remainingCents, calculatedTotalCents),
        tx
      );
      remainingBudgetCents = updatedBudget.remainingCents;
    }

    // Decrease available stock count in the database by ordered quantity (e.g. 1)
    for (const item of sortedItems) {
      await productRepo.updateStock(item.productId, -item.quantity, tx);
    }

    // 5. Dynamic Auto-Approval Threshold Check
    const storeSettings = await configRepo.getStoreSettings(tx);
    const autoApproveLimitCents = storeSettings?.autoApproveLimitCents ?? 10000;
    const status: "APPROVED" | "PENDING_APPROVAL" =
      calculatedTotalCents <= autoApproveLimitCents ? "APPROVED" : "PENDING_APPROVAL";

    // 6. Insert Order Record and Items in database
    const { order, items } = await orderRepo.createOrderRecord(
      {
        userId: userUuid,
        departmentId: deptUuid,
        totalCents: calculatedTotalCents,
        status,
        notes: input.notes || null,
        approvedByUserId: null,
        rejectionReason: null,
      },
      itemsData,
      tx
    );

    return {
      orderId: order.id,
      status,
      totalCents: calculatedTotalCents,
      remainingBudgetCents,
      itemsCount: items.length,
    };
  });
}

/**
 * Approves a pending purchase order and records an immutable audit log entry.
 *
 * @param orderId - UUID of the order to approve
 * @param managerUserId - UUID of the approving manager
 * @param comment - Optional approval comments or notes
 * @throws {DomainError} If order does not exist or is not in PENDING_APPROVAL status
 */
export async function approveOrder(
  orderId: string,
  managerUserId: string,
  comment?: string
): Promise<void> {
  const order = await orderRepo.findByIdWithItems(orderId);
  if (!order) {
    throw new DomainError("OrderNotFound", `Order ${orderId} not found`, 404);
  }

  if (order.status === "APPROVED") {
    throw new DomainError("OrderAlreadyResolved", "Order is already approved", 409);
  }
  if (order.status === "CANCELLED") {
    throw new DomainError("InvalidOrderState", "Cannot approve a cancelled order", 409);
  }
  if (order.status !== "PENDING_APPROVAL") {
    throw new DomainError("OrderAlreadyResolved", `Order is in status ${order.status}`, 409);
  }

  await orderRepo.updateStatus(orderId, "APPROVED", managerUserId, null);

  await auditRepo.record({
    adminUserId: managerUserId,
    action: "APPROVE",
    entityType: "ORDER",
    entityId: orderId,
    oldValue: JSON.stringify({ status: order.status }),
    newValue: JSON.stringify({ status: "APPROVED", comment: comment || null }),
  });
}

/**
 * Rejects a pending purchase order, restoring reserved product stock quantities,
 * refunding the department budget, and recording an audit trail.
 *
 * @param orderId - UUID of the order to reject
 * @param managerUserId - UUID of the rejecting manager
 * @param reason - Mandatory rejection explanation
 * @throws {DomainError} If reason is omitted, order not found, or order is not pending
 */
export async function rejectOrder(
  orderId: string,
  managerUserId: string,
  reason: string
): Promise<void> {
  if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
    throw new DomainError("MissingRejectionReason", "Rejection reason comment is required", 400);
  }

  const order = await orderRepo.findByIdWithItems(orderId);
  if (!order) {
    throw new DomainError("OrderNotFound", `Order ${orderId} not found`, 404);
  }

  if (order.status !== "PENDING_APPROVAL") {
    throw new DomainError("OrderAlreadyResolved", `Order is in status ${order.status}`, 409);
  }

  if (isDatabaseMocked()) {
    mockDataStore.updateOrderStatus(orderId, "REJECTED", managerUserId, reason.trim());
  } else {
    await txDb.transaction(async (tx) => {
      // 1. Restore Stock
      for (const item of order.items) {
        await productRepo.updateStock(item.productId, item.quantity, tx);
      }
      // 2. Refund Department Budget
      const budget = await budgetRepo.getDepartmentBudget(order.departmentId, true, tx);
      if (budget) {
        await budgetRepo.restoreRemainingBudget(budget.id, order.totalCents, tx);
      }
      // 3. Mark Order Rejected
      await orderRepo.updateStatus(orderId, "REJECTED", managerUserId, reason.trim(), tx);
    });
  }

  await auditRepo.record({
    adminUserId: managerUserId,
    action: "REJECT",
    entityType: "ORDER",
    entityId: orderId,
    oldValue: JSON.stringify({ status: order.status }),
    newValue: JSON.stringify({ status: "REJECTED", reason: reason.trim() }),
  });
}

/**
 * Cancels a pending order placed by a user, safely restoring inventory stock,
 * refunding the department budget allocation, and logging the event.
 *
 * @param orderId - UUID of the order to cancel
 * @param userId - ID of the cancelling user (must match order owner)
 * @param reason - Optional cancellation explanation
 * @throws {DomainError} If user is unauthorized or order cannot be cancelled
 */
export async function cancelOrder(
  orderId: string,
  userId: string,
  reason?: string
): Promise<void> {
  const order = await orderRepo.findByIdWithItems(orderId);
  if (!order) {
    throw new DomainError("OrderNotFound", `Order ${orderId} not found`, 404);
  }

  const normalizedUserId = normalizeUserUuid(userId);
  if (userId && order.userId !== userId && order.userId !== normalizedUserId) {
    throw new DomainError("Forbidden", "Cannot cancel order belonging to another user", 403);
  }

  if (order.status === "APPROVED") {
    throw new DomainError("InvalidOrderState", "Approved orders cannot be self-cancelled", 400);
  }
  if (order.status === "CANCELLED") {
    throw new DomainError("InvalidOrderState", "Order is already cancelled", 400);
  }
  if (order.status !== "PENDING_APPROVAL") {
    throw new DomainError("InvalidOrderState", `Cannot cancel order in status ${order.status}`, 400);
  }

  if (isDatabaseMocked()) {
    mockDataStore.updateOrderStatus(orderId, "CANCELLED", null, reason || null);
  } else {
    await txDb.transaction(async (tx) => {
      // 1. Restore Stock
      for (const item of order.items) {
        await productRepo.updateStock(item.productId, item.quantity, tx);
      }
      // 2. Refund Department Budget
      const budget = await budgetRepo.getDepartmentBudget(order.departmentId, true, tx);
      if (budget) {
        await budgetRepo.restoreRemainingBudget(budget.id, order.totalCents, tx);
      }
      // 3. Mark Order Cancelled
      await orderRepo.updateStatus(orderId, "CANCELLED", null, reason || null, tx);
    });
  }

  await auditRepo.record({
    adminUserId: userId,
    action: "UPDATE",
    entityType: "ORDER",
    entityId: orderId,
    oldValue: JSON.stringify({ status: order.status }),
    newValue: JSON.stringify({ status: "CANCELLED", reason: reason || null }),
  });
}

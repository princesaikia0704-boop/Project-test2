/**
 * Corporate Office Store - Inventory Domain Service
 * Coordinates inventory level adjustments, negative inventory guards,
 * threshold alerting, and mandatory audit log generation.
 */

import { productRepo } from "@/repositories/product.repo";
import { auditRepo } from "@/repositories/audit.repo";
import { Product } from "@/lib/db/schema";
import { DomainError } from "@/services/order.service";

export interface StockAdjustmentInput {
  productId: string;
  newQuantity?: number;
  delta?: number;
  reason: string;
  adminUserId?: string;
}

export interface StockAdjustmentResult {
  productId: string;
  oldStock: number;
  newStock: number;
  isLowStock: boolean;
}

/**
 * Adjusts product inventory stock by delta or direct assignment,
 * preventing negative stock and creating an audit record.
 *
 * @param input - Product ID, delta or newQuantity, reason, and admin user ID
 * @returns Product stock details and low stock warning flag
 * @throws {DomainError} If product does not exist, reason is omitted, or stock would become negative
 */
export async function adjustProductStock(
  input: StockAdjustmentInput
): Promise<StockAdjustmentResult> {
  // 1. Validation
  if (!input.reason || typeof input.reason !== "string" || input.reason.trim().length === 0) {
    throw new DomainError("MissingReason", "Adjustment reason is required", 400);
  }

  // 2. Fetch Target Product
  const product = await productRepo.findById(input.productId);
  if (!product) {
    throw new DomainError("ProductNotFound", `Product ${input.productId} not found`, 404);
  }

  const oldStock = product.stockQuantity;
  let targetStock: number;
  let updatedProduct: Product;

  if (typeof input.delta === "number") {
    if (oldStock + input.delta < 0) {
      throw new DomainError("NegativeStockError", "Stock quantity cannot be less than 0", 400);
    }
    try {
      updatedProduct = await productRepo.updateStock(input.productId, input.delta);
    } catch (err: any) {
      if (err.message && err.message.includes("INSUFFICIENT_STOCK")) {
        throw new DomainError("NegativeStockError", "Stock quantity cannot be less than 0", 400);
      }
      throw err;
    }
    targetStock = updatedProduct.stockQuantity;
  } else if (typeof input.newQuantity === "number") {
    targetStock = input.newQuantity;
    if (targetStock < 0) {
      throw new DomainError("NegativeStockError", "Stock quantity cannot be less than 0", 400);
    }
    updatedProduct = await productRepo.setAbsoluteStock(input.productId, targetStock);
  } else {
    throw new DomainError(
      "MissingQuantityOrDelta",
      "Either newQuantity or delta must be provided",
      400
    );
  }

  // 4. Record Audit Log Entry
  await auditRepo.record({
    adminUserId: input.adminUserId ?? null,
    action: "STOCK_ADJUST",
    entityType: "PRODUCT",
    entityId: input.productId,
    oldValue: JSON.stringify({ stockQuantity: oldStock }),
    newValue: JSON.stringify({ stockQuantity: targetStock, reason: input.reason.trim() }),
  });

  const isLowStock = targetStock <= product.lowStockThreshold;

  return {
    productId: input.productId,
    oldStock,
    newStock: targetStock,
    isLowStock,
  };
}

export async function getLowStockAlerts(): Promise<Product[]> {
  return await productRepo.findLowStockProducts();
}

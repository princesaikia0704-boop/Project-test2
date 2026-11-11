/**
 * Corporate Office Store - Product & Stock Domain Validation Schemas
 */

import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().trim().min(1, "Product name is required").max(255),
  description: z.string().max(2000).optional().default(""),
  sku: z.string().trim().max(100).optional().nullable(),
  priceCents: z
    .number({ required_error: "Price in cents is required" })
    .int("Price must be an integer")
    .min(0, "Price cents must be non-negative"),
  stockQuantity: z
    .number()
    .int("Stock quantity must be an integer")
    .min(0, "Stock quantity must be non-negative")
    .default(0),
  lowStockThreshold: z
    .number()
    .int("Low stock threshold must be an integer")
    .min(0, "Low stock threshold must be non-negative")
    .default(5),
  categoryId: z.string().min(1, "Category ID is required"),
  imageUrl: z.string().url("Invalid image URL").or(z.literal("")).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const updateProductSchema = createProductSchema.partial();

export const stockAdjustSchema = z
  .object({
    newQuantity: z
      .number()
      .int("Quantity must be an integer")
      .min(0, "Stock quantity cannot be less than 0")
      .optional(),
    delta: z.number().int("Delta must be an integer").optional(),
    reason: z
      .string({ required_error: "Adjustment reason is required" })
      .trim()
      .min(1, "Adjustment reason is required")
      .max(500),
  })
  .refine(
    (data) => data.newQuantity !== undefined || data.delta !== undefined,
    { message: "Either newQuantity or delta must be provided" }
  );

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type StockAdjustInput = z.infer<typeof stockAdjustSchema>;

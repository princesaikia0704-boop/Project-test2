/**
 * Corporate Office Store - Product & Stock Domain Validation Schemas
 */

import { z } from "zod";
import { sanitizeSafeUrl } from "@/lib/security/url";

const PG_MAX_INT = 2_147_483_647;

export const safeImageUrlSchema = z
  .string()
  .trim()
  .max(2048, "Image URL too long")
  .refine(
    (val) => {
      if (val === "") return true;
      return sanitizeSafeUrl(val, { allowRelative: true, allowDataImage: true }) !== null;
    },
    "Image URL must be an HTTPS/HTTP URL, safe /path, or raster image data URI"
  );

const baseProductFields = {
  name: z.string().trim().min(1, "Product name is required").max(255),
  description: z.string().trim().max(2000),
  sku: z.string().trim().max(100).nullable(),
  priceCents: z
    .number({ required_error: "Price in cents is required" })
    .int("Price must be an integer")
    .min(0, "Price cents must be non-negative")
    .max(PG_MAX_INT, "Price cents exceeds maximum integer limit"),
  stockQuantity: z
    .number()
    .int("Stock quantity must be an integer")
    .min(0, "Stock quantity must be non-negative")
    .max(PG_MAX_INT, "Stock quantity exceeds maximum integer limit"),
  lowStockThreshold: z
    .number()
    .int("Low stock threshold must be an integer")
    .min(0, "Low stock threshold must be non-negative")
    .max(PG_MAX_INT, "Low stock threshold exceeds maximum integer limit"),
  categoryId: z
    .string()
    .trim()
    .min(1, "Category ID is required")
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/, "Invalid category ID format"),
  imageUrl: safeImageUrlSchema.nullable(),
  isActive: z.boolean(),
};

export const createProductSchema = z.object({
  ...baseProductFields,
  description: baseProductFields.description.optional().default(""),
  sku: baseProductFields.sku.optional(),
  stockQuantity: baseProductFields.stockQuantity.default(0),
  lowStockThreshold: baseProductFields.lowStockThreshold.default(5),
  imageUrl: baseProductFields.imageUrl.optional(),
  isActive: baseProductFields.isActive.default(true),
});

// Separate partial schema without .default() so omitted PATCH keys stay undefined
export const updateProductSchema = z
  .object({
    id: z
      .string({ required_error: "Product ID is required" })
      .trim()
      .min(1, "Product ID is required")
      .max(100)
      .regex(/^[a-zA-Z0-9_-]+$/, "Invalid product ID format"),
    name: baseProductFields.name.optional(),
    description: baseProductFields.description.optional(),
    sku: baseProductFields.sku.optional(),
    priceCents: baseProductFields.priceCents.optional(),
    stockQuantity: baseProductFields.stockQuantity.optional(),
    lowStockThreshold: baseProductFields.lowStockThreshold.optional(),
    categoryId: baseProductFields.categoryId.optional(),
    imageUrl: baseProductFields.imageUrl.optional(),
    isActive: baseProductFields.isActive.optional(),
  })
  .strict();

export const stockAdjustSchema = z
  .object({
    newQuantity: z
      .number()
      .int("Quantity must be an integer")
      .min(0, "Stock quantity cannot be less than 0")
      .max(PG_MAX_INT, "Stock quantity exceeds maximum integer limit")
      .optional(),
    delta: z
      .number()
      .int("Delta must be an integer")
      .min(-PG_MAX_INT)
      .max(PG_MAX_INT)
      .optional(),
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

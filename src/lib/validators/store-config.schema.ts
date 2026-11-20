/**
 * Corporate Office Store - Store Configuration & Budget Validation Schemas
 */

import { z } from "zod";

const hexColorRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

export const storeSettingsSchema = z.object({
  autoApproveLimitCents: z
    .number({ required_error: "Auto-approve limit is required" })
    .int("Limit must be an integer")
    .min(0, "Approval threshold cannot be negative"),
  companyName: z
    .string({ required_error: "Company name is required" })
    .trim()
    .min(1, "Company name is required")
    .max(255),
  primaryColor: z
    .string({ required_error: "Primary color is required" })
    .trim()
    .regex(hexColorRegex, "Primary color must be valid hex code"),
  logoUrl: z
    .string()
    .refine(
      (val) =>
        val === "" ||
        val.startsWith("/") ||
        val.startsWith("data:") ||
        /^https?:\/\//i.test(val),
      "Invalid logo URL or path"
    )
    .optional()
    .nullable(),
  currency: z.string().trim().length(3, "Currency code must be 3 characters").default("INR"),
});

export const updateStoreSettingsSchema = storeSettingsSchema.partial();

export const budgetUpdateSchema = z
  .object({
    totalCents: z
      .number({ required_error: "Total cents is required" })
      .int("Total cents must be an integer")
      .min(0, "Total budget cents must be non-negative"),
    remainingCents: z
      .number()
      .int("Remaining cents must be an integer")
      .min(0, "Remaining budget cents must be non-negative")
      .optional(),
    periodStart: z.coerce.date().optional(),
    periodEnd: z.coerce.date().optional(),
  })
  .refine(
    (data) => {
      if (data.remainingCents !== undefined && data.remainingCents > data.totalCents) {
        return false;
      }
      return true;
    },
    { message: "Remaining cents cannot exceed total cents" }
  )
  .refine(
    (data) => {
      if (data.periodStart && data.periodEnd && data.periodStart > data.periodEnd) {
        return false;
      }
      return true;
    },
    { message: "Period start date must precede period end date" }
  );

export const presignUploadSchema = z.object({
  filename: z
    .string({ required_error: "Filename is required" })
    .trim()
    .min(1, "Filename is required"),
  fileSizeBytes: z
    .number()
    .int()
    .min(0)
    .max(10 * 1024 * 1024, "File size exceeds 10MB limit")
    .optional(),
  contentType: z.string().optional(),
});

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Category name is required").max(255),
  slug: z.string().trim().min(1, "Category slug is required").max(255),
  parentId: z.string().min(1).optional().nullable(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const updateCategorySchema = categorySchema.partial();

export type StoreSettingsInput = z.infer<typeof storeSettingsSchema>;
export type UpdateStoreSettingsInput = z.infer<typeof updateStoreSettingsSchema>;
export type BudgetUpdateInput = z.infer<typeof budgetUpdateSchema>;
export type PresignUploadInputPayload = z.infer<typeof presignUploadSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

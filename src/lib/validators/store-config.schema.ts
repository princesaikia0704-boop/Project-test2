/**
 * Corporate Office Store - Store Configuration, Upload & Query Validation Schemas
 */

import { z } from "zod";
import { sanitizeSafeUrl } from "@/lib/security/url";

const PG_MAX_INT = 2_147_483_647;
const hexColorRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const safeLogoUrlSchema = z
  .string()
  .trim()
  .max(2048, "Logo URL too long")
  .refine(
    (val) => {
      if (val === "") return true;
      return sanitizeSafeUrl(val, { allowRelative: true, allowDataImage: true }) !== null;
    },
    "Invalid or unsafe logo URL (must be HTTPS/HTTP, safe /path, or PNG/JPG/WebP/GIF data URI)"
  );

export const storeSettingsSchema = z.object({
  autoApproveLimitCents: z
    .number({ required_error: "Auto-approve limit is required" })
    .int("Limit must be an integer")
    .min(0, "Approval threshold cannot be negative")
    .max(PG_MAX_INT, "Approval threshold exceeds maximum limit"),
  companyName: z
    .string({ required_error: "Company name is required" })
    .trim()
    .min(1, "Company name is required")
    .max(255),
  primaryColor: z
    .string({ required_error: "Primary color is required" })
    .trim()
    .regex(hexColorRegex, "Primary color must be valid hex code"),
  logoUrl: safeLogoUrlSchema.optional().nullable(),
  currency: z.string().trim().length(3, "Currency code must be 3 characters").default("INR"),
});

// Separate partial schema without .default() so PATCH/PUT doesn't overwrite omitted fields
export const updateStoreSettingsSchema = z.object({
  autoApproveLimitCents: storeSettingsSchema.shape.autoApproveLimitCents.optional(),
  companyName: storeSettingsSchema.shape.companyName.optional(),
  primaryColor: storeSettingsSchema.shape.primaryColor.optional(),
  logoUrl: safeLogoUrlSchema.optional().nullable(),
  currency: z.string().trim().length(3, "Currency code must be 3 characters").optional(),
});

export const budgetUpdateSchema = z
  .object({
    totalCents: z
      .number({ required_error: "Total cents is required" })
      .int("Total cents must be an integer")
      .min(0, "Total budget cents must be non-negative")
      .max(PG_MAX_INT),
    remainingCents: z
      .number()
      .int("Remaining cents must be an integer")
      .min(0, "Remaining budget cents must be non-negative")
      .max(PG_MAX_INT)
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
    .min(1, "Filename is required")
    .max(255, "Filename is too long")
    .refine(
      (name) => !name.includes("..") && !name.includes("/") && !name.includes("\\") && !name.includes("\0"),
      "Invalid filename path characters"
    ),
  fileSizeBytes: z
    .number()
    .int("File size must be an integer")
    .min(1, "File size must be positive")
    .max(10 * 1024 * 1024, "File size exceeds 10MB limit")
    .optional(),
  contentType: z
    .enum([
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
      "text/csv",
      "application/csv",
      "application/pdf",
      "application/octet-stream",
    ])
    .optional(),
});

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Category name is required").max(255),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Category slug is required")
    .max(120)
    .regex(slugRegex, "Category slug must be lowercase alphanumeric with hyphens"),
  parentId: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/, "Invalid parent category ID")
    .optional()
    .nullable(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(-10_000).max(10_000).default(0),
});

export const updateCategorySchema = z.object({
  id: z
    .string({ required_error: "Category ID is required" })
    .trim()
    .min(1, "Category ID is required")
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/, "Invalid category ID"),
  name: z.string().trim().min(1, "Category name cannot be empty").max(255).optional(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Category slug cannot be empty")
    .max(120)
    .regex(slugRegex, "Category slug must be lowercase alphanumeric with hyphens")
    .optional(),
  parentId: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/, "Invalid parent category ID")
    .optional()
    .nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(-10_000).max(10_000).optional(),
});

export const auditLogQuerySchema = z.object({
  entityType: z
    .enum(["ALL", "PRODUCT", "CATEGORY", "ORDER", "STORE_SETTINGS", "DEPARTMENT_BUDGET", "USER", "DEPARTMENT"])
    .optional(),
  action: z
    .enum(["ALL", "CREATE", "UPDATE", "DELETE", "APPROVE", "REJECT", "STOCK_ADJUST", "CONFIG_UPDATE"])
    .optional(),
  from: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), "Invalid 'from' date")
    .optional(),
  to: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), "Invalid 'to' date")
    .optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type StoreSettingsInput = z.infer<typeof storeSettingsSchema>;
export type UpdateStoreSettingsInput = z.infer<typeof updateStoreSettingsSchema>;
export type BudgetUpdateInput = z.infer<typeof budgetUpdateSchema>;
export type PresignUploadInputPayload = z.infer<typeof presignUploadSchema>;

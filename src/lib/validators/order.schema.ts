/**
 * Corporate Office Store - Order Domain Validation Schemas
 * Implements strict Zod validation with bounded integers and URL/UUID safety.
 */

import { z } from "zod";

export const orderStatusSchema = z.enum([
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "FULFILLED",
  "CANCELLED",
]);

export const safeIdentifierSchema = z
  .string({ required_error: "Identifier is required" })
  .trim()
  .min(1, "Identifier is required")
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/, "Invalid identifier format");

export const orderItemInputSchema = z.object({
  productId: safeIdentifierSchema,
  quantity: z
    .number({ required_error: "Quantity is required" })
    .int("Item quantity must be an integer")
    .positive("Item quantity must be greater than 0")
    .max(10_000, "Item quantity cannot exceed 10,000"),
});

export const createOrderSchema = z.object({
  items: z
    .array(orderItemInputSchema)
    .min(1, "Cart items cannot be empty")
    .max(100, "Maximum 100 line items per order"),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const approveOrderSchema = z.object({
  decision: z.literal("APPROVE", {
    errorMap: () => ({ message: "Decision must be either 'APPROVE' or 'REJECT'" }),
  }),
  comment: z.string().trim().max(1000).optional(),
});

export const rejectOrderSchema = z.object({
  decision: z.literal("REJECT", {
    errorMap: () => ({ message: "Decision must be either 'APPROVE' or 'REJECT'" }),
  }),
  comment: z
    .string({ required_error: "Rejection reason comment is required" })
    .trim()
    .min(1, "Rejection reason comment is required")
    .max(1000),
});

export const cancelOrderSchema = z.object({
  reason: z.string().trim().max(1000).optional(),
});

export const orderDecisionSchema = z.discriminatedUnion("decision", [
  approveOrderSchema,
  rejectOrderSchema,
]);

export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type OrderItemInput = z.infer<typeof orderItemInputSchema>;
export type CreateOrderInputPayload = z.infer<typeof createOrderSchema>;
export type ApproveOrderPayload = z.infer<typeof approveOrderSchema>;
export type RejectOrderPayload = z.infer<typeof rejectOrderSchema>;
export type CancelOrderPayload = z.infer<typeof cancelOrderSchema>;
export type OrderDecisionPayload = z.infer<typeof orderDecisionSchema>;

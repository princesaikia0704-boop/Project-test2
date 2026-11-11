/**
 * Corporate Office Store - Order Domain Validation Schemas
 * Implements strict Zod validation with support for both UUID and descriptive mock identifiers.
 */

import { z } from "zod";

export const orderStatusSchema = z.enum([
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "FULFILLED",
  "CANCELLED",
]);

export const orderItemInputSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  quantity: z
    .number({ required_error: "Quantity is required" })
    .int("Quantity must be an integer")
    .positive("Item quantity must be greater than 0"),
});

export const createOrderSchema = z.object({
  items: z
    .array(orderItemInputSchema)
    .min(1, "Cart items cannot be empty"),
  notes: z.string().max(1000).optional().nullable(),
});

export const approveOrderSchema = z.object({
  decision: z.literal("APPROVE", {
    errorMap: () => ({ message: "Decision must be either 'APPROVE' or 'REJECT'" }),
  }),
  comment: z.string().max(1000).optional(),
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
  reason: z.string().max(1000).optional(),
});

// Composite schema for approval queue endpoint receiving either APPROVE or REJECT
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

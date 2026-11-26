/**
 * Corporate Office Store - Notification Dispatch Worker
 * Unconditional fail-closed QStash HMAC verification + strict Zod payload validation.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifySignatureAppRouter } from "@/lib/queue/qstash";
import { logSecurityEvent } from "@/lib/security/logger";
import { extractTrustedClientIp } from "@/lib/security/rate-limit";

const notificationPayloadSchema = z.object({
  type: z.enum([
    "ORDER_CREATED",
    "ORDER_APPROVED",
    "ORDER_REJECTED",
    "LOW_STOCK_ALERT",
    "APPROVAL_NEEDED",
  ]),
  orderId: z.string().trim().max(100).optional(),
  status: z.string().trim().max(50).optional(),
  userId: z.string().trim().max(100).optional(),
  productName: z.string().trim().max(255).optional(),
  remainingStock: z.number().int().min(0).optional(),
  orderNumber: z.string().trim().max(100).optional(),
  rejectionReason: z.string().trim().max(1000).optional(),
  approverEmail: z.string().trim().email().max(255).optional(),
});

type NotificationPayload = z.infer<typeof notificationPayloadSchema>;

const NOTIFICATION_TEMPLATES: Record<
  NotificationPayload["type"],
  (payload: NotificationPayload) => { subject: string; body: string }
> = {
  ORDER_CREATED: (p) => ({
    subject: `Order #${p.orderNumber ?? p.orderId ?? "N/A"} Submitted`,
    body: `Your order #${p.orderNumber ?? p.orderId ?? "N/A"} has been submitted and is awaiting approval.`,
  }),
  ORDER_APPROVED: (p) => ({
    subject: `Order #${p.orderNumber ?? p.orderId ?? "N/A"} Approved`,
    body: `Your order #${p.orderNumber ?? p.orderId ?? "N/A"} has been approved and will be fulfilled shortly.`,
  }),
  ORDER_REJECTED: (p) => ({
    subject: `Order #${p.orderNumber ?? p.orderId ?? "N/A"} Rejected`,
    body: `Your order #${p.orderNumber ?? p.orderId ?? "N/A"} has been rejected.${
      p.rejectionReason ? ` Reason: ${p.rejectionReason}` : ""
    }`,
  }),
  LOW_STOCK_ALERT: (p) => ({
    subject: `Low Stock Alert: ${p.productName ?? "Unknown Product"}`,
    body: `Product ${p.productName ?? "Unknown"} is running low (${
      p.remainingStock ?? 0
    } units remaining). Please reorder soon.`,
  }),
  APPROVAL_NEEDED: (p) => ({
    subject: `Approval Required: Order #${p.orderNumber ?? p.orderId ?? "N/A"}`,
    body: `Order #${p.orderNumber ?? p.orderId ?? "N/A"} requires your approval. Please review it in the admin dashboard.`,
  }),
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const clientIp = extractTrustedClientIp(req);

  try {
    const rawBody = await req.text();

    // Unconditional QStash signature verification (fail-closed)
    const { isValid, error } = await verifySignatureAppRouter(req, rawBody);
    if (!isValid) {
      logSecurityEvent({
        event: "AUTH_SESSION_INVALID",
        severity: "HIGH",
        ip: clientIp,
        path: "/api/workers/notifications",
        method: "POST",
        reason: error ?? "QStash signature verification failed",
      });
      return NextResponse.json(
        { error: "InvalidSignature", message: "Signature verification failed" },
        { status: 401 }
      );
    }

    let rawJson: unknown;
    try {
      rawJson = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: "BadRequest", message: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    const parsed = notificationPayloadSchema.safeParse(rawJson);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "InvalidNotification",
          message: parsed.error.issues[0]?.message || "Invalid notification payload",
        },
        { status: 400 }
      );
    }

    const template = NOTIFICATION_TEMPLATES[parsed.data.type](parsed.data);

    return NextResponse.json(
      {
        sent: true,
        channel: "log",
        type: parsed.data.type,
        subject: template.subject,
      },
      { status: 200 }
    );
  } catch (error: any) {
    logSecurityEvent({
      event: "UNHANDLED_SERVER_ERROR",
      severity: "HIGH",
      ip: clientIp,
      path: "/api/workers/notifications",
      method: "POST",
      reason: error?.message ?? "Notification worker failure",
    });
    return NextResponse.json(
      {
        error: "InternalServerError",
        message: "An unexpected error occurred during notification dispatch",
        sent: false,
      },
      { status: 500 }
    );
  }
}

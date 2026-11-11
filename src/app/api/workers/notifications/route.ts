/**
 * Corporate Office Store - Notification Dispatch Worker
 * Receives async notification jobs from Upstash QStash and dispatches via
 * email (Resend) and/or Slack webhooks. Currently operates in log-only mock mode.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@/lib/queue/qstash";

// ── Types ────────────────────────────────────────────────────────────────────
type NotificationType =
  | "ORDER_CREATED"
  | "ORDER_APPROVED"
  | "ORDER_REJECTED"
  | "LOW_STOCK_ALERT"
  | "APPROVAL_NEEDED";

interface NotificationPayload {
  type: NotificationType;
  orderId?: string;
  status?: string;
  userId?: string;
  productName?: string;
  remainingStock?: number;
  orderNumber?: string;
  rejectionReason?: string;
  approverEmail?: string;
  [key: string]: unknown;
}

interface NotificationResult {
  sent: boolean;
  channel: string;
  type: string;
}

// ── Notification Templates ───────────────────────────────────────────────────
const NOTIFICATION_TEMPLATES: Record<
  NotificationType,
  (payload: NotificationPayload) => { subject: string; body: string }
> = {
  ORDER_CREATED: (p) => ({
    subject: `Order #${p.orderNumber ?? p.orderId} Submitted`,
    body: `Your order #${p.orderNumber ?? p.orderId} has been submitted and is awaiting approval.`,
  }),
  ORDER_APPROVED: (p) => ({
    subject: `Order #${p.orderNumber ?? p.orderId} Approved`,
    body: `Your order #${p.orderNumber ?? p.orderId} has been approved and will be fulfilled shortly.`,
  }),
  ORDER_REJECTED: (p) => ({
    subject: `Order #${p.orderNumber ?? p.orderId} Rejected`,
    body: `Your order #${p.orderNumber ?? p.orderId} has been rejected.${
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
    subject: `Approval Required: Order #${p.orderNumber ?? p.orderId}`,
    body: `Order #${p.orderNumber ?? p.orderId} requires your approval. Please review it in the admin dashboard.`,
  }),
};

// ── POST Handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Read raw body for signature verification
    const rawBody = await req.text();

    // 2. Verify QStash signature if signing key is configured
    if (process.env.QSTASH_CURRENT_SIGNING_KEY) {
      const { isValid, error } = await verifySignatureAppRouter(req, rawBody);
      if (!isValid) {
        console.error("[notifications] QStash signature verification failed:", error);
        return NextResponse.json(
          { error: "InvalidSignature", message: error ?? "Signature verification failed" },
          { status: 401 }
        );
      }
    }

    // 3. Parse payload
    const payload: NotificationPayload = JSON.parse(rawBody);

    if (!payload.type) {
      return NextResponse.json(
        { error: "BadRequest", message: "Missing notification type" },
        { status: 400 }
      );
    }

    // 4. Resolve notification template
    const templateFn = NOTIFICATION_TEMPLATES[payload.type];
    if (!templateFn) {
      return NextResponse.json(
        { error: "BadRequest", message: `Unsupported notification type: ${payload.type}` },
        { status: 400 }
      );
    }

    const { subject, body } = templateFn(payload);

    // 5. Dispatch notification via available channels
    //    Currently in mock/log mode — all notifications are console-logged.

    console.log(
      `[notifications] ─── Dispatching notification ───\n` +
        `  Type:    ${payload.type}\n` +
        `  To:      ${payload.userId ?? "N/A"}\n` +
        `  Subject: ${subject}\n` +
        `  Body:    ${body}\n` +
        `  OrderId: ${payload.orderId ?? "N/A"}\n` +
        `────────────────────────────────────────────────`
    );

    // TODO: Resend email integration
    // Uncomment when RESEND_API_KEY is configured:
    //
    // import { Resend } from "resend";
    // const resend = new Resend(process.env.RESEND_API_KEY);
    //
    // if (process.env.RESEND_API_KEY && payload.userId) {
    //   try {
    //     const userEmail = await resolveUserEmail(payload.userId);
    //     await resend.emails.send({
    //       from: `${process.env.COMPANY_NAME ?? "Office Store"} <notifications@${process.env.RESEND_DOMAIN ?? "example.com"}>`,
    //       to: userEmail,
    //       subject,
    //       text: body,
    //     });
    //     console.log(`[notifications] Email sent to ${userEmail}`);
    //   } catch (emailErr: any) {
    //     console.error("[notifications] Email send failed:", emailErr.message);
    //   }
    // }

    // TODO: Slack webhook integration
    // Uncomment when SLACK_WEBHOOK_URL is configured:
    //
    // if (process.env.SLACK_WEBHOOK_URL) {
    //   try {
    //     await fetch(process.env.SLACK_WEBHOOK_URL, {
    //       method: "POST",
    //       headers: { "Content-Type": "application/json" },
    //       body: JSON.stringify({
    //         text: `*${subject}*\n${body}`,
    //         blocks: [
    //           {
    //             type: "section",
    //             text: {
    //               type: "mrkdwn",
    //               text: `*${subject}*\n${body}`,
    //             },
    //           },
    //         ],
    //       }),
    //     });
    //     console.log("[notifications] Slack message sent");
    //   } catch (slackErr: any) {
    //     console.error("[notifications] Slack webhook failed:", slackErr.message);
    //   }
    // }

    const result: NotificationResult = {
      sent: true,
      channel: "log",
      type: payload.type,
    };

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("[notifications] Worker error:", error);
    return NextResponse.json(
      {
        error: "InternalServerError",
        message: error.message ?? "An unexpected error occurred during notification dispatch",
        sent: false,
      },
      { status: 500 }
    );
  }
}

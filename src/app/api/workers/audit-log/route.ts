/**
 * Corporate Office Store - Async Audit Trail Writer Worker
 * Always verifies Upstash QStash HMAC signature (fail-closed) and validates via Zod.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifySignatureAppRouter } from "@/lib/queue/qstash";
import { auditRepo } from "@/repositories/audit.repo";
import type { AuditAction, EntityType } from "@/lib/db/schema";
import { logSecurityEvent } from "@/lib/security/logger";
import { extractTrustedClientIp } from "@/lib/security/rate-limit";

const auditWorkerPayloadSchema = z.object({
  adminUserId: z.string().trim().min(1).max(100),
  action: z.enum(["CREATE", "UPDATE", "DELETE", "APPROVE", "REJECT", "STOCK_ADJUST", "CONFIG_UPDATE"]),
  entityType: z.enum(["PRODUCT", "CATEGORY", "ORDER", "STORE_SETTINGS", "DEPARTMENT_BUDGET", "USER", "DEPARTMENT"]),
  entityId: z.string().trim().min(1).max(100),
  oldValue: z.record(z.unknown()).nullable().optional(),
  newValue: z.record(z.unknown()).nullable().optional(),
  ipAddress: z.string().trim().max(45).optional(),
  userAgent: z.string().trim().max(500).optional(),
});

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
        path: "/api/workers/audit-log",
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
        { error: "BadRequest", message: "Invalid JSON payload", logged: false, auditLogId: "" },
        { status: 400 }
      );
    }

    const parsed = auditWorkerPayloadSchema.safeParse(rawJson);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "InvalidAuditPayload",
          message: parsed.error.issues[0]?.message || "Invalid audit log payload",
          logged: false,
          auditLogId: "",
        },
        { status: 400 }
      );
    }

    const payload = parsed.data;
    const oldValueStr = payload.oldValue ? JSON.stringify(payload.oldValue) : null;
    const newValueStr = payload.newValue ? JSON.stringify(payload.newValue) : null;

    const auditLog = await auditRepo.record({
      adminUserId: payload.adminUserId,
      action: payload.action as AuditAction,
      entityType: payload.entityType as EntityType,
      entityId: payload.entityId,
      oldValue: oldValueStr,
      newValue: newValueStr,
      ipAddress: payload.ipAddress ?? clientIp ?? null,
      userAgent: payload.userAgent ?? req.headers.get("user-agent") ?? null,
    });

    return NextResponse.json(
      {
        logged: true,
        auditLogId: auditLog.id,
      },
      { status: 200 }
    );
  } catch (error: any) {
    logSecurityEvent({
      event: "UNHANDLED_SERVER_ERROR",
      severity: "WARN",
      ip: clientIp,
      path: "/api/workers/audit-log",
      method: "POST",
      reason: error?.message ?? "Failed to write audit log entry",
    });
    return NextResponse.json(
      {
        logged: false,
        auditLogId: "",
        error: "AuditWriteFailed",
        message: "Failed to write audit log entry",
      },
      { status: 200 }
    );
  }
}

/**
 * Corporate Office Store - Async Audit Trail Writer Worker
 * Receives audit log entries from Upstash QStash and persists them to the
 * audit_logs table. Designed to never throw — audit logging failures are
 * logged but do not crash the worker.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@/lib/queue/qstash";
import { auditRepo } from "@/repositories/audit.repo";
import type { AuditAction, EntityType } from "@/lib/db/schema";

// ── Types ────────────────────────────────────────────────────────────────────
interface AuditLogPayload {
  adminUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: object | null;
  newValue?: object | null;
  ipAddress?: string;
  userAgent?: string;
}

interface AuditLogResult {
  logged: boolean;
  auditLogId: string;
}

// ── POST Handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Read raw body for signature verification
    const rawBody = await req.text();

    // 2. Verify QStash signature if signing key is configured
    if (process.env.QSTASH_CURRENT_SIGNING_KEY) {
      const { isValid, error } = await verifySignatureAppRouter(req, rawBody);
      if (!isValid) {
        console.error("[audit-log] QStash signature verification failed:", error);
        return NextResponse.json(
          { error: "InvalidSignature", message: error ?? "Signature verification failed" },
          { status: 401 }
        );
      }
    }

    // 3. Parse payload
    let payload: AuditLogPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.error("[audit-log] Invalid JSON payload");
      return NextResponse.json(
        { error: "BadRequest", message: "Invalid JSON payload", logged: false, auditLogId: "" },
        { status: 400 }
      );
    }

    // 4. Validate required fields
    if (!payload.adminUserId || !payload.action || !payload.entityType || !payload.entityId) {
      const missing = [
        !payload.adminUserId && "adminUserId",
        !payload.action && "action",
        !payload.entityType && "entityType",
        !payload.entityId && "entityId",
      ].filter(Boolean);

      console.warn("[audit-log] Missing required fields:", missing.join(", "));
      return NextResponse.json(
        {
          error: "BadRequest",
          message: `Missing required fields: ${missing.join(", ")}`,
          logged: false,
          auditLogId: "",
        },
        { status: 400 }
      );
    }

    // 5. Serialize old/new values to JSON strings for storage
    const oldValueStr = payload.oldValue
      ? JSON.stringify(payload.oldValue)
      : null;
    const newValueStr = payload.newValue
      ? JSON.stringify(payload.newValue)
      : null;

    // 6. Write audit log entry via repository
    const auditLog = await auditRepo.record({
      adminUserId: payload.adminUserId,
      action: payload.action as AuditAction,
      entityType: payload.entityType as EntityType,
      entityId: payload.entityId,
      oldValue: oldValueStr,
      newValue: newValueStr,
      ipAddress: payload.ipAddress ?? req.headers.get("x-forwarded-for") ?? null,
      userAgent: payload.userAgent ?? req.headers.get("user-agent") ?? null,
    });

    const result: AuditLogResult = {
      logged: true,
      auditLogId: auditLog.id,
    };

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    // Audit logging should NEVER crash — absorb the error and return gracefully
    console.error("[audit-log] Worker error (non-fatal):", error?.message ?? error);
    return NextResponse.json(
      {
        logged: false,
        auditLogId: "",
        error: "AuditWriteFailed",
        message: error?.message ?? "Failed to write audit log entry",
      },
      { status: 200 } // Intentionally 200 — audit failures should not trigger QStash retries
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { withApiReliability, createErrorResponse } from "@/lib/http/api-handler";
import { getStoreSettings, updateStoreSettings } from "@/services/store-config.service";
import { DomainError } from "@/services/order.service";
import { db, schema, mockDataStore } from "@/lib/db";
import { isDatabaseMocked } from "@/lib/mock/utils";
import { eq } from "drizzle-orm";

export const GET = withApiReliability(
  async () => {
    const settings = await getStoreSettings();

    // Query department budgets
    let budgets: any[] = [];
    if (isDatabaseMocked()) {
      const allDepts = mockDataStore.getDepartments();
      const allBudgets = mockDataStore.getDepartmentBudgets();
      budgets = allBudgets.map((b) => {
        const dept = allDepts.find((d) => d.id === b.departmentId);
        return {
          id: b.id,
          departmentId: b.departmentId,
          departmentName: dept?.name || b.departmentId,
          totalCents: b.totalCents,
          remainingCents: b.remainingCents,
          periodStart: b.periodStart instanceof Date ? b.periodStart.toISOString() : String(b.periodStart),
          periodEnd: b.periodEnd instanceof Date ? b.periodEnd.toISOString() : String(b.periodEnd),
        };
      });
    } else {
      const dbBudgets = await db
        .select({
          id: schema.departmentBudgets.id,
          departmentId: schema.departmentBudgets.departmentId,
          totalCents: schema.departmentBudgets.totalCents,
          remainingCents: schema.departmentBudgets.remainingCents,
          periodStart: schema.departmentBudgets.periodStart,
          periodEnd: schema.departmentBudgets.periodEnd,
          departmentName: schema.departments.name,
        })
        .from(schema.departmentBudgets)
        .leftJoin(
          schema.departments,
          eq(schema.departmentBudgets.departmentId, schema.departments.id)
        );
      budgets = dbBudgets.map((b) => ({
        id: b.id,
        departmentId: b.departmentId,
        departmentName: b.departmentName || b.departmentId,
        totalCents: b.totalCents,
        remainingCents: b.remainingCents,
        periodStart: b.periodStart ? new Date(b.periodStart).toISOString() : new Date().toISOString(),
        periodEnd: b.periodEnd ? new Date(b.periodEnd).toISOString() : new Date().toISOString(),
      }));
    }

    const config = {
      auto_approve_limit_cents: settings.autoApproveLimitCents ?? 10000,
      company_name: settings.companyName ?? "Corporate Office Store",
      primary_color: settings.primaryColor ?? "#4F46E5",
      logo_url: settings.logoUrl ?? "",
    };

    return NextResponse.json(
      {
        success: true,
        settings,
        config,
        budgets,
      },
      { status: 200 }
    );
  },
  { allowedRoles: ["ADMIN", "MANAGER", "EMPLOYEE"] }
);

async function handleUpdateConfig(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return createErrorResponse(
      "ValidationError",
      "Request body must be valid JSON",
      400
    );
  }

  if (!body || typeof body !== "object") {
    return createErrorResponse(
      "ValidationError",
      "Configuration payload is required",
      400
    );
  }

  const autoApproveLimitCents =
    body.auto_approve_limit_cents !== undefined
      ? body.auto_approve_limit_cents
      : body.autoApproveLimitCents;

  if (
    autoApproveLimitCents !== undefined &&
    (typeof autoApproveLimitCents !== "number" || autoApproveLimitCents < 0)
  ) {
    return createErrorResponse(
      "InvalidThreshold",
      "Approval threshold cannot be negative",
      400
    );
  }

  const primaryColor =
    body.primary_color !== undefined ? body.primary_color : body.primaryColor;

  if (primaryColor !== undefined) {
    const hex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
    if (!hex.test(primaryColor)) {
      return createErrorResponse(
        "InvalidColor",
        "Primary color must be valid hex code",
        400
      );
    }
  }

  const companyName =
    body.company_name !== undefined ? body.company_name : body.companyName;
  const logoUrl = body.logo_url !== undefined ? body.logo_url : body.logoUrl;

  const adminUserId = req.headers.get("x-user-id") || "admin";

  try {
    const updated = await updateStoreSettings({
      autoApproveLimitCents,
      companyName,
      primaryColor,
      logoUrl,
      currency: body.currency,
      adminUserId,
    });

    const config = {
      auto_approve_limit_cents: updated.autoApproveLimitCents ?? 10000,
      company_name: updated.companyName ?? "Corporate Office Store",
      primary_color: updated.primaryColor ?? "#4F46E5",
      logo_url: updated.logoUrl ?? "",
    };

    return NextResponse.json(
      {
        success: true,
        settings: updated,
        config,
      },
      { status: 200 }
    );
  } catch (err: any) {
    if (err instanceof DomainError) {
      return createErrorResponse(err.name, err.message, err.statusCode);
    }
    throw err;
  }
}

export const PUT = withApiReliability(handleUpdateConfig, {
  allowedRoles: ["ADMIN", "MANAGER"],
});

export const PATCH = withApiReliability(handleUpdateConfig, {
  allowedRoles: ["ADMIN", "MANAGER"],
});

import { NextRequest, NextResponse } from "next/server";
import { withApiReliability, createErrorResponse, getRequestAuth } from "@/lib/http/api-handler";
import { getStoreSettings, updateStoreSettings } from "@/services/store-config.service";
import { DomainError } from "@/services/order.service";
import { db, schema, mockDataStore } from "@/lib/db";
import { isDatabaseMocked } from "@/lib/mock/utils";
import { eq } from "drizzle-orm";
import { updateStoreSettingsSchema } from "@/lib/validators/store-config.schema";

export const GET = withApiReliability(
  async (req: NextRequest) => {
    const authUser = await getRequestAuth(req);
    const settings = await getStoreSettings();

    // Only expose department budgets to privileged roles (never to EMPLOYEE)
    // and scope MANAGER strictly to their own department budget.
    let budgets: any[] = [];
    if (authUser && (authUser.role === "ADMIN" || authUser.role === "MANAGER")) {
      const isAdmin = authUser.role === "ADMIN";
      if (isDatabaseMocked()) {
        const allDepts = mockDataStore.getDepartments();
        const allBudgets = mockDataStore.getDepartmentBudgets(
          isAdmin ? undefined : authUser.departmentId
        );
        budgets = allBudgets.map((b) => {
          const dept = allDepts.find((d) => d.id === b.departmentId);
          return {
            id: b.id,
            departmentId: b.departmentId,
            departmentName: dept?.name || b.departmentId,
            totalCents: b.totalCents,
            remainingCents: b.remainingCents,
            periodStart:
              b.periodStart instanceof Date
                ? b.periodStart.toISOString()
                : String(b.periodStart),
            periodEnd:
              b.periodEnd instanceof Date
                ? b.periodEnd.toISOString()
                : String(b.periodEnd),
          };
        });
      } else {
        const baseSelect = db
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

        const dbBudgets = isAdmin
          ? await baseSelect
          : await baseSelect.where(
              eq(schema.departmentBudgets.departmentId, authUser.departmentId)
            );

        budgets = dbBudgets.map((b) => ({
          id: b.id,
          departmentId: b.departmentId,
          departmentName: b.departmentName || b.departmentId,
          totalCents: b.totalCents,
          remainingCents: b.remainingCents,
          periodStart: b.periodStart
            ? new Date(b.periodStart).toISOString()
            : new Date().toISOString(),
          periodEnd: b.periodEnd
            ? new Date(b.periodEnd).toISOString()
            : new Date().toISOString(),
        }));
      }
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
        ...(authUser && (authUser.role === "ADMIN" || authUser.role === "MANAGER")
          ? { budgets }
          : {}),
      },
      { status: 200 }
    );
  },
  { allowedRoles: ["ADMIN", "MANAGER", "EMPLOYEE"] }
);

async function handleUpdateConfig(req: NextRequest) {
  const authUser = await getRequestAuth(req);
  if (!authUser) {
    return createErrorResponse("Unauthorized", "Authentication required", 401);
  }

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

  const normalizedInput = {
    autoApproveLimitCents:
      body.auto_approve_limit_cents !== undefined
        ? body.auto_approve_limit_cents
        : body.autoApproveLimitCents,
    companyName:
      body.company_name !== undefined ? body.company_name : body.companyName,
    primaryColor:
      body.primary_color !== undefined ? body.primary_color : body.primaryColor,
    logoUrl: body.logo_url !== undefined ? body.logo_url : body.logoUrl,
    currency: body.currency,
  };

  const parsed = updateStoreSettingsSchema.safeParse(normalizedInput);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const msg = issue?.message || "Invalid store configuration";
    const code = issue?.path.includes("autoApproveLimitCents")
      ? "InvalidThreshold"
      : issue?.path.includes("primaryColor")
      ? "InvalidColor"
      : "ValidationError";
    return createErrorResponse(code, msg, 400);
  }

  try {
    const updated = await updateStoreSettings({
      ...parsed.data,
      adminUserId: authUser.id,
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
  allowedRoles: ["ADMIN"],
});

export const PATCH = withApiReliability(handleUpdateConfig, {
  allowedRoles: ["ADMIN"],
});

/**
 * Corporate Office Store - Department Budget Repository
 * Enforces atomic financial ledger deductions, balance restoration, and overdraft prevention.
 */

import { eq, and, sql } from "drizzle-orm";
import { db, schema, mockDataStore } from "@/lib/db";
import { DepartmentBudget, NewDepartmentBudget } from "@/lib/db/schema";
import { isDatabaseMocked } from "@/lib/mock/utils";
import { normalizeDepartmentUuid } from "@/lib/utils";

export interface IBudgetRepository {
  getDepartmentBudget(
    departmentId: string,
    activeOnly?: boolean,
    tx?: any
  ): Promise<DepartmentBudget | null>;
  deductRemainingBudget(
    budgetId: string,
    amountCents: number,
    tx?: any
  ): Promise<DepartmentBudget>;
  restoreRemainingBudget(
    budgetId: string,
    amountCents: number,
    tx?: any
  ): Promise<DepartmentBudget>;
  updateBudgetLimits(
    budgetId: string,
    updates: Partial<Omit<NewDepartmentBudget, "id" | "departmentId" | "createdAt" | "updatedAt">>,
    tx?: any
  ): Promise<DepartmentBudget>;
}

export class BudgetRepository implements IBudgetRepository {
  async getDepartmentBudget(
    departmentId: string,
    activeOnly = true,
    tx?: any
  ): Promise<DepartmentBudget | null> {
    if (isDatabaseMocked()) {
      if (activeOnly) {
        return (mockDataStore.getActiveBudget(departmentId) as unknown as DepartmentBudget) ?? null;
      }
      const budgets = mockDataStore.getDepartmentBudgets(departmentId);
      return (budgets[0] as unknown as DepartmentBudget) ?? null;
    }

    const client = tx || db;
    const now = new Date();
    const validDeptId = normalizeDepartmentUuid(departmentId);
    const conditions = [eq(schema.departmentBudgets.departmentId, validDeptId)];

    if (activeOnly) {
      conditions.push(sql`${schema.departmentBudgets.periodStart} <= ${now}`);
      conditions.push(sql`${schema.departmentBudgets.periodEnd} >= ${now}`);
    }

    const rows = await client
      .select()
      .from(schema.departmentBudgets)
      .where(and(...conditions))
      .limit(1);

    return rows[0] ?? null;
  }

  async deductRemainingBudget(
    budgetId: string,
    amountCents: number,
    tx?: any
  ): Promise<DepartmentBudget> {
    if (isDatabaseMocked()) {
      return mockDataStore.deductBudget(budgetId, amountCents) as unknown as DepartmentBudget;
    }

    const client = tx || db;
    const rows = await client
      .update(schema.departmentBudgets)
      .set({
        remainingCents: sql`${schema.departmentBudgets.remainingCents} - ${amountCents}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.departmentBudgets.id, budgetId),
          sql`${schema.departmentBudgets.remainingCents} >= ${amountCents}`
        )
      )
      .returning();

    if (!rows || rows.length === 0) {
      throw new Error(
        `InsufficientBudget: Required ${amountCents} cents exceeds remaining department budget.`
      );
    }

    return rows[0];
  }

  async restoreRemainingBudget(
    budgetId: string,
    amountCents: number,
    tx?: any
  ): Promise<DepartmentBudget> {
    if (isDatabaseMocked()) {
      return mockDataStore.refundBudget(budgetId, amountCents) as unknown as DepartmentBudget;
    }

    const client = tx || db;
    const rows = await client
      .update(schema.departmentBudgets)
      .set({
        remainingCents: sql`LEAST(${schema.departmentBudgets.totalCents}, ${schema.departmentBudgets.remainingCents} + ${amountCents})`,
        updatedAt: new Date(),
      })
      .where(eq(schema.departmentBudgets.id, budgetId))
      .returning();

    if (!rows || rows.length === 0) {
      throw new Error(`Budget not found: ${budgetId}`);
    }

    return rows[0];
  }

  async updateBudgetLimits(
    budgetId: string,
    updates: Partial<Omit<NewDepartmentBudget, "id" | "departmentId" | "createdAt" | "updatedAt">>,
    tx?: any
  ): Promise<DepartmentBudget> {
    if (isDatabaseMocked()) {
      return mockDataStore.updateBudget(budgetId, updates as any) as unknown as DepartmentBudget;
    }

    const client = tx || db;
    const rows = await client
      .update(schema.departmentBudgets)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(schema.departmentBudgets.id, budgetId))
      .returning();

    if (!rows || rows.length === 0) {
      throw new Error(`Budget not found: ${budgetId}`);
    }

    return rows[0];
  }
}

export const budgetRepo = new BudgetRepository();

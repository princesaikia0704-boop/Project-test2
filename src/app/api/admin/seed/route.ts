import { NextRequest, NextResponse } from "next/server";
import { db, schema, mockDataStore } from "@/lib/db";
import { isDatabaseMocked } from "@/lib/mock/utils";
import {
  SEED_DEPARTMENTS,
  SEED_CATEGORIES,
  SEED_PRODUCTS,
  SEED_BUDGETS,
  SEED_USERS,
  SEED_STORE_SETTINGS,
  SEED_AUDIT_LOGS,
} from "@/lib/mock/seed-data";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  if (isDatabaseMocked()) {
    mockDataStore.reset();
    return NextResponse.json({
      success: true,
      message: "In-memory mock database reset and re-seeded with realistic data.",
      mock: true,
    });
  }

  try {
    // 1. Seed Departments
    for (const d of SEED_DEPARTMENTS) {
      const existing = await db
        .select()
        .from(schema.departments)
        .where(eq(schema.departments.id, d.id));
      if (existing.length === 0) {
        await db.insert(schema.departments).values({
          id: d.id,
          name: d.name,
          code: d.code,
        });
      }
    }

    // 2. Seed Categories
    for (const c of SEED_CATEGORIES) {
      const existing = await db
        .select()
        .from(schema.categories)
        .where(eq(schema.categories.id, c.id));
      if (existing.length === 0) {
        await db.insert(schema.categories).values({
          id: c.id,
          name: c.name,
          slug: c.slug,
          parentId: c.parentId,
          isActive: c.isActive,
          sortOrder: c.sortOrder,
        });
      }
    }

    // 3. Seed Products
    for (const p of SEED_PRODUCTS) {
      const existing = await db
        .select()
        .from(schema.products)
        .where(eq(schema.products.id, p.id));
      if (existing.length === 0) {
        await db.insert(schema.products).values({
          id: p.id,
          name: p.name,
          description: p.description,
          sku: p.sku,
          priceCents: p.priceCents,
          stockQuantity: p.stockQuantity,
          lowStockThreshold: p.lowStockThreshold,
          categoryId: p.categoryId,
          imageUrl: p.imageUrl,
          isActive: p.isActive,
        });
      }
    }

    // 4. Seed Department Budgets
    for (const b of SEED_BUDGETS) {
      const existing = await db
        .select()
        .from(schema.departmentBudgets)
        .where(eq(schema.departmentBudgets.id, b.id));
      if (existing.length === 0) {
        await db.insert(schema.departmentBudgets).values({
          id: b.id,
          departmentId: b.departmentId,
          totalCents: b.totalCents,
          remainingCents: b.remainingCents,
          periodStart: b.periodStart,
          periodEnd: b.periodEnd,
        });
      }
    }

    // 5. Seed Users
    for (const u of SEED_USERS) {
      const existing = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, u.id));
      if (existing.length === 0) {
        await db.insert(schema.users).values({
          id: u.id,
          clerkId: u.clerkId,
          email: u.email,
          name: u.name,
          role: u.role,
          departmentId: u.departmentId,
        });
      }
    }

    // 6. Seed Store Settings
    const existingSettings = await db.select().from(schema.storeSettings);
    if (existingSettings.length === 0) {
      await db.insert(schema.storeSettings).values({
        id: 1,
        autoApproveLimitCents: SEED_STORE_SETTINGS.autoApproveLimitCents,
        companyName: SEED_STORE_SETTINGS.companyName,
        primaryColor: SEED_STORE_SETTINGS.primaryColor,
        logoUrl: SEED_STORE_SETTINGS.logoUrl,
        currency: SEED_STORE_SETTINGS.currency,
      });
    }

    // 7. Seed Audit Logs
    const existingLogs = await db.select().from(schema.auditLogs);
    if (existingLogs.length === 0) {
      for (const log of SEED_AUDIT_LOGS) {
        await db.insert(schema.auditLogs).values({
          id: log.id,
          adminUserId: log.adminUserId,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          oldValue: log.oldValue,
          newValue: log.newValue,
          createdAt: log.createdAt,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "PostgreSQL database successfully seeded with initial departments, categories, products, budgets, and settings.",
      mock: false,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to seed PostgreSQL database",
      },
      { status: 500 }
    );
  }
}

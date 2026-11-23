/**
 * One-shot Neon database seeder script.
 * Run ONCE after `npm run db:push` to populate the live Neon DB.
 *
 * Usage:
 *   npx tsx scripts/seed-neon.ts
 *
 * Requires MOCK_DATABASE="false" and DATABASE_URL set in .env.local
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";
import * as schema from "../src/lib/db/schema";
import {
  SEED_DEPARTMENTS,
  SEED_CATEGORIES,
  SEED_PRODUCTS,
  SEED_BUDGETS,
  SEED_USERS,
  SEED_STORE_SETTINGS,
  SEED_AUDIT_LOGS,
} from "../src/lib/mock/seed-data";

// Load .env.local
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let value = trimmed.slice(eqIdx + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = value;
      }
    }
  }
}

loadEnv();

const dbUrl = process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("❌  No DATABASE_URL found. Set it in .env.local first.");
  process.exit(1);
}
if (process.env.MOCK_DATABASE === "true") {
  console.error("❌  MOCK_DATABASE is 'true'. Set it to 'false' in .env.local to seed Neon.");
  process.exit(1);
}

const sql = neon(dbUrl);
const db = drizzle(sql, { schema });

async function seed() {
  console.log("🌱  Seeding Neon PostgreSQL...\n");

  // 1. Departments
  for (const d of SEED_DEPARTMENTS) {
    const existing = await db.select().from(schema.departments).where(eq(schema.departments.id, d.id));
    if (existing.length === 0) {
      await db.insert(schema.departments).values({ id: d.id, name: d.name, code: d.code });
      console.log(`  ✅ Department: ${d.name}`);
    } else {
      console.log(`  ⏭  Department already exists: ${d.name}`);
    }
  }

  // 2. Categories
  for (const c of SEED_CATEGORIES) {
    const existing = await db.select().from(schema.categories).where(eq(schema.categories.id, c.id));
    if (existing.length === 0) {
      await db.insert(schema.categories).values({ id: c.id, name: c.name, slug: c.slug, parentId: c.parentId, isActive: c.isActive, sortOrder: c.sortOrder });
      console.log(`  ✅ Category: ${c.name}`);
    }
  }

  // 3. Products
  for (const p of SEED_PRODUCTS) {
    const existing = await db.select().from(schema.products).where(eq(schema.products.id, p.id));
    if (existing.length === 0) {
      await db.insert(schema.products).values({ id: p.id, name: p.name, description: p.description, sku: p.sku, priceCents: p.priceCents, stockQuantity: p.stockQuantity, lowStockThreshold: p.lowStockThreshold, categoryId: p.categoryId, imageUrl: p.imageUrl, isActive: p.isActive });
      console.log(`  ✅ Product: ${p.name}`);
    }
  }

  // 4. Budgets
  for (const b of SEED_BUDGETS) {
    const existing = await db.select().from(schema.departmentBudgets).where(eq(schema.departmentBudgets.id, b.id));
    if (existing.length === 0) {
      await db.insert(schema.departmentBudgets).values({ id: b.id, departmentId: b.departmentId, totalCents: b.totalCents, remainingCents: b.remainingCents, periodStart: b.periodStart, periodEnd: b.periodEnd });
      console.log(`  ✅ Budget for dept: ${b.departmentId}`);
    }
  }

  // 5. Users
  for (const u of SEED_USERS) {
    const existing = await db.select().from(schema.users).where(eq(schema.users.id, u.id));
    if (existing.length === 0) {
      await db.insert(schema.users).values({ id: u.id, clerkId: u.clerkId, email: u.email, name: u.name, role: u.role, departmentId: u.departmentId });
      console.log(`  ✅ User: ${u.name} (${u.role})`);
    }
  }

  // 6. Store Settings
  const existingSettings = await db.select().from(schema.storeSettings);
  if (existingSettings.length === 0) {
    await db.insert(schema.storeSettings).values({ id: 1, autoApproveLimitCents: SEED_STORE_SETTINGS.autoApproveLimitCents, companyName: SEED_STORE_SETTINGS.companyName, primaryColor: SEED_STORE_SETTINGS.primaryColor, logoUrl: SEED_STORE_SETTINGS.logoUrl, currency: SEED_STORE_SETTINGS.currency });
    console.log(`  ✅ Store settings`);
  }

  // 7. Audit Logs
  const existingLogs = await db.select().from(schema.auditLogs);
  if (existingLogs.length === 0) {
    for (const log of SEED_AUDIT_LOGS) {
      await db.insert(schema.auditLogs).values({ id: log.id, adminUserId: log.adminUserId, action: log.action, entityType: log.entityType, entityId: log.entityId, oldValue: log.oldValue, newValue: log.newValue, createdAt: log.createdAt });
    }
    console.log(`  ✅ Audit logs (${SEED_AUDIT_LOGS.length} entries)`);
  }

  console.log("\n🎉  Seeding complete!");
}

seed().catch((err) => {
  console.error("❌  Seeding failed:", err);
  process.exit(1);
});

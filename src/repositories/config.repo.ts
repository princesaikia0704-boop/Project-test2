/**
 * Corporate Office Store - Store Configuration Repository
 * Manages singleton store settings (branding, currency, auto-approve threshold).
 */

import { eq } from "drizzle-orm";
import { db, schema, mockDataStore } from "@/lib/db";
import { StoreSettings } from "@/lib/db/schema";
import { isDatabaseMocked } from "@/lib/mock/utils";

export interface IConfigRepository {
  getStoreSettings(tx?: any): Promise<StoreSettings>;
  updateStoreSettings(
    data: Partial<Omit<StoreSettings, "id" | "updatedAt">>,
    tx?: any
  ): Promise<StoreSettings>;
}

export class ConfigRepository implements IConfigRepository {
  async getStoreSettings(tx?: any): Promise<StoreSettings> {
    if (isDatabaseMocked()) {
      return mockDataStore.getStoreSettings() as unknown as StoreSettings;
    }

    const client = tx || db;
    const rows = await client
      .select()
      .from(schema.storeSettings)
      .where(eq(schema.storeSettings.id, 1))
      .limit(1);

    if (rows.length > 0) {
      return rows[0];
    }

    // Initialize singleton default row if not found
    const [seeded] = await client
      .insert(schema.storeSettings)
      .values({
        id: 1,
        autoApproveLimitCents: 10000,
        companyName: "Office Store",
        primaryColor: "#0F172A",
        currency: "INR",
      })
      .onConflictDoNothing()
      .returning();

    if (seeded) return seeded;

    const [existing] = await client
      .select()
      .from(schema.storeSettings)
      .where(eq(schema.storeSettings.id, 1))
      .limit(1);

    return existing;
  }

  async updateStoreSettings(
    data: Partial<Omit<StoreSettings, "id" | "updatedAt">>,
    tx?: any
  ): Promise<StoreSettings> {
    if (isDatabaseMocked()) {
      return mockDataStore.updateStoreSettings(data as any) as unknown as StoreSettings;
    }

    const client = tx || db;
    const [updated] = await client
      .update(schema.storeSettings)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(schema.storeSettings.id, 1))
      .returning();

    if (!updated) {
      // Ensure row exists
      await this.getStoreSettings(tx);
      const [reAttempt] = await client
        .update(schema.storeSettings)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(schema.storeSettings.id, 1))
        .returning();
      return reAttempt;
    }

    return updated;
  }
}

export const configRepo = new ConfigRepository();

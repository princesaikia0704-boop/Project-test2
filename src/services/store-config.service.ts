/**
 * Corporate Office Store - Store Configuration Domain Service
 * Manages store branding, currency, approval limit, and cache-aside invalidation.
 */

import { configRepo } from "@/repositories/config.repo";
import { auditRepo } from "@/repositories/audit.repo";
import { redis } from "@/lib/cache/redis";
import { StoreSettings } from "@/lib/db/schema";
import { DomainError } from "@/services/order.service";

export interface UpdateStoreSettingsInput {
  autoApproveLimitCents?: number;
  companyName?: string;
  primaryColor?: string;
  logoUrl?: string | null;
  currency?: string;
  adminUserId?: string;
}

const STORE_CONFIG_CACHE_KEY = "config:store_settings";
const STORE_CONFIG_TTL_SECONDS = 3600; // 1 hour

/**
 * Retrieves the store settings with Redis Cache-Aside optimization.
 * Falls back to database / mock store on cache miss.
 *
 * @returns Current store configuration settings
 */
export async function getStoreSettings(): Promise<StoreSettings> {
  // 1. Redis Cache-Aside Lookup
  try {
    const cached = await redis.get<StoreSettings>(STORE_CONFIG_CACHE_KEY);
    if (cached) return cached;
  } catch {
    // Graceful cache miss fallback
  }

  // 2. Database / Mock Query
  const settings = await configRepo.getStoreSettings();

  // 3. Populate Redis Cache
  if (settings) {
    try {
      await redis.set(STORE_CONFIG_CACHE_KEY, settings, { ex: STORE_CONFIG_TTL_SECONDS });
    } catch {
      // Non-critical cache write failure ignored
    }
  }

  return settings;
}

/**
 * Updates store settings, validates domain constraints (hex colors, positive thresholds),
 * invalidates Redis cache, and writes an audit log entry.
 *
 * @param input - Configuration fields to update
 * @returns Updated store configuration
 * @throws {DomainError} If input values violate validation rules
 */
export async function updateStoreSettings(
  input: UpdateStoreSettingsInput
): Promise<StoreSettings> {
  // 1. Domain Validations
  if (input.autoApproveLimitCents !== undefined && input.autoApproveLimitCents < 0) {
    throw new DomainError("InvalidThreshold", "Approval threshold cannot be negative", 400);
  }

  if (input.primaryColor !== undefined) {
    const hexRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
    if (!hexRegex.test(input.primaryColor)) {
      throw new DomainError("InvalidColor", "Primary color must be valid hex code", 400);
    }
  }

  const oldSettings = await getStoreSettings();

  // 2. Persist Updates
  const { adminUserId, ...settingsData } = input;
  const updatedSettings = await configRepo.updateStoreSettings(settingsData);

  // 3. Invalidate Redis Cache
  try {
    await redis.del(STORE_CONFIG_CACHE_KEY);
  } catch {
    // Cache purge error non-fatal
  }

  // 4. Audit Log Entry
  await auditRepo.record({
    adminUserId: adminUserId ?? null,
    action: "CONFIG_UPDATE",
    entityType: "STORE_SETTINGS",
    entityId: "1",
    oldValue: JSON.stringify(oldSettings),
    newValue: JSON.stringify(updatedSettings),
  });

  return updatedSettings;
}

export async function getAutoApprovalThreshold(): Promise<number> {
  const settings = await getStoreSettings();
  return settings.autoApproveLimitCents ?? 10000;
}

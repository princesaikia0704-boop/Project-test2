/**
 * Corporate Office Store - Distributed Redis Cache & Idempotency Store
 * Transparent fallback to in-memory MockRedisClient when Upstash is unconfigured.
 */

import { Redis } from "@upstash/redis";
import { isServiceMocked } from "@/lib/mock/utils";

export interface IdempotencyEntry<T = any> {
  status: number;
  data: T;
  state: "IN_PROGRESS" | "COMPLETED";
  createdAt: number;
}

export interface IRedisClient {
  get<T = any>(key: string): Promise<T | null>;
  set(
    key: string,
    value: any,
    opts?: { nx?: boolean; ex?: number; px?: number }
  ): Promise<"OK" | null>;
  del(...keys: string[]): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
  flushall(): Promise<"OK">;
}

export class MockRedisClient implements IRedisClient {
  private store = new Map<string, { value: any; expiresAt?: number }>();

  async get<T = any>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    if (typeof entry.value === "string") {
      try {
        return JSON.parse(entry.value) as T;
      } catch {
        return entry.value as unknown as T;
      }
    }
    return entry.value as T;
  }

  async set(
    key: string,
    value: any,
    opts?: { nx?: boolean; ex?: number; px?: number }
  ): Promise<"OK" | null> {
    const existing = this.store.get(key);
    const isExpired = existing?.expiresAt ? Date.now() > existing.expiresAt : false;

    if (opts?.nx && existing && !isExpired) {
      return null; // Mutex acquisition failed
    }

    let expiresAt: number | undefined;
    if (opts?.ex) expiresAt = Date.now() + opts.ex * 1000;
    else if (opts?.px) expiresAt = Date.now() + opts.px;

    const storedValue = typeof value === "object" ? JSON.stringify(value) : value;
    this.store.set(key, { value: storedValue, expiresAt });
    return "OK";
  }

  async del(...keys: string[]): Promise<number> {
    let deleted = 0;
    for (const key of keys) {
      if (this.store.delete(key)) deleted++;
    }
    return deleted;
  }

  async incr(key: string): Promise<number> {
    const current = await this.get<number>(key);
    const nextVal = (Number(current) || 0) + 1;
    await this.set(key, nextVal);
    return nextVal;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return 0;
    entry.expiresAt = Date.now() + seconds * 1000;
    return 1;
  }

  async ttl(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return -2;
    if (!entry.expiresAt) return -1;
    const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  async flushall(): Promise<"OK"> {
    this.store.clear();
    return "OK";
  }
}

declare global {
  // eslint-disable-next-line no-var
  var _redisClient: IRedisClient | undefined;
}

function createRedisClient(): IRedisClient {
  if (isServiceMocked("redis")) {
    if (!globalThis._redisClient) {
      globalThis._redisClient = new MockRedisClient();
    }
    return globalThis._redisClient;
  }

  const liveClient = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  return liveClient as unknown as IRedisClient;
}

export const redis = createRedisClient();

export function getIdempotencyKey(userId: string, key: string): string {
  return `idemp:${userId}:${key}`;
}

export async function acquireIdempotencyLock(
  userId: string,
  key: string,
  ttlSeconds = 30
): Promise<{ acquired: boolean; existing?: IdempotencyEntry }> {
  const cacheKey = getIdempotencyKey(userId, key);
  const existing = await redis.get<IdempotencyEntry>(cacheKey);

  if (existing) {
    return { acquired: false, existing };
  }

  const inProgressPayload: IdempotencyEntry = {
    status: 200,
    data: null,
    state: "IN_PROGRESS",
    createdAt: Date.now(),
  };

  const lockResult = await redis.set(cacheKey, inProgressPayload, { nx: true, ex: ttlSeconds });
  if (lockResult !== "OK") {
    const current = await redis.get<IdempotencyEntry>(cacheKey);
    return { acquired: false, existing: current ?? inProgressPayload };
  }
  return { acquired: true };
}

export async function saveIdempotencyResponse(
  userId: string,
  key: string,
  status: number,
  data: any,
  ttlSeconds = 86400
): Promise<void> {
  const cacheKey = getIdempotencyKey(userId, key);
  const completedPayload: IdempotencyEntry = {
    status,
    data,
    state: "COMPLETED",
    createdAt: Date.now(),
  };
  await redis.set(cacheKey, completedPayload, { ex: ttlSeconds });
}

export async function releaseIdempotencyLock(userId: string, key: string): Promise<void> {
  const cacheKey = getIdempotencyKey(userId, key);
  await redis.del(cacheKey);
}

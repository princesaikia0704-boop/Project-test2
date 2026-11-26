/**
 * Multi-Tier Sliding Window Rate Limiter (Upstash Redis + Bounded In-Memory Fallback).
 * Edge + Node compatible.
 */

import type { NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { isServiceMocked } from "@/lib/mock/utils";

export interface RateLimitPolicy {
  bucket: string;
  limit: number;
  windowMs: number;
  windowString: "60 s";
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  bucket: string;
}

export const RATE_LIMIT_POLICIES: Record<"AUTH" | "MUTATION" | "DEFAULT", RateLimitPolicy> = {
  AUTH: { bucket: "auth", limit: 10, windowMs: 60_000, windowString: "60 s" },
  MUTATION: { bucket: "mutation", limit: 30, windowMs: 60_000, windowString: "60 s" },
  DEFAULT: { bucket: "default", limit: 100, windowMs: 60_000, windowString: "60 s" },
};

const MAX_MEMORY_STORE_ENTRIES = 10_000;

declare global {
  // eslint-disable-next-line no-var
  var __edgeRateLimitStore: Map<string, number[]> | undefined;
  // eslint-disable-next-line no-var
  var __upstashLimiters: Map<string, Ratelimit> | undefined;
}

function getMemoryStore(): Map<string, number[]> {
  if (!globalThis.__edgeRateLimitStore) {
    globalThis.__edgeRateLimitStore = new Map<string, number[]>();
  }
  return globalThis.__edgeRateLimitStore;
}

function getUpstashLimiter(policy: RateLimitPolicy): Ratelimit | null {
  if (isServiceMocked("redis")) return null;
  if (!globalThis.__upstashLimiters) {
    globalThis.__upstashLimiters = new Map<string, Ratelimit>();
  }
  let limiter = globalThis.__upstashLimiters.get(policy.bucket);
  if (!limiter) {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(policy.limit, policy.windowString),
      prefix: `rl:${policy.bucket}`,
    });
    globalThis.__upstashLimiters.set(policy.bucket, limiter);
  }
  return limiter;
}

export function selectRateLimitPolicy(pathname: string, method: string): RateLimitPolicy {
  if (pathname.startsWith("/api/auth/")) {
    return RATE_LIMIT_POLICIES.AUTH;
  }
  if (
    (pathname === "/api/orders" && method === "POST") ||
    pathname.startsWith("/api/admin/upload") ||
    pathname === "/api/admin/seed"
  ) {
    return RATE_LIMIT_POLICIES.MUTATION;
  }
  return RATE_LIMIT_POLICIES.DEFAULT;
}

/**
 * Extracts client IP preferring trusted edge proxy headers over spoofable client headers.
 */
export function extractTrustedClientIp(req: NextRequest): string {
  const vercelIp = req.headers.get("x-vercel-forwarded-for");
  if (vercelIp) {
    const ip = vercelIp.split(",")[0].trim();
    if (ip) return ip;
  }
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp && cfIp.trim()) return cfIp.trim();

  const realIp = req.headers.get("x-real-ip");
  if (realIp && realIp.trim()) return realIp.trim();

  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0].trim();
    if (firstIp) return firstIp;
  }
  return "127.0.0.1";
}

function evaluateMemoryRateLimit(key: string, policy: RateLimitPolicy): RateLimitResult {
  const now = Date.now();
  const store = getMemoryStore();

  // Bounded eviction guard to prevent memory exhaustion under IP rotation attacks
  if (store.size > MAX_MEMORY_STORE_ENTRIES) {
    for (const [k, ts] of store.entries()) {
      const fresh = ts.filter((t) => now - t < policy.windowMs);
      if (fresh.length === 0) store.delete(k);
    }
    if (store.size > MAX_MEMORY_STORE_ENTRIES) {
      const oldestKey = store.keys().next().value;
      if (oldestKey) store.delete(oldestKey);
    }
  }

  const existing = store.get(key) || [];
  const timestamps = existing.filter((t) => now - t < policy.windowMs);
  timestamps.push(now);
  store.set(key, timestamps);

  return {
    success: timestamps.length <= policy.limit,
    limit: policy.limit,
    remaining: Math.max(0, policy.limit - timestamps.length),
    reset: Math.ceil((now + policy.windowMs) / 1000),
    bucket: policy.bucket,
  };
}

export async function evaluateRateLimitDistributed(
  ip: string,
  policy: RateLimitPolicy
): Promise<RateLimitResult> {
  const compositeKey = `${policy.bucket}:${ip}`;
  try {
    const limiter = getUpstashLimiter(policy);
    if (limiter) {
      const res = await limiter.limit(compositeKey);
      return {
        success: res.success,
        limit: res.limit,
        remaining: res.remaining,
        reset: Math.ceil(res.reset / 1000),
        bucket: policy.bucket,
      };
    }
    return evaluateMemoryRateLimit(compositeKey, policy);
  } catch {
    return evaluateMemoryRateLimit(compositeKey, policy);
  }
}

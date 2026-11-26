/**
 * Corporate Office Store - Database Singleton & Pooling Layer
 * Dual driver setup:
 * 1. db: Neon HTTP client with fetchConnectionCache = true for fast stateless queries.
 * 2. txDb: Neon WebSocket Pooler for multi-statement ACID transactions.
 * Fast Refresh safety enabled via globalThis singleton caching.
 * Transparent fallback to in-memory MockDataStore when live database is unconfigured.
 */

import { neon, neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle as drizzleHttp, NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle as drizzleServerless, NeonDatabase } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";
import { isDatabaseMocked } from "@/lib/mock/utils";
import { getMockDrizzleClient, mockDataStore } from "@/lib/mock/mock-store";

// Enable global HTTP connection pooling across warm Vercel/Node serverless functions
neonConfig.fetchConnectionCache = true;

// Ensure WebSocket constructor is available in Node.js server environments
if (typeof WebSocket !== "undefined") {
  neonConfig.webSocketConstructor = WebSocket;
}

// Global type declarations for Next.js Fast Refresh singleton preservation
declare global {
  // eslint-disable-next-line no-var
  var _neonPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var _drizzleHttpDb: NeonHttpDatabase<typeof schema> | any | undefined;
  // eslint-disable-next-line no-var
  var _drizzleTxDb: NeonDatabase<typeof schema> | any | undefined;
}

function enforceTlsDatabaseUrl(rawUrl: string): { url: string; isLocalhost: boolean } {
  const parsed = new URL(rawUrl);
  const host = parsed.hostname.toLowerCase();
  const isLocalhost = host === "localhost" || host === "127.0.0.1" || host === "::1";

  if (!isLocalhost) {
    const sslMode = parsed.searchParams.get("sslmode")?.toLowerCase();
    if (sslMode === "disable" || sslMode === "allow" || sslMode === "prefer") {
      throw new Error("Insecure PostgreSQL sslmode is prohibited for remote connections");
    }
    if (!sslMode) {
      parsed.searchParams.set("sslmode", "require");
    }
  }
  return { url: parsed.toString(), isLocalhost };
}

function initializeDatabase() {
  // 1. Zero-Crash Mock Fallback
  if (isDatabaseMocked()) {
    if (!globalThis._drizzleHttpDb || !globalThis._drizzleTxDb) {
      const mockClient = getMockDrizzleClient();
      globalThis._drizzleHttpDb = mockClient;
      globalThis._drizzleTxDb = mockClient;
    }
    return {
      db: globalThis._drizzleHttpDb as NeonHttpDatabase<typeof schema>,
      txDb: globalThis._drizzleTxDb as NeonDatabase<typeof schema>,
      pool: null,
    };
  }

  // 2. Production / Live Neon PostgreSQL Setup with SSL/TLS Enforcement
  const rawConnectionString =
    process.env.DATABASE_URL_POOLED ||
    process.env.DATABASE_URL ||
    "";

  if (!rawConnectionString) {
    // Allow Next.js build-time module evaluation when DB URL is injected at runtime,
    // while throwing clear errors if queried without a valid connection string.
    const unconfiguredProxy = new Proxy(
      {},
      {
        get() {
          throw new Error("DATABASE_URL is not configured for live PostgreSQL mode");
        },
      }
    );
    return {
      db: unconfiguredProxy as NeonHttpDatabase<typeof schema>,
      txDb: unconfiguredProxy as NeonDatabase<typeof schema>,
      pool: null,
    };
  }

  const { url: connectionString, isLocalhost } = enforceTlsDatabaseUrl(rawConnectionString);

  // HTTP Driver: Ultra-fast read queries & edge operations
  if (!globalThis._drizzleHttpDb) {
    const sql = neon(connectionString);
    globalThis._drizzleHttpDb = drizzleHttp(sql, { schema });
  }

  // WebSocket Pooler Driver: Multi-statement interactive ACID transactions
  if (!globalThis._drizzleTxDb) {
    const pool =
      globalThis._neonPool ??
      new Pool({
        connectionString,
        max: process.env.NODE_ENV === "production" ? 10 : 5,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
        ...(isLocalhost ? {} : { ssl: { rejectUnauthorized: true } }),
      });
    globalThis._neonPool = pool;
    globalThis._drizzleTxDb = drizzleServerless(pool, { schema });
  }

  return {
    db: globalThis._drizzleHttpDb as NeonHttpDatabase<typeof schema>,
    txDb: globalThis._drizzleTxDb as NeonDatabase<typeof schema>,
    pool: globalThis._neonPool,
  };
}

const instances = initializeDatabase();

export const db = instances.db;
export const txDb = instances.txDb;
export const pool = instances.pool;
export { schema, mockDataStore };

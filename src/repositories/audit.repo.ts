/**
 * Corporate Office Store - Audit Trail Repository
 * Enforces chronological append-only audit logging for system actions and mutations.
 */

import { desc, eq, and, gte, lte, sql } from "drizzle-orm";
import { db, schema, mockDataStore } from "@/lib/db";
import { AuditLog, NewAuditLog } from "@/lib/db/schema";
import { isDatabaseMocked } from "@/lib/mock/utils";
import { normalizeUserUuid } from "@/lib/utils";

export interface ListAuditLogsFilter {
  entityType?: string;
  entityId?: string;
  adminUserId?: string;
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface IAuditRepository {
  record(entry: Omit<NewAuditLog, "id" | "createdAt">, tx?: any): Promise<AuditLog>;
  listLogs(filter?: ListAuditLogsFilter): Promise<AuditLog[]>;
  listLogsWithCount(filter?: ListAuditLogsFilter): Promise<{ logs: AuditLog[]; total: number }>;
}

export class AuditRepository implements IAuditRepository {
  async record(entry: Omit<NewAuditLog, "id" | "createdAt">, tx?: any): Promise<AuditLog> {
    if (isDatabaseMocked()) {
      return mockDataStore.addAuditLog(entry as any) as unknown as AuditLog;
    }

    const client = tx || db;
    let safeAdminUserId: string | null = null;
    if (entry.adminUserId && entry.adminUserId !== "system") {
      try {
        safeAdminUserId = normalizeUserUuid(entry.adminUserId);
      } catch {
        safeAdminUserId = null;
      }
    }
    const normalizedEntry = {
      ...entry,
      adminUserId: safeAdminUserId,
    };
    const [created] = await client.insert(schema.auditLogs).values(normalizedEntry).returning();
    return created;
  }

  async listLogs(filter?: ListAuditLogsFilter): Promise<AuditLog[]> {
    const res = await this.listLogsWithCount(filter);
    return res.logs;
  }

  async listLogsWithCount(filter?: ListAuditLogsFilter): Promise<{ logs: AuditLog[]; total: number }> {
    if (isDatabaseMocked()) {
      const logs = mockDataStore.getAuditLogs(filter) as unknown as AuditLog[];
      const total = mockDataStore.countAuditLogs(filter);
      return { logs, total };
    }

    const conditions: any[] = [];
    if (filter?.entityType) {
      conditions.push(eq(schema.auditLogs.entityType, filter.entityType as any));
    }
    if (filter?.action) {
      conditions.push(eq(schema.auditLogs.action, filter.action as any));
    }
    if (filter?.entityId) {
      conditions.push(eq(schema.auditLogs.entityId, filter.entityId));
    }
    if (filter?.adminUserId) {
      conditions.push(eq(schema.auditLogs.adminUserId, normalizeUserUuid(filter.adminUserId)));
    }
    if (filter?.from) {
      const fromDate = new Date(filter.from);
      if (!Number.isNaN(fromDate.getTime())) {
        conditions.push(gte(schema.auditLogs.createdAt, fromDate));
      }
    }
    if (filter?.to) {
      const toDate = new Date(filter.to);
      if (!Number.isNaN(toDate.getTime())) {
        toDate.setHours(23, 59, 59, 999);
        conditions.push(lte(schema.auditLogs.createdAt, toDate));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.auditLogs);
    if (whereClause) countQuery.where(whereClause);
    const countRes = await countQuery;
    const total = Number(countRes[0]?.count ?? 0);

    const query = db
      .select()
      .from(schema.auditLogs)
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(filter?.limit ?? 50)
      .offset(filter?.offset ?? 0);

    if (whereClause) {
      query.where(whereClause);
    }

    const logs = await query;
    return { logs, total };
  }
}

export const auditRepo = new AuditRepository();

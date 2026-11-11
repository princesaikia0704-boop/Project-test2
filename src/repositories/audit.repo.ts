/**
 * Corporate Office Store - Audit Trail Repository
 * Enforces chronological append-only audit logging for system actions and mutations.
 */

import { desc, eq, and } from "drizzle-orm";
import { db, schema, mockDataStore } from "@/lib/db";
import { AuditLog, NewAuditLog } from "@/lib/db/schema";
import { isDatabaseMocked } from "@/lib/mock/utils";

export interface ListAuditLogsFilter {
  entityType?: string;
  entityId?: string;
  adminUserId?: string;
  limit?: number;
  offset?: number;
}

export interface IAuditRepository {
  record(entry: Omit<NewAuditLog, "id" | "createdAt">, tx?: any): Promise<AuditLog>;
  listLogs(filter?: ListAuditLogsFilter): Promise<AuditLog[]>;
}

export class AuditRepository implements IAuditRepository {
  async record(entry: Omit<NewAuditLog, "id" | "createdAt">, tx?: any): Promise<AuditLog> {
    if (isDatabaseMocked()) {
      return mockDataStore.addAuditLog(entry as any) as unknown as AuditLog;
    }

    const client = tx || db;
    const [created] = await client.insert(schema.auditLogs).values(entry).returning();
    return created;
  }

  async listLogs(filter?: ListAuditLogsFilter): Promise<AuditLog[]> {
    if (isDatabaseMocked()) {
      return mockDataStore.getAuditLogs(filter) as unknown as AuditLog[];
    }

    const conditions: any[] = [];
    if (filter?.entityType) {
      conditions.push(eq(schema.auditLogs.entityType, filter.entityType as any));
    }
    if (filter?.entityId) {
      conditions.push(eq(schema.auditLogs.entityId, filter.entityId));
    }
    if (filter?.adminUserId) {
      conditions.push(eq(schema.auditLogs.adminUserId, filter.adminUserId));
    }

    const query = db
      .select()
      .from(schema.auditLogs)
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(filter?.limit ?? 50)
      .offset(filter?.offset ?? 0);

    if (conditions.length > 0) {
      query.where(and(...conditions));
    }

    return await query;
  }
}

export const auditRepo = new AuditRepository();

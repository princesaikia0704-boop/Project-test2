"use client";

import React, { useState, useEffect, useCallback } from "react";
import { formatDate } from "@/lib/utils";
import {
  ScrollText,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Filter,
  Calendar,
  User,
  ArrowRight,
  Search,
  FileText,
} from "lucide-react";

interface AuditLog {
  id: string;
  adminUserId: string;
  adminUserName?: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  createdAt: string;
}

const ACTION_TYPES = [
  "ALL",
  "CREATE",
  "UPDATE",
  "DELETE",
  "APPROVE",
  "REJECT",
  "STOCK_ADJUST",
  "CONFIG_UPDATE",
];

const ENTITY_TYPES = [
  "ALL",
  "PRODUCT",
  "CATEGORY",
  "ORDER",
  "DEPARTMENT_BUDGET",
  "STORE_SETTINGS",
  "USER",
];

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  UPDATE: "bg-blue-50 text-blue-700 border-blue-200",
  DELETE: "bg-rose-50 text-rose-700 border-rose-200",
  APPROVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJECT: "bg-amber-50 text-amber-700 border-amber-200",
  STOCK_ADJUST: "bg-purple-50 text-purple-700 border-purple-200",
  CONFIG_UPDATE: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

const PAGE_SIZE = 20;

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [actionFilter, setActionFilter] = useState("ALL");
  const [entityFilter, setEntityFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchLogs = useCallback(
    async (page = 1) => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(PAGE_SIZE));
        if (actionFilter !== "ALL") params.set("action", actionFilter);
        if (entityFilter !== "ALL") params.set("entityType", entityFilter);
        if (dateFrom) params.set("from", dateFrom);
        if (dateTo) params.set("to", dateTo);

        const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs || []);
          setTotalCount(data.total ?? data.count ?? (data.logs?.length || 0));
          setCurrentPage(page);
          setErrorMessage(null);
        } else if (res.status === 403) {
          setErrorMessage(
            "Access Restricted: Audit logs require Manager or Admin permissions. Switch to Carol Manager (MGR) or David Vance (ADM) in the persona switcher."
          );
          setLogs([]);
          setTotalCount(0);
        } else {
          setErrorMessage("Failed to load audit logs. Please try again.");
        }
      } catch (err) {
        console.error("Failed to fetch audit logs", err);
        setErrorMessage("Network error occurred while fetching audit logs.");
      } finally {
        setIsLoading(false);
      }
    },
    [actionFilter, entityFilter, dateFrom, dateTo]
  );

  // Fetch on filter change
  useEffect(() => {
    fetchLogs(1);
  }, [fetchLogs]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const toggleExpand = (logId: string) => {
    setExpandedLogId((prev) => (prev === logId ? null : logId));
  };

  const renderJsonDiff = (
    oldValRaw: any,
    newValRaw: any
  ) => {
    let oldVal = oldValRaw;
    let newVal = newValRaw;
    if (typeof oldVal === "string") {
      try {
        oldVal = JSON.parse(oldVal);
      } catch {}
    }
    if (typeof newVal === "string") {
      try {
        newVal = JSON.parse(newVal);
      } catch {}
    }

    if (!oldVal && !newVal) {
      return <p className="text-xs text-slate-400 italic">No change data recorded.</p>;
    }

    const isOldObj = typeof oldVal === "object" && oldVal !== null;
    const isNewObj = typeof newVal === "object" && newVal !== null;

    if (!isOldObj && !isNewObj) {
      return (
        <div className="text-xs">
          <span className="text-rose-600 line-through mr-2">{String(oldVal ?? "—")}</span>
          <ArrowRight className="inline w-3 h-3 text-slate-400 mr-2" />
          <span className="text-emerald-700 font-semibold">{String(newVal ?? "—")}</span>
        </div>
      );
    }

    const allKeys = new Set([
      ...(isOldObj ? Object.keys(oldVal) : []),
      ...(isNewObj ? Object.keys(newVal) : []),
    ]);

    return (
      <div className="space-y-1.5">
        {Array.from(allKeys).map((key) => {
          const oldV = isOldObj ? oldVal[key] : undefined;
          const newV = isNewObj ? newVal[key] : undefined;
          const changed = JSON.stringify(oldV) !== JSON.stringify(newV);

          return (
            <div
              key={key}
              className={`flex items-start gap-2 text-xs px-2 py-1 rounded ${
                changed ? "bg-amber-50/50" : ""
              }`}
            >
              <span className="font-mono font-semibold text-slate-500 min-w-[120px] shrink-0">
                {key}:
              </span>
              {changed ? (
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="text-rose-600 line-through break-all">
                    {oldV !== undefined ? (typeof oldV === "object" ? JSON.stringify(oldV) : String(oldV)) : "—"}
                  </span>
                  <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="text-emerald-700 font-semibold break-all">
                    {newV !== undefined ? (typeof newV === "object" ? JSON.stringify(newV) : String(newV)) : "—"}
                  </span>
                </div>
              ) : (
                <span className="text-slate-500 break-all">
                  {JSON.stringify(newV ?? oldV)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Audit Logs</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable record of all administrative actions and system changes.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">{totalCount.toLocaleString()} total entries</span>
          <button
            type="button"
            data-testid="audit-refresh-btn"
            onClick={() => fetchLogs(currentPage)}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-700">Filters</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Action Type Filter */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Action Type
            </label>
            <select
              data-testid="filter-action"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full py-2 px-3 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              {ACTION_TYPES.map((action) => (
                <option key={action} value={action}>
                  {action === "ALL" ? "All Actions" : action.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>

          {/* Entity Type Filter */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Entity Type
            </label>
            <select
              data-testid="filter-entity"
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="w-full py-2 px-3 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              {ENTITY_TYPES.map((entity) => (
                <option key={entity} value={entity}>
                  {entity === "ALL" ? "All Entities" : entity.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              From Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="date"
                data-testid="filter-date-from"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full py-2 pl-9 pr-3 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          {/* Date To */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              To Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="date"
                data-testid="filter-date-to"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full py-2 pl-9 pr-3 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Clear Filters */}
        {(actionFilter !== "ALL" || entityFilter !== "ALL" || dateFrom || dateTo) && (
          <button
            type="button"
            onClick={() => {
              setActionFilter("ALL");
              setEntityFilter("ALL");
              setDateFrom("");
              setDateTo("");
            }}
            className="mt-3 text-xs text-slate-500 hover:text-slate-700 underline transition"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Access Restriction or Error Alert */}
      {errorMessage && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-xl flex items-center justify-between gap-3 text-xs">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-amber-700 hover:text-amber-900 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Audit Log Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-slate-200 animate-pulse" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
          <FileText className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <h3 className="text-base font-bold text-slate-700 mb-1">No audit logs found</h3>
          <p className="text-xs text-slate-400">
            {actionFilter !== "ALL" || entityFilter !== "ALL" || dateFrom || dateTo
              ? "Try adjusting your filters to see more results."
              : "Administrative actions will appear here as they occur."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr] gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/50">
            <div className="w-6" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Timestamp
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Admin User
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Action
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Entity Type
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Entity ID
            </span>
          </div>

          {/* Log Rows */}
          {logs.map((log, index) => {
            const isExpanded = expandedLogId === log.id;
            const actionColor =
              ACTION_COLORS[log.action] || "bg-slate-50 text-slate-700 border-slate-200";

            return (
              <div key={`${log.id}-${index}`} data-testid={`audit-row-${log.id}`}>
                <div
                  className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr] gap-2 px-4 py-3 items-center border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer"
                  onClick={() => toggleExpand(log.id)}
                >
                  <button type="button" className="text-slate-400 shrink-0">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>

                  <span className="text-[11px] text-slate-500 font-mono">
                    {formatDate(log.createdAt)}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-xs font-semibold text-slate-700 truncate">
                      {log.adminUserName || log.adminUserId}
                    </span>
                  </div>

                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border w-fit ${actionColor}`}
                  >
                    {log.action.replace("_", " ")}
                  </span>

                  <span className="text-xs text-slate-600">
                    {log.entityType.replace("_", " ")}
                  </span>

                  <span className="text-xs text-slate-500 font-mono truncate">
                    {log.entityId.slice(0, 12)}…
                  </span>
                </div>

                {/* Expanded Diff View */}
                {isExpanded && (
                  <div className="border-b border-slate-100 bg-slate-50/30 px-6 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Changes (Old → New)
                        </h4>
                        {renderJsonDiff(log.oldValue, log.newValue)}
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Details
                        </h4>
                        <div className="text-xs space-y-1">
                          <p>
                            <span className="text-slate-400">Log ID:</span>{" "}
                            <span className="font-mono text-slate-600">{log.id}</span>
                          </p>
                          <p>
                            <span className="text-slate-400">Full Entity ID:</span>{" "}
                            <span className="font-mono text-slate-600">{log.entityId}</span>
                          </p>
                          <p>
                            <span className="text-slate-400">Timestamp:</span>{" "}
                            <span className="text-slate-600">
                              {new Date(log.createdAt).toISOString()}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="pagination-prev"
              onClick={() => fetchLogs(currentPage - 1)}
              disabled={currentPage <= 1 || isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Previous
            </button>
            <button
              type="button"
              data-testid="pagination-next"
              onClick={() => fetchLogs(currentPage + 1)}
              disabled={currentPage >= totalPages || isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

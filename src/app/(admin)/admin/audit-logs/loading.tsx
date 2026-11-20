import React from "react";

/** Loading skeleton for the audit logs page. */
export default function AuditLogsLoading() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="h-7 w-32 bg-slate-200 dark:bg-slate-700 rounded-lg" />

      {/* Filter bar */}
      <div className="flex gap-3">
        <div className="h-9 flex-1 bg-slate-100 dark:bg-slate-800 rounded-lg" />
        <div className="h-9 w-36 bg-slate-100 dark:bg-slate-800 rounded-lg" />
        <div className="h-9 w-24 bg-slate-100 dark:bg-slate-800 rounded-lg" />
      </div>

      {/* Log table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="px-4 py-3 border-b border-slate-50 dark:border-slate-800/60 flex items-center gap-4">
            <div className="h-3 w-24 bg-slate-100 dark:bg-slate-800 rounded" />
            <div className="h-5 w-16 bg-slate-200 dark:bg-slate-700 rounded-full" />
            <div className="h-3 flex-1 bg-slate-100 dark:bg-slate-800 rounded" />
            <div className="h-3 w-28 bg-slate-100 dark:bg-slate-800 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

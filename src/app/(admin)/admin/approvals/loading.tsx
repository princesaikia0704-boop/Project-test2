import React from "react";

/** Loading skeleton for the approvals page. */
export default function ApprovalsLoading() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="h-7 w-44 bg-slate-200 dark:bg-slate-700 rounded-lg" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 flex items-center gap-4">
            <div className="h-10 w-10 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-32 bg-slate-100 dark:bg-slate-800 rounded" />
            </div>
            <div className="h-6 w-20 bg-slate-200 dark:bg-slate-700 rounded-full" />
            <div className="flex gap-2">
              <div className="h-8 w-20 bg-slate-100 dark:bg-slate-800 rounded-lg" />
              <div className="h-8 w-20 bg-slate-100 dark:bg-slate-800 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

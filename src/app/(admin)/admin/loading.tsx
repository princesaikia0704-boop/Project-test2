import React from "react";

/** Loading skeleton for the admin dashboard and admin route segments. */
export default function AdminLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Page header skeleton */}
      <div className="space-y-2">
        <div className="h-7 w-48 bg-slate-200 dark:bg-slate-700 rounded-lg" />
        <div className="h-4 w-72 bg-slate-100 dark:bg-slate-800 rounded" />
      </div>

      {/* KPI cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
            <div className="h-4 w-20 bg-slate-100 dark:bg-slate-800 rounded" />
            <div className="h-8 w-28 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="h-5 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="px-4 py-3 border-b border-slate-50 dark:border-slate-800/60 flex items-center gap-4">
            <div className="h-4 w-4 bg-slate-100 dark:bg-slate-800 rounded" />
            <div className="h-4 flex-1 bg-slate-100 dark:bg-slate-800 rounded" />
            <div className="h-4 w-20 bg-slate-100 dark:bg-slate-800 rounded" />
            <div className="h-6 w-16 bg-slate-200 dark:bg-slate-700 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

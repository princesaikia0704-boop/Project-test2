import React from "react";

/** Loading skeleton for the My Orders page. */
export default function OrdersLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-5 animate-pulse">
      <div className="h-7 w-36 bg-slate-200 dark:bg-slate-700 rounded-lg" />

      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-5 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-6 w-20 bg-slate-100 dark:bg-slate-800 rounded-full" />
          </div>
          <div className="h-3 w-48 bg-slate-100 dark:bg-slate-800 rounded" />
          <div className="flex gap-2 pt-1">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="h-10 w-10 bg-slate-100 dark:bg-slate-800 rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

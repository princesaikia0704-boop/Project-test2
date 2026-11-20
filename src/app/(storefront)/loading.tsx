import React from "react";

/** Loading skeleton for the storefront catalog page. */
export default function StorefrontLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-pulse">
      {/* Search + filter bar */}
      <div className="flex gap-3">
        <div className="h-10 flex-1 bg-slate-200 dark:bg-slate-700 rounded-xl" />
        <div className="h-10 w-32 bg-slate-200 dark:bg-slate-700 rounded-xl" />
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="aspect-square bg-slate-100 dark:bg-slate-800 rounded-t-xl" />
            <div className="p-4 space-y-2">
              <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-3/4 bg-slate-100 dark:bg-slate-800 rounded" />
              <div className="h-5 w-20 bg-slate-200 dark:bg-slate-700 rounded mt-1" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

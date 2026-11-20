import React from "react";

/** Loading skeleton for the catalog management page. */
export default function CatalogLoading() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-36 bg-slate-200 dark:bg-slate-700 rounded-lg" />
        <div className="h-9 w-32 bg-slate-200 dark:bg-slate-700 rounded-lg" />
      </div>

      {/* Filter bar */}
      <div className="flex gap-3">
        <div className="h-9 flex-1 bg-slate-100 dark:bg-slate-800 rounded-lg" />
        <div className="h-9 w-32 bg-slate-100 dark:bg-slate-800 rounded-lg" />
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="aspect-square bg-slate-100 dark:bg-slate-800" />
            <div className="p-3 space-y-2">
              <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-20 bg-slate-100 dark:bg-slate-800 rounded" />
              <div className="h-5 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

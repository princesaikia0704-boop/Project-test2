import React from "react";
import { cn } from "@/lib/utils";

interface LoadingSkeletonProps {
  /** Number of rows to render */
  rows?: number;
  /** Visual variant */
  variant?: "table" | "card" | "text";
  className?: string;
}

/**
 * Reusable animated loading skeleton.
 * - `table` — renders a list of table row skeletons
 * - `card` — renders a grid of card skeletons
 * - `text` — renders stacked text-line skeletons
 */
export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  rows = 5,
  variant = "table",
  className,
}) => {
  if (variant === "card") {
    return (
      <div
        className={cn(
          "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-pulse",
          className
        )}
      >
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden"
          >
            <div className="aspect-square bg-slate-100 dark:bg-slate-800" />
            <div className="p-3 space-y-2">
              <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-20 bg-slate-100 dark:bg-slate-800 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === "text") {
    return (
      <div className={cn("space-y-2 animate-pulse", className)}>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="h-4 bg-slate-100 dark:bg-slate-800 rounded"
            style={{ width: `${100 - (i % 3) * 15}%` }}
          />
        ))}
      </div>
    );
  }

  // default: table
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden animate-pulse",
        className
      )}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="px-4 py-3 border-b border-slate-50 dark:border-slate-800/60 flex items-center gap-4"
        >
          <div className="h-4 w-4 bg-slate-100 dark:bg-slate-800 rounded" />
          <div className="h-4 flex-1 bg-slate-100 dark:bg-slate-800 rounded" />
          <div className="h-4 w-24 bg-slate-100 dark:bg-slate-800 rounded" />
          <div className="h-6 w-16 bg-slate-200 dark:bg-slate-700 rounded-full" />
        </div>
      ))}
    </div>
  );
};

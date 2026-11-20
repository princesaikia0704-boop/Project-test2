import React from "react";
import { cn } from "@/lib/utils";
import { PackageSearch, type LucideIcon } from "lucide-react";

interface EmptyStateProps {
  /** The icon to display — defaults to PackageSearch */
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Optional action button */
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

/**
 * Generic empty-state placeholder rendered when a list or table has no items.
 * Accepts a custom icon, title, description, and optional CTA button.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = PackageSearch,
  title,
  description,
  action,
  className,
}) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-16 px-6 space-y-4",
        className
      )}
    >
      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center">
        <Icon className="w-8 h-8 text-slate-400 dark:text-slate-500" />
      </div>

      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</p>
        {description && (
          <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs">{description}</p>
        )}
      </div>

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-2 px-4 py-2 bg-slate-900 dark:bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 dark:hover:bg-indigo-500 transition-colors shadow-sm"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

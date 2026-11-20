import React from "react";
import { cn } from "@/lib/utils";
import { Clock, CheckCircle2, XCircle, Truck, Ban, HelpCircle } from "lucide-react";

export type OrderStatus =
  | "PENDING"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "FULFILLED";

interface StatusBadgeProps {
  status: OrderStatus | string;
  className?: string;
  showIcon?: boolean;
}

interface StatusDetails {
  label: string;
  classes: string;
  icon: React.ComponentType<{ className?: string }>;
  testId: string;
}

const STATUS_CONFIG: Record<string, StatusDetails> = {
  PENDING: {
    label: "Pending",
    classes:
      "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800",
    icon: Clock,
    testId: "status-chip-pending",
  },
  PENDING_APPROVAL: {
    label: "Pending Approval",
    classes:
      "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800",
    icon: Clock,
    testId: "status-chip-pending",
  },
  APPROVED: {
    label: "Approved",
    classes:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800",
    icon: CheckCircle2,
    testId: "status-chip-approved",
  },
  REJECTED: {
    label: "Rejected",
    classes:
      "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800",
    icon: XCircle,
    testId: "status-chip-rejected",
  },
  CANCELLED: {
    label: "Cancelled",
    classes:
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700",
    icon: Ban,
    testId: "status-chip-cancelled",
  },
  FULFILLED: {
    label: "Fulfilled",
    classes:
      "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800",
    icon: Truck,
    testId: "status-chip-fulfilled",
  },
};

/**
 * Renders a standardized, accessible pill badge for order and entity statuses.
 * Includes status icon, theme-adaptive color styling, and automated test-id attributes.
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  className,
  showIcon = true,
}) => {
  const normalizedKey = status?.toUpperCase() ?? "";
  const config = STATUS_CONFIG[normalizedKey] ?? {
    label: status ?? "Unknown",
    classes:
      "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700",
    icon: HelpCircle,
    testId: `status-chip-${normalizedKey.toLowerCase() || "unknown"}`,
  };

  const Icon = config.icon;

  return (
    <span
      data-testid={config.testId}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold",
        config.classes,
        className
      )}
    >
      {showIcon && <Icon className="w-3.5 h-3.5" />}
      {config.label}
    </span>
  );
};

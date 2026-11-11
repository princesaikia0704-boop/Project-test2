"use client";

import React from "react";
import { formatCurrency, calculateBudgetZone, BudgetZone } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, AlertOctagon, TrendingUp } from "lucide-react";

export interface BudgetMeterProps {
  totalCents: number;
  remainingCents: number;
  cartTotalCents: number;
  className?: string;
  showDetails?: boolean;
}

export const BudgetMeter: React.FC<BudgetMeterProps> = ({
  totalCents,
  remainingCents,
  cartTotalCents,
  className = "",
  showDetails = true,
}) => {
  const { zone, ratio, projectedRemainingCents } = calculateBudgetZone(
    totalCents,
    remainingCents,
    cartTotalCents
  );

  const percentageSpent = Math.min(100, Math.max(0, Math.round(ratio * 100)));
  const baseSpentCents = Math.max(0, totalCents - remainingCents);
  const basePercent =
    totalCents > 0
      ? Math.min(100, Math.round((baseSpentCents / totalCents) * 100))
      : 0;
  const cartPercent =
    totalCents > 0
      ? Math.min(
          100 - basePercent,
          Math.round((cartTotalCents / totalCents) * 100)
        )
      : 100;

  const zoneConfigs: Record<
    BudgetZone,
    {
      badge: string;
      label: string;
      barColor: string;
      cartBarColor: string;
      textColor: string;
      bgColor: string;
      borderColor: string;
      icon: React.ReactNode;
    }
  > = {
    GREEN: {
      badge: "Healthy (<70%)",
      label: "Within Budget",
      barColor: "bg-emerald-500",
      cartBarColor: "bg-emerald-300",
      textColor: "text-emerald-700",
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-200",
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
    },
    AMBER: {
      badge: "Caution (70-90%)",
      label: "Approaching Limit",
      barColor: "bg-amber-500",
      cartBarColor: "bg-amber-300",
      textColor: "text-amber-800",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
      icon: <AlertTriangle className="w-4 h-4 text-amber-600" />,
    },
    RED: {
      badge: "Critical (>90%)",
      label: projectedRemainingCents < 0 ? "Budget Overdraft" : "Budget Warning",
      barColor: "bg-red-500",
      cartBarColor: "bg-red-300",
      textColor: "text-red-700",
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
      icon: <AlertOctagon className="w-4 h-4 text-red-600" />,
    },
  };

  const currentZone = zoneConfigs[zone];

  return (
    <div
      data-testid="budget-meter"
      data-zone={zone}
      className={`rounded-xl border p-4 transition-all duration-200 ${currentZone.bgColor} ${currentZone.borderColor} ${className}`}
    >
      {/* Header with Zone Badge */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 font-medium text-sm text-slate-800">
          <TrendingUp className="w-4 h-4 text-slate-600" />
          <span>Department Budget Meter</span>
        </div>
        <div
          data-testid="budget-zone-badge"
          className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${currentZone.bgColor} ${currentZone.borderColor} ${currentZone.textColor}`}
        >
          {currentZone.icon}
          <span>{currentZone.label}</span>
        </div>
      </div>

      {/* Progress Bar with Base + Cart Segments */}
      <div className="space-y-1.5 mb-3">
        <div
          role="progressbar"
          aria-valuenow={percentageSpent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Department Budget Utilization"
          className="relative w-full h-3 bg-slate-200 rounded-full overflow-hidden flex"
        >
          {/* Baseline committed spend */}
          <div
            style={{ width: `${basePercent}%` }}
            className={`h-full ${currentZone.barColor} transition-all duration-300`}
            title={`Committed: ${formatCurrency(baseSpentCents)}`}
          />
          {/* In-cart pending spend */}
          {cartTotalCents > 0 && (
            <div
              style={{ width: `${cartPercent}%` }}
              className={`h-full ${currentZone.cartBarColor} animate-pulse transition-all duration-300`}
              title={`Cart Addition: ${formatCurrency(cartTotalCents)}`}
            />
          )}
        </div>

        {/* Utilization percentage label */}
        <div className="flex justify-between text-xs text-slate-500 font-medium">
          <span>{percentageSpent}% utilized</span>
          <span>{100 - percentageSpent}% available</span>
        </div>
      </div>

      {/* Financial Details Grid */}
      {showDetails && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200/60 text-xs">
          <div>
            <span className="text-slate-500 block">Total Budget</span>
            <span className="font-semibold text-slate-800">{formatCurrency(totalCents)}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Current Remaining</span>
            <span className="font-semibold text-slate-800">{formatCurrency(remainingCents)}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Cart Total</span>
            <span className="font-semibold text-indigo-600">+{formatCurrency(cartTotalCents)}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Projected Balance</span>
            <span
              className={`font-bold ${
                projectedRemainingCents < 0 ? "text-red-600 underline" : currentZone.textColor
              }`}
            >
              {formatCurrency(projectedRemainingCents)}
            </span>
          </div>
        </div>
      )}

      {/* Overdraft Alert Banner */}
      {projectedRemainingCents < 0 && (
        <div className="mt-2.5 p-2 bg-red-100/80 border border-red-300 rounded text-xs text-red-800 font-medium flex items-center gap-1.5">
          <AlertOctagon className="w-4 h-4 shrink-0 text-red-600" />
          <span>
            Cart total exceeds remaining funds by {formatCurrency(Math.abs(projectedRemainingCents))}. Order will fail checkout.
          </span>
        </div>
      )}
    </div>
  );
};

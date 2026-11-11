"use client";

import React, { useState, useEffect, useCallback } from "react";
import { formatCurrency } from "@/lib/utils";
import { DynamicRuleBuilder } from "@/components/admin/DynamicRuleBuilder";
import {
  Settings,
  Save,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Building2,
  DollarSign,
  Calendar,
} from "lucide-react";

interface StoreConfig {
  auto_approve_limit_cents: number;
  company_name: string;
  primary_color: string;
  logo_url: string;
}

interface DepartmentBudget {
  id: string;
  departmentId: string;
  departmentName: string;
  totalCents: number;
  remainingCents: number;
  periodStart: string;
  periodEnd: string;
}

export default function SettingsPage() {
  const [config, setConfig] = useState<StoreConfig | null>(null);
  const [budgets, setBudgets] = useState<DepartmentBudget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");

  const fetchConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/store-config");
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config || null);
        setBudgets(data.budgets || []);
      }
    } catch (err) {
      console.error("Failed to fetch store config", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSaveConfig = async (updates: Partial<StoreConfig>) => {
    setIsSaving(true);
    setSaveStatus("idle");

    try {
      const res = await fetch("/api/admin/store-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        const data = await res.json();
        setConfig(data.config || config);
        setSaveStatus("success");
        setTimeout(() => setSaveStatus("idle"), 3000);
      } else {
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 3000);
      }
    } catch (err) {
      console.error("Failed to save config", err);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Store Settings</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure approval thresholds, branding, and department budgets.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Save Status Toast */}
          {saveStatus === "success" && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Settings saved!
            </span>
          )}
          {saveStatus === "error" && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200">
              <AlertTriangle className="w-3.5 h-3.5" />
              Save failed. Try again.
            </span>
          )}

          <button
            type="button"
            data-testid="settings-refresh-btn"
            onClick={fetchConfig}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-64 rounded-xl bg-slate-200 animate-pulse" />
          <div className="h-48 rounded-xl bg-slate-200 animate-pulse" />
        </div>
      ) : (
        <>
          {/* Store Configuration Section */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="p-4 border-b border-slate-100 flex items-center gap-2">
              <Settings className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-bold text-slate-900">Store Configuration</h2>
            </div>
            <div className="p-6">
              {config ? (
                <DynamicRuleBuilder
                  currentConfig={config}
                  onSave={handleSaveConfig}
                />
              ) : (
                <p className="text-xs text-slate-400">No configuration found. Default settings will be used.</p>
              )}

              {isSaving && (
                <div className="flex items-center gap-2 mt-4 text-xs text-slate-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving changes...
                </div>
              )}
            </div>
          </div>

          {/* Department Budgets Section */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="p-4 border-b border-slate-100 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-bold text-slate-900">Department Budgets</h2>
              <span className="text-[10px] text-slate-400 ml-auto">
                {budgets.length} {budgets.length === 1 ? "department" : "departments"}
              </span>
            </div>

            {budgets.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-xs">No department budgets configured.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="budgets-table">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Department
                      </th>
                      <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Total Budget
                      </th>
                      <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Remaining
                      </th>
                      <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Used
                      </th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Usage
                      </th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Period
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgets.map((budget) => {
                      const usedCents = budget.totalCents - budget.remainingCents;
                      const usagePercent =
                        budget.totalCents > 0
                          ? Math.round((usedCents / budget.totalCents) * 100)
                          : 0;
                      const isHighUsage = usagePercent >= 80;
                      const isCritical = usagePercent >= 95;

                      return (
                        <tr
                          key={budget.id}
                          data-testid={`budget-row-${budget.departmentId}`}
                          className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                              <span className="text-xs font-semibold text-slate-900">
                                {budget.departmentName || budget.departmentId}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-xs font-bold text-slate-700">
                              {formatCurrency(budget.totalCents)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={`text-xs font-bold ${
                                isCritical
                                  ? "text-rose-600"
                                  : isHighUsage
                                  ? "text-amber-600"
                                  : "text-emerald-600"
                              }`}
                            >
                              {formatCurrency(budget.remainingCents)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-xs text-slate-500">
                              {formatCurrency(usedCents)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden max-w-[100px]">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    isCritical
                                      ? "bg-rose-500"
                                      : isHighUsage
                                      ? "bg-amber-500"
                                      : "bg-emerald-500"
                                  }`}
                                  style={{ width: `${Math.min(usagePercent, 100)}%` }}
                                />
                              </div>
                              <span
                                className={`text-[10px] font-bold ${
                                  isCritical
                                    ? "text-rose-600"
                                    : isHighUsage
                                    ? "text-amber-600"
                                    : "text-slate-500"
                                }`}
                              >
                                {usagePercent}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span className="text-[10px] text-slate-400">
                                {budget.periodStart
                                  ? new Date(budget.periodStart).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                    })
                                  : "—"}{" "}
                                –{" "}
                                {budget.periodEnd
                                  ? new Date(budget.periodEnd).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                    })
                                  : "—"}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

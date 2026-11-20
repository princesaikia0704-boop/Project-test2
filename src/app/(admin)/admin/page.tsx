"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import {
  ShoppingCart,
  Clock,
  IndianRupee,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  ArrowRight,
  Loader2,
  BarChart3,
  Download,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

interface KpiData {
  totalOrderVolume: number;
  pendingApprovalsCount: number;
  spendMtdCents: number;
  lowStockAlertCount: number;
}

const DEFAULT_KPIS: KpiData = {
  totalOrderVolume: 0,
  pendingApprovalsCount: 0,
  spendMtdCents: 0,
  lowStockAlertCount: 0,
};

export default function AdminDashboardPage() {
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [systemStatus, setSystemStatus] = useState<"healthy" | "degraded" | "checking">("checking");

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/health");
      if (res.ok) setSystemStatus("healthy");
      else setSystemStatus("degraded");
    } catch {
      setSystemStatus("degraded");
    }
  }, []);

  const fetchKpis = useCallback(
    async (silent = false) => {
      if (!silent) setIsLoading(true);
      else setIsRefreshing(true);

      try {
        const res = await fetch("/api/admin/kpis");
        if (res.ok) {
          const data = await res.json();
          setKpis({
            totalOrderVolume: data.totalOrderVolume ?? 0,
            pendingApprovalsCount: data.pendingApprovalsCount ?? 0,
            spendMtdCents: data.spendMtdCents ?? 0,
            lowStockAlertCount: data.lowStockAlertCount ?? 0,
          });
          setError(null);
          setLastRefresh(new Date());
        } else {
          const errData = await res.json().catch(() => ({}));
          setError(
            errData.message ||
              `Could not load live metrics (${res.status} ${res.statusText}). Displaying baseline data.`
          );
        }
      } catch (err: any) {
        setError(err.message || "Network error loading dashboard metrics.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    []
  );

  // Initial fetch
  useEffect(() => {
    fetchKpis();
    checkHealth();
  }, [fetchKpis, checkHealth]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchKpis(true);
      checkHealth();
    }, 30_000);
    return () => clearInterval(interval);
  }, [fetchKpis, checkHealth]);

  // Baseline data ensures cards never vanish from UI even if loading or during error
  const activeKpis = kpis || DEFAULT_KPIS;

  const kpiCards = [
    {
      label: "Total Orders",
      value: activeKpis.totalOrderVolume.toLocaleString(),
      icon: <ShoppingCart className="w-5 h-5" />,
      color: "bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800",
      iconBg: "bg-indigo-100 dark:bg-indigo-900/60",
      trend: <TrendingUp className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />,
    },
    {
      label: "Pending Approvals",
      value: activeKpis.pendingApprovalsCount.toLocaleString(),
      icon: <Clock className="w-5 h-5" />,
      color:
        activeKpis.pendingApprovalsCount > 0
          ? "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
          : "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800",
      iconBg: activeKpis.pendingApprovalsCount > 0 ? "bg-amber-100 dark:bg-amber-900/60" : "bg-slate-100 dark:bg-slate-800",
      highlight: activeKpis.pendingApprovalsCount > 0,
      href: "/admin/approvals",
    },
    {
      label: "Total Revenue (MTD)",
      value: formatCurrency(activeKpis.spendMtdCents),
      icon: <IndianRupee className="w-5 h-5" />,
      color: "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
      iconBg: "bg-emerald-100 dark:bg-emerald-900/60",
    },
    {
      label: "Low Stock Alerts",
      value: activeKpis.lowStockAlertCount.toLocaleString(),
      icon: <AlertTriangle className="w-5 h-5" />,
      color:
        activeKpis.lowStockAlertCount > 0
          ? "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800"
          : "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800",
      iconBg: activeKpis.lowStockAlertCount > 0 ? "bg-rose-100 dark:bg-rose-900/60" : "bg-slate-100 dark:bg-slate-800",
      highlight: activeKpis.lowStockAlertCount > 0,
      href: "/admin/catalog",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Admin Dashboard</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Corporate Office Store — Key Performance Indicators
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-[10px] text-slate-400">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <a
            href="/api/admin/billing/export"
            download
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition shadow-sm"
            title="Download billing and cost sheet Excel/CSV"
          >
            <Download className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
            <span>Export Billing Sheet</span>
          </a>
          <button
            type="button"
            data-testid="kpi-refresh-btn"
            onClick={() => {
              fetchKpis(true);
              checkHealth();
            }}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Error Alert Banner */}
      {error && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchKpis(true)}
            className="underline font-bold text-amber-900 dark:text-amber-200 hover:text-amber-700 dark:hover:text-amber-100 shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* KPI Cards (Always Rendered) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading && !kpis
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-32 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse"
              />
            ))
          : kpiCards.map((card) => {
              const Wrapper = card.href ? Link : "div";
              const wrapperProps = card.href ? { href: card.href } : {};
              return (
                <Wrapper
                  key={card.label}
                  {...(wrapperProps as any)}
                  data-testid={`kpi-card-${card.label.toLowerCase().replace(/[\s()]/g, "-")}`}
                  className={`rounded-xl border p-5 shadow-sm transition hover:shadow-md ${card.color} ${
                    card.highlight ? "ring-2 ring-offset-1 ring-current/20" : ""
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.iconBg}`}
                    >
                      {card.icon}
                    </div>
                    {card.trend && (
                      <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        {card.trend}
                      </div>
                    )}
                    {card.href && (
                      <ArrowRight className="w-4 h-4 opacity-40" />
                    )}
                  </div>
                  <div className="mt-3">
                    <span className="text-2xl font-black">{card.value}</span>
                    <p className="text-xs font-medium mt-0.5 opacity-70">
                      {card.label}
                    </p>
                  </div>
                </Wrapper>
              );
            })}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/admin/approvals"
          data-testid="quick-action-approvals"
          className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition group"
        >
          <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-110 transition">
            <Clock className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Review Approvals</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {activeKpis.pendingApprovalsCount} orders pending review
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition" />
        </Link>

        <Link
          href="/admin/catalog"
          data-testid="quick-action-catalog"
          className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition group"
        >
          <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Manage Catalog</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Products, categories & stock</p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition" />
        </Link>

        <Link
          href="/admin/settings"
          data-testid="quick-action-settings"
          className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition group"
        >
          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 group-hover:scale-110 transition">
            <IndianRupee className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Store Settings</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Rules, budgets & branding</p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition" />
        </Link>
      </div>

      {/* System Status */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">System Overview</h2>
          <span
            className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border ${
              systemStatus === "healthy"
                ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800"
                : systemStatus === "degraded"
                ? "text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800"
                : "text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                systemStatus === "healthy"
                  ? "bg-emerald-500 animate-pulse"
                  : systemStatus === "degraded"
                  ? "bg-rose-500"
                  : "bg-slate-400"
              }`}
            />
            {systemStatus === "healthy"
              ? "All Systems Operational"
              : systemStatus === "degraded"
              ? "Service Disrupted"
              : "Checking Systems..."}
          </span>
        </div>
        <div className="p-6 text-center text-slate-400">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 rounded-lg">
              <span className="text-[10px] text-slate-400 dark:text-slate-400 font-medium block">Total Orders</span>
              <span className="text-lg font-black text-slate-900 dark:text-white">
                {activeKpis.totalOrderVolume.toLocaleString()}
              </span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 rounded-lg">
              <span className="text-[10px] text-slate-400 dark:text-slate-400 font-medium block">Approved Revenue</span>
              <span className="text-lg font-black text-slate-900 dark:text-white">
                {formatCurrency(activeKpis.spendMtdCents)}
              </span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 rounded-lg">
              <span className="text-[10px] text-slate-400 dark:text-slate-400 font-medium block">Awaiting Review</span>
              <span className="text-lg font-black text-slate-900 dark:text-white">
                {activeKpis.pendingApprovalsCount}
              </span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 rounded-lg">
              <span className="text-[10px] text-slate-400 dark:text-slate-400 font-medium block">Low Stock Items</span>
              <span className="text-lg font-black text-slate-900 dark:text-white">
                {activeKpis.lowStockAlertCount}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

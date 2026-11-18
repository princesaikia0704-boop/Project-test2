"use client";

import React, { useState, useEffect, useCallback } from "react";
import { DynamicRuleBuilder } from "@/components/admin/DynamicRuleBuilder";
import {
  Settings,
  Save,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
} from "lucide-react";

interface StoreConfig {
  auto_approve_limit_cents: number;
  company_name: string;
  primary_color: string;
  logo_url: string;
}

export default function SettingsPage() {
  const [config, setConfig] = useState<StoreConfig | null>(null);
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

        </>
      )}
    </div>
  );
}

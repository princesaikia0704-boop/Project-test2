"use client";

import React, { useState, useEffect, useCallback } from "react";
import { DynamicRuleBuilder } from "@/components/admin/DynamicRuleBuilder";
import {
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Sun,
  Moon,
  Monitor,
  Palette,
  Bell,
  Shield,
  Download,
  Database,
  Sparkles,
  Check,
  Sliders,
  Layers,
  Mail,
  Save,
  Send,
  Upload,
} from "lucide-react";

interface StoreConfig {
  auto_approve_limit_cents: number;
  company_name: string;
  primary_color: string;
  logo_url: string;
}

type SettingsTab = "appearance" | "rules" | "notifications" | "system";
type ThemeMode = "light" | "dark" | "system";

const ACCENT_COLORS = [
  { id: "indigo", name: "Indigo", hex: "#4F46E5", bg: "bg-indigo-600" },
  { id: "blue", name: "Sky Blue", hex: "#0284C7", bg: "bg-sky-500" },
  { id: "emerald", name: "Emerald", hex: "#059669", bg: "bg-emerald-600" },
  { id: "purple", name: "Purple", hex: "#9333EA", bg: "bg-purple-600" },
  { id: "rose", name: "Rose", hex: "#E11D48", bg: "bg-rose-600" },
  { id: "orange", name: "Orange", hex: "#EA580C", bg: "bg-orange-600" },
  { id: "teal", name: "Teal", hex: "#0D9488", bg: "bg-teal-600" },
  { id: "yellow", name: "Amber", hex: "#CA8A04", bg: "bg-amber-500" },
  { id: "pink", name: "Pink", hex: "#DB2777", bg: "bg-pink-600" },
  { id: "cyan", name: "Cyan", hex: "#0891B2", bg: "bg-cyan-600" },
  { id: "slate", name: "Slate", hex: "#475569", bg: "bg-slate-600" },
  { id: "lime", name: "Lime", hex: "#65A30D", bg: "bg-lime-600" },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("appearance");

  // Role & Developer Site Detection
  const [isDeveloper, setIsDeveloper] = useState(false);
  const [userRole, setUserRole] = useState<string>("MANAGER");

  // Store Config State
  const [config, setConfig] = useState<StoreConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");

  // Theme & Appearance State
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [accent, setAccent] = useState<string>("indigo");
  const [compactDensity, setCompactDensity] = useState(false);

  // Notification Preferences State (Persisted in localStorage)
  const [notificationEmail, setNotificationEmail] = useState<string>("carol.manager@company.com");
  const [emailSaved, setEmailSaved] = useState(false);
  const [testAlertSent, setTestAlertSent] = useState(false);
  const [approvalEmailPref, setApprovalEmailPref] = useState<"instant" | "daily" | "none">("instant");
  const [lowStockAlerts, setLowStockAlerts] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(true);

  // System & Action Feedback
  const [systemFeedback, setSystemFeedback] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  // Detect Persona & Role for Developer Site gating
  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkDeveloperRole = () => {
      const matchRole = document.cookie.match(/(?:^|; )mock_user_role=([^;]*)/);
      const role = matchRole ? decodeURIComponent(matchRole[1]).toUpperCase() : "";
      const matchPersona = document.cookie.match(/(?:^|; )mock_persona=([^;]*)/);
      const persona = matchPersona ? decodeURIComponent(matchPersona[1]) : "";

      let storageRole = "";
      try {
        const stored = localStorage.getItem("active_persona");
        if (stored) {
          const parsed = JSON.parse(stored);
          storageRole = parsed.role?.toUpperCase() || "";
        }
      } catch {}

      const effectiveRole = role || storageRole || (persona === "user-dave-adm" ? "ADMIN" : "MANAGER");
      setUserRole(effectiveRole);

      // System & Maintenance section is strictly restricted to Developer / Admin (Dave Vance)
      const isDev = effectiveRole === "ADMIN" || persona === "user-dave-adm";
      setIsDeveloper(isDev);

      // If non-developer is on the system tab, automatically switch to appearance
      if (!isDev) {
        setActiveTab((curr) => (curr === "system" ? "appearance" : curr));
      }
    };

    checkDeveloperRole();
    window.addEventListener("storage", checkDeveloperRole);
    return () => window.removeEventListener("storage", checkDeveloperRole);
  }, []);

  // Initialize Theme from localStorage / DOM on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedTheme = (localStorage.getItem("app_theme") as ThemeMode) || "light";
    setTheme(savedTheme);

    const savedAccent = localStorage.getItem("app_accent") || "indigo";
    setAccent(savedAccent);
    document.documentElement.setAttribute("data-accent", savedAccent);

    const savedCompact = localStorage.getItem("app_compact") === "true";
    setCompactDensity(savedCompact);
    if (savedCompact) {
      document.documentElement.setAttribute("data-compact", "true");
    } else {
      document.documentElement.removeAttribute("data-compact");
    }

    const savedApprovalEmail = localStorage.getItem("pref_approval_email") as "instant" | "daily" | "none";
    if (savedApprovalEmail) setApprovalEmailPref(savedApprovalEmail);

    const savedNotificationEmail = localStorage.getItem("pref_notification_email");
    if (savedNotificationEmail) setNotificationEmail(savedNotificationEmail);

    const savedLowStock = localStorage.getItem("pref_low_stock");
    if (savedLowStock !== null) setLowStockAlerts(savedLowStock === "true");

    const savedWeekly = localStorage.getItem("pref_weekly_digest");
    if (savedWeekly !== null) setWeeklyDigest(savedWeekly === "true");
  }, []);

  // Theme Switcher Handler
  const handleThemeChange = (newTheme: ThemeMode) => {
    setTheme(newTheme);
    localStorage.setItem("app_theme", newTheme);

    const root = document.documentElement;
    if (newTheme === "dark") {
      root.classList.add("dark");
    } else if (newTheme === "light") {
      root.classList.remove("dark");
    } else {
      // System mode
      const isSystemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (isSystemDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  };

  const handleAccentChange = (accentId: string) => {
    setAccent(accentId);
    localStorage.setItem("app_accent", accentId);
    document.documentElement.setAttribute("data-accent", accentId);
  };

  const handleCompactToggle = () => {
    const next = !compactDensity;
    setCompactDensity(next);
    localStorage.setItem("app_compact", String(next));
    if (next) {
      document.documentElement.setAttribute("data-compact", "true");
    } else {
      document.documentElement.removeAttribute("data-compact");
    }
  };

  // Notification Preference Handlers
  const handleSaveNotificationEmail = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    localStorage.setItem("pref_notification_email", notificationEmail.trim());
    setEmailSaved(true);
    setTimeout(() => setEmailSaved(false), 3000);
  };

  const handleSendTestAlert = () => {
    setTestAlertSent(true);
    setTimeout(() => setTestAlertSent(false), 4000);
  };

  const handleApprovalEmailChange = (val: "instant" | "daily" | "none") => {
    setApprovalEmailPref(val);
    localStorage.setItem("pref_approval_email", val);
  };

  const handleLowStockToggle = () => {
    const next = !lowStockAlerts;
    setLowStockAlerts(next);
    localStorage.setItem("pref_low_stock", String(next));
  };

  const handleWeeklyDigestToggle = () => {
    const next = !weeklyDigest;
    setWeeklyDigest(next);
    localStorage.setItem("pref_weekly_digest", String(next));
  };

  // Fetch Store Config
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
        setTimeout(() => setSaveStatus("idle"), 3500);
      } else {
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 3500);
      }
    } catch (err) {
      console.error("Failed to save config", err);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3500);
    } finally {
      setIsSaving(false);
    }
  };

  // Download System JSON Backup
  const handleExportBackup = async () => {
    try {
      const [prodRes, catRes, configRes, auditRes] = await Promise.all([
        fetch("/api/admin/products"),
        fetch("/api/admin/categories"),
        fetch("/api/admin/store-config"),
        fetch("/api/admin/audit-logs?limit=100"),
      ]);

      const [productsData, categoriesData, configData, auditData] = await Promise.all([
        prodRes.json(),
        catRes.json(),
        configRes.json(),
        auditRes.json(),
      ]);

      const backupPayload = {
        exportedAt: new Date().toISOString(),
        version: "1.0",
        environment: "Phase 1 - In-Memory Mock",
        storeConfig: configData?.config || config,
        products: productsData?.products || [],
        categories: categoriesData?.categories || [],
        recentAuditLogs: auditData?.logs || [],
      };

      const blob = new Blob([JSON.stringify(backupPayload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `office-store-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSystemFeedback("Backup successfully downloaded!");
      setTimeout(() => setSystemFeedback(null), 4000);
    } catch (err) {
      console.error("Failed to generate backup", err);
      setSystemFeedback("Backup generation failed.");
      setTimeout(() => setSystemFeedback(null), 4000);
    }
  };

  // Restore System JSON Backup
  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      if (!backup.storeConfig && !backup.products) {
        setSystemFeedback("Invalid backup format: missing configuration or catalog data.");
        setTimeout(() => setSystemFeedback(null), 4000);
        return;
      }

      if (backup.storeConfig) {
        await fetch("/api/admin/store-config", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(backup.storeConfig),
        });
      }

      setSystemFeedback("System snapshot restored successfully! Configuration refreshed.");
      fetchConfig();
    } catch (err) {
      console.error("Failed to restore backup", err);
      setSystemFeedback("Failed to restore backup file.");
    } finally {
      setTimeout(() => setSystemFeedback(null), 4000);
      e.target.value = "";
    }
  };

  // Reset Demo Seed Data
  const handleResetDemoData = async () => {
    if (!window.confirm("Are you sure you want to reset all mock data to the original seed state? Your recent custom additions will be refreshed.")) {
      return;
    }

    setIsResetting(true);
    try {
      const res = await fetch("/api/admin/seed");
      if (res.ok) {
        setSystemFeedback("Database reset and re-seeded successfully!");
        fetchConfig();
      } else {
        setSystemFeedback("Reset failed.");
      }
    } catch {
      setSystemFeedback("Reset failed.");
    } finally {
      setIsResetting(false);
      setTimeout(() => setSystemFeedback(null), 4000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <span>Settings & Preferences</span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {isDeveloper ? "Developer Console" : "Manager Preferences"}
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isDeveloper
              ? "Configure display themes, order approval thresholds, email alerts, and data maintenance."
              : "Configure display themes, order approval thresholds, and email alerts."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {saveStatus === "success" && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Settings saved!
            </span>
          )}
          {saveStatus === "error" && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-50 dark:bg-rose-950/60 dark:text-rose-300 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800">
              <AlertTriangle className="w-3.5 h-3.5" />
              Save failed.
            </span>
          )}

          <button
            type="button"
            data-testid="settings-refresh-btn"
            onClick={fetchConfig}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900/80 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 w-fit">
        <button
          type="button"
          data-testid="tab-appearance"
          onClick={() => setActiveTab("appearance")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
            activeTab === "appearance"
              ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Sun className="w-3.5 h-3.5" />
          <span>Appearance & Themes</span>
        </button>
        <button
          type="button"
          data-testid="tab-rules"
          onClick={() => setActiveTab("rules")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
            activeTab === "rules"
              ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Store Rules & Branding</span>
        </button>
        <button
          type="button"
          data-testid="tab-notifications"
          onClick={() => setActiveTab("notifications")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
            activeTab === "notifications"
              ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          <span>Notifications</span>
        </button>
        {/* System & Maintenance — strictly restricted to Developer Site */}
        {isDeveloper && (
          <button
            type="button"
            data-testid="tab-system"
            onClick={() => setActiveTab("system")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "system"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Database className="w-3.5 h-3.5 text-indigo-500" />
            <span>System & Maintenance</span>
            <span className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
              Dev Only
            </span>
          </button>
        )}
      </div>

      {/* Global Feedback Banner */}
      {systemFeedback && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-medium text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <Sparkles className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{systemFeedback}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: APPEARANCE & THEMES                                               */}
      {/* ========================================================================= */}
      {activeTab === "appearance" && (
        <div className="space-y-6">
          {/* Theme Selector Card */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sun className="w-4 h-4 text-amber-500" />
                Display Theme Mode
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Select your preferred visual style. Switches between light mode, dark mode, or auto-sync with your OS.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Light Mode Option */}
              <button
                type="button"
                data-testid="theme-light-btn"
                onClick={() => handleThemeChange("light")}
                className={`relative flex flex-col items-start p-4 rounded-xl border-2 text-left transition-all ${
                  theme === "light"
                    ? "border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20 ring-1 ring-indigo-500"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-600 mb-3">
                  <Sun className="w-4 h-4" />
                </div>
                <span className="font-bold text-sm text-slate-900 dark:text-white">Light Mode</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Crisp daylight appearance with light slate cards and dark typography.
                </span>
                {theme === "light" && (
                  <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </button>

              {/* Dark Mode Option */}
              <button
                type="button"
                data-testid="theme-dark-btn"
                onClick={() => handleThemeChange("dark")}
                className={`relative flex flex-col items-start p-4 rounded-xl border-2 text-left transition-all ${
                  theme === "dark"
                    ? "border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20 ring-1 ring-indigo-500"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3">
                  <Moon className="w-4 h-4" />
                </div>
                <span className="font-bold text-sm text-slate-900 dark:text-white">Dark Mode</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Deep slate & charcoal styling designed to eliminate eye fatigue in low-light.
                </span>
                {theme === "dark" && (
                  <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </button>

              {/* System Option */}
              <button
                type="button"
                data-testid="theme-system-btn"
                onClick={() => handleThemeChange("system")}
                className={`relative flex flex-col items-start p-4 rounded-xl border-2 text-left transition-all ${
                  theme === "system"
                    ? "border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20 ring-1 ring-indigo-500"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 mb-3">
                  <Monitor className="w-4 h-4" />
                </div>
                <span className="font-bold text-sm text-slate-900 dark:text-white">System Auto</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Automatically syncs with your computer's day/night system settings.
                </span>
                {theme === "system" && (
                  <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Accent Color Palette Card */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Palette className="w-4 h-4 text-indigo-500" />
                Interface Accent Theme
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Pick a highlight hue applied across badges, active tabs, and primary action buttons.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
              {ACCENT_COLORS.map((item) => {
                const isSelected = accent === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleAccentChange(item.id)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-semibold transition ${
                      isSelected
                        ? "border-slate-900 dark:border-white bg-slate-100 dark:bg-slate-800 shadow-sm ring-2 ring-slate-900/10 dark:ring-white/20"
                        : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <span
                      className="w-5 h-5 rounded-lg shrink-0 shadow-sm flex items-center justify-center text-white"
                      style={{ backgroundColor: item.hex }}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white drop-shadow-sm" />}
                    </span>
                    <span className="text-slate-900 dark:text-white truncate">{item.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Display Density Switch */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-400" />
                Compact View Density
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Reduces row padding and margins in tables to display more items on larger screens.
              </p>
            </div>

            <button
              type="button"
              onClick={handleCompactToggle}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                compactDensity ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  compactDensity ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: STORE RULES & BRANDING                                            */}
      {/* ========================================================================= */}
      {activeTab === "rules" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
          {isLoading ? (
            <div className="space-y-3">
              <div className="h-44 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
            </div>
          ) : config ? (
            <DynamicRuleBuilder currentConfig={config} onSave={handleSaveConfig} />
          ) : (
            <p className="text-xs text-slate-400">No configuration found.</p>
          )}

          {isSaving && (
            <div className="flex items-center gap-2 mt-4 text-xs text-slate-500 dark:text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Saving changes...
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: NOTIFICATIONS & ALERTS                                            */}
      {/* ========================================================================= */}
      {activeTab === "notifications" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Bell className="w-4 h-4 text-indigo-500" />
                Manager & Approver Notification Preferences
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Configure when and how department managers receive requisition approval notifications.
              </p>
            </div>

            {/* Notification Recipient Email Input */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-indigo-500" />
                  Approver & Alert Recipient Email
                </label>
                {emailSaved && (
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Email address updated!
                  </span>
                )}
                {testAlertSent && (
                  <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Test alert simulated for {notificationEmail}
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="email"
                    data-testid="notification-email-input"
                    value={notificationEmail}
                    onChange={(e) => {
                      setNotificationEmail(e.target.value);
                      setEmailSaved(false);
                    }}
                    placeholder="e.g. carol.manager@company.com"
                    className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                  />
                </div>
                <button
                  type="button"
                  data-testid="save-notification-email-btn"
                  onClick={handleSaveNotificationEmail}
                  className="px-3.5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition shadow-sm flex items-center justify-center gap-1.5 shrink-0"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Email
                </button>
                <button
                  type="button"
                  data-testid="send-test-alert-btn"
                  onClick={handleSendTestAlert}
                  className="px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition flex items-center justify-center gap-1.5 shrink-0"
                >
                  <Send className="w-3.5 h-3.5 text-slate-400" />
                  Send Test Ping
                </button>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Purchase requisition alerts, manager approvals, and automated threshold warnings will be routed to this mailbox.
              </p>
            </div>

            {/* Radio options for Approval emails */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Purchase Order Requisition Alerts
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: "instant", label: "Instant Email", desc: "Alert immediately when order exceeds threshold" },
                  { id: "daily", label: "Daily Digest", desc: "Batch requisitions into a 9:00 AM morning email" },
                  { id: "none", label: "Muted", desc: "Only view in Approvals portal without emails" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleApprovalEmailChange(opt.id as any)}
                    className={`p-3 rounded-xl border text-left transition ${
                      approvalEmailPref === opt.id
                        ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">{opt.label}</span>
                      {approvalEmailPref === opt.id && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Toggle row: Low Stock */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  Inventory Low-Stock Warning
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Notify store administrators as soon as an item has 5 or fewer items remaining.
                </span>
              </div>
              <button
                type="button"
                onClick={handleLowStockToggle}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  lowStockAlerts ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-700"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    lowStockAlerts ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Toggle row: Weekly digest */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  Weekly Department Spend Summary
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Send automated Monday morning expense and requisition breakdown to department leads.
                </span>
              </div>
              <button
                type="button"
                onClick={handleWeeklyDigestToggle}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  weeklyDigest ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-700"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    weeklyDigest ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SYSTEM & MAINTENANCE (DEVELOPER SITE ONLY)                         */}
      {/* ========================================================================= */}
      {activeTab === "system" && isDeveloper && (
        <div className="space-y-6">
          {/* Developer Site Notice */}
          <div className="p-3.5 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 rounded-xl text-xs text-indigo-900 dark:text-indigo-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold block">Developer Console Restricted</span>
                <span className="text-[11px] text-indigo-700 dark:text-indigo-300">
                  This section is exclusive to the Developer / Admin panel. It controls raw database operations, environment configurations, and JSON backups.
                </span>
              </div>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-200/70 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 shrink-0">
              Developer Site Only
            </span>
          </div>

          {/* Environment Status Card */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-500" />
              Runtime & Deployment State
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Database Mode</span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  In-Memory Mock Store
                </span>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Active Currency</span>
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  INR — Indian Rupees (₹)
                </span>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Auth Engine</span>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  Role Cookie Persona Matrix
                </span>
              </div>
            </div>
          </div>

          {/* Backup & Export Data */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Download className="w-4 h-4 text-indigo-500" />
                Export System Snapshot (JSON)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-xl">
                Download a complete, offline JSON archive containing all products, categories, current store configuration, and recent audit logs.
              </p>
            </div>

            <button
              type="button"
              data-testid="export-backup-btn"
              onClick={handleExportBackup}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 dark:bg-indigo-600 text-white text-xs font-semibold hover:bg-slate-800 dark:hover:bg-indigo-500 transition shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Download Backup
            </button>
          </div>

          {/* Restore & Import Data */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-indigo-500" />
                Restore System Snapshot (JSON)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-xl">
                Upload a previously saved JSON snapshot archive (e.g. from Downloads) to quickly reload your store configuration, rules, and branding settings.
              </p>
            </div>

            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition cursor-pointer shrink-0">
              <Upload className="w-3.5 h-3.5" />
              <span>Choose Snapshot JSON</span>
              <input
                type="file"
                accept=".json,application/json"
                className="hidden"
                data-testid="import-backup-input"
                onChange={handleImportBackup}
              />
            </label>
          </div>

          {/* Danger Zone: Reset Mock Seed State */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-rose-200 dark:border-rose-900/60 shadow-sm p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-rose-700 dark:text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Reset Store to Clean Seed State
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-xl">
                Re-seeds the in-memory database with the default products, categories, sample orders, and original audit logs.
              </p>
            </div>

            <button
              type="button"
              data-testid="reset-seed-data-btn"
              onClick={handleResetDemoData}
              disabled={isResetting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50 shrink-0"
            >
              {isResetting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Resetting…</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset Demo Data</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Access Denied Fallback for Non-Developer accessing Tab 4 */}
      {activeTab === "system" && !isDeveloper && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 text-center max-w-lg mx-auto my-6 space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
            <Shield className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Developer Site Only</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            The System & Maintenance section is restricted to the Developer / Admin panel. Switch to Dave Administrator in the sidebar to access system backups and database maintenance.
          </p>
          <button
            type="button"
            onClick={() => setActiveTab("appearance")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 dark:bg-indigo-600 text-white text-xs font-semibold hover:bg-slate-800 transition"
          >
            Return to Appearance
          </button>
        </div>
      )}
    </div>
  );
}

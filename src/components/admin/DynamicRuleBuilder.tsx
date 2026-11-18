"use client";

/**
 * Corporate Office Store - Dynamic Rule Builder Component
 * Admin configuration panel for managing store-wide settings:
 * auto-approval threshold, company name, brand color, and logo URL.
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Settings,
  DollarSign,
  Building2,
  Palette,
  ImageIcon,
  RotateCcw,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────
export interface StoreConfig {
  auto_approve_limit_cents: number;
  company_name: string;
  primary_color: string;
  logo_url: string;
}

export interface DynamicRuleBuilderProps {
  currentConfig: StoreConfig;
  onSave: (config: Partial<StoreConfig>) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function dollarsToCents(dollars: string): number {
  const parsed = parseFloat(dollars);
  if (isNaN(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

function isValidHexColor(color: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color);
}

// ── Component ────────────────────────────────────────────────────────────────
export const DynamicRuleBuilder: React.FC<DynamicRuleBuilderProps> = ({
  currentConfig,
  onSave,
}) => {
  // Local form state — threshold displayed in dollars
  const [approvalDollars, setApprovalDollars] = useState(
    centsToDollars(currentConfig.auto_approve_limit_cents)
  );
  const [companyName, setCompanyName] = useState(currentConfig.company_name);
  const [primaryColor, setPrimaryColor] = useState(currentConfig.primary_color);
  const [logoUrl, setLogoUrl] = useState(currentConfig.logo_url);

  // Reset form when currentConfig changes externally
  useEffect(() => {
    setApprovalDollars(centsToDollars(currentConfig.auto_approve_limit_cents));
    setCompanyName(currentConfig.company_name);
    setPrimaryColor(currentConfig.primary_color);
    setLogoUrl(currentConfig.logo_url);
  }, [currentConfig]);

  // ── Change Detection ───────────────────────────────────────────────────
  const hasChanges = useMemo(() => {
    const newCents = dollarsToCents(approvalDollars);
    return (
      newCents !== currentConfig.auto_approve_limit_cents ||
      companyName.trim() !== currentConfig.company_name ||
      primaryColor.trim() !== currentConfig.primary_color ||
      logoUrl.trim() !== currentConfig.logo_url
    );
  }, [approvalDollars, companyName, primaryColor, logoUrl, currentConfig]);

  // ── Validation ─────────────────────────────────────────────────────────
  const validationErrors = useMemo(() => {
    const errors: Record<string, string> = {};

    const dollars = parseFloat(approvalDollars);
    if (isNaN(dollars) || dollars < 0) {
      errors.approvalDollars = "Must be a valid non-negative dollar amount.";
    }

    if (!companyName.trim()) {
      errors.companyName = "Company name is required.";
    }

    if (!primaryColor.trim()) {
      errors.primaryColor = "Primary color is required.";
    } else if (!isValidHexColor(primaryColor.trim())) {
      errors.primaryColor = "Must be a valid hex color (e.g. #0F172A).";
    }

    return errors;
  }, [approvalDollars, companyName, primaryColor]);

  const isFormValid = Object.keys(validationErrors).length === 0;

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setApprovalDollars(centsToDollars(currentConfig.auto_approve_limit_cents));
    setCompanyName(currentConfig.company_name);
    setPrimaryColor(currentConfig.primary_color);
    setLogoUrl(currentConfig.logo_url);
  }, [currentConfig]);

  const handleSave = useCallback(() => {
    if (!isFormValid || !hasChanges) return;

    // Only send changed fields
    const changes: Partial<StoreConfig> = {};
    const newCents = dollarsToCents(approvalDollars);

    if (newCents !== currentConfig.auto_approve_limit_cents) {
      changes.auto_approve_limit_cents = newCents;
    }
    if (companyName.trim() !== currentConfig.company_name) {
      changes.company_name = companyName.trim();
    }
    if (primaryColor.trim() !== currentConfig.primary_color) {
      changes.primary_color = primaryColor.trim();
    }
    if (logoUrl.trim() !== currentConfig.logo_url) {
      changes.logo_url = logoUrl.trim();
    }

    onSave(changes);
  }, [
    isFormValid,
    hasChanges,
    approvalDollars,
    companyName,
    primaryColor,
    logoUrl,
    currentConfig,
    onSave,
  ]);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div data-testid="dynamic-rule-builder" className="w-full max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800">
          <Settings className="w-5 h-5 text-slate-600 dark:text-slate-300" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Store Configuration</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage approval rules, branding, and display settings.
          </p>
        </div>
      </div>

      {/* Form Fields */}
      <div className="space-y-5">
        {/* Auto-Approval Threshold */}
        <div className="space-y-1.5">
          <label
            htmlFor="auto-approve-limit"
            className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            <DollarSign className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            Auto-Approval Threshold
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Orders below this amount will be automatically approved without manager review.
          </p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-medium">
              ₹
            </span>
            <input
              data-testid="rule-builder-approval-limit"
              id="auto-approve-limit"
              type="number"
              min="0"
              step="0.01"
              value={approvalDollars}
              onChange={(e) => setApprovalDollars(e.target.value)}
              className={cn(
                "w-full pl-8 pr-4 py-2.5 rounded-lg border text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 font-semibold focus:outline-none focus:ring-2 focus:border-transparent transition-shadow",
                validationErrors.approvalDollars
                  ? "border-red-300 focus:ring-red-400"
                  : "border-slate-300 dark:border-slate-700 focus:ring-slate-500"
              )}
            />
          </div>
          {validationErrors.approvalDollars && (
            <p className="text-xs text-red-600">{validationErrors.approvalDollars}</p>
          )}
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Internal value: {dollarsToCents(approvalDollars).toLocaleString()} cents
          </p>
        </div>

        {/* Company Name */}
        <div className="space-y-1.5">
          <label
            htmlFor="company-name"
            className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            <Building2 className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            Company Name
          </label>
          <input
            data-testid="rule-builder-company-name"
            id="company-name"
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            maxLength={255}
            className={cn(
              "w-full px-4 py-2.5 rounded-lg border text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:border-transparent transition-shadow",
              validationErrors.companyName
                ? "border-red-300 focus:ring-red-400"
                : "border-slate-300 dark:border-slate-700 focus:ring-slate-500"
            )}
            placeholder="e.g. Acme Corporation"
          />
          {validationErrors.companyName && (
            <p className="text-xs text-red-600">{validationErrors.companyName}</p>
          )}
        </div>

        {/* Primary Brand Color */}
        <div className="space-y-1.5">
          <label
            htmlFor="primary-color"
            className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            <Palette className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            Primary Brand Color
          </label>
          <div className="flex items-center gap-3">
            <input
              data-testid="rule-builder-primary-color"
              id="primary-color"
              type="text"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              maxLength={7}
              className={cn(
                "flex-1 px-4 py-2.5 rounded-lg border text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 font-mono focus:outline-none focus:ring-2 focus:border-transparent transition-shadow",
                validationErrors.primaryColor
                  ? "border-red-300 focus:ring-red-400"
                  : "border-slate-300 dark:border-slate-700 focus:ring-slate-500"
              )}
              placeholder="#0F172A"
            />
            {/* Color Preview Square */}
            <div
              data-testid="rule-builder-color-preview"
              className="w-11 h-11 rounded-lg border-2 border-slate-200 dark:border-slate-700 shrink-0 shadow-inner"
              style={{
                backgroundColor: isValidHexColor(primaryColor.trim())
                  ? primaryColor.trim()
                  : "#E2E8F0",
              }}
              title={
                isValidHexColor(primaryColor.trim())
                  ? primaryColor.trim()
                  : "Invalid color"
              }
            />
          </div>
          {validationErrors.primaryColor && (
            <p className="text-xs text-red-600">{validationErrors.primaryColor}</p>
          )}
        </div>

        {/* Logo URL */}
        <div className="space-y-1.5">
          <label
            htmlFor="logo-url"
            className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            <ImageIcon className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            Logo URL
          </label>
          <input
            data-testid="rule-builder-logo-url"
            id="logo-url"
            type="text"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-shadow"
            placeholder="https://example.com/logo.png"
          />
          {/* Logo Preview */}
          {logoUrl.trim() && (
            <div className="mt-2 flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                data-testid="rule-builder-logo-preview"
                src={logoUrl.trim()}
                alt="Logo preview"
                className="w-12 h-12 object-contain rounded"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <span className="text-xs text-slate-500 dark:text-slate-400 truncate flex-1">{logoUrl.trim()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
        <button
          data-testid="rule-builder-reset-btn"
          type="button"
          onClick={handleReset}
          disabled={!hasChanges}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition-all",
            hasChanges
              ? "text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
              : "text-slate-400 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 cursor-not-allowed"
          )}
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </button>
        <button
          data-testid="rule-builder-save-btn"
          type="button"
          onClick={handleSave}
          disabled={!isFormValid || !hasChanges}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-all",
            isFormValid && hasChanges
              ? "bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 active:scale-95"
              : "bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed"
          )}
        >
          <Save className="w-4 h-4" />
          Save Changes
        </button>
      </div>
    </div>
  );
};

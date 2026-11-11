"use client";

/**
 * Corporate Office Store - Stock Editor Modal
 * Admin modal for adjusting product inventory levels.
 * Supports two modes: "Set Absolute" and "Adjust Delta (+/-)".
 */

import React, { useState, useEffect, useCallback } from "react";
import { X, Package, Plus, Minus, Hash } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Props ────────────────────────────────────────────────────────────────────
export interface StockEditorProduct {
  id: string;
  name: string;
  stock_quantity: number;
}

export interface StockEditorModalProps {
  product: StockEditorProduct;
  isOpen: boolean;
  onClose: () => void;
  onSave: (productId: string, newStock: number) => void;
}

// ── Mode Type ────────────────────────────────────────────────────────────────
type StockEditMode = "absolute" | "delta";

// ── Component ────────────────────────────────────────────────────────────────
export const StockEditorModal: React.FC<StockEditorModalProps> = ({
  product,
  isOpen,
  onClose,
  onSave,
}) => {
  const [mode, setMode] = useState<StockEditMode>("absolute");
  const [absoluteValue, setAbsoluteValue] = useState<string>("");
  const [deltaValue, setDeltaValue] = useState<string>("");
  const [error, setError] = useState<string>("");

  // Reset form when modal opens or product changes
  useEffect(() => {
    if (isOpen) {
      setMode("absolute");
      setAbsoluteValue(String(product.stock_quantity));
      setDeltaValue("0");
      setError("");
    }
  }, [isOpen, product]);

  // Compute the resulting stock value
  const computedStock = useCallback((): number | null => {
    if (mode === "absolute") {
      const val = parseInt(absoluteValue, 10);
      return isNaN(val) ? null : val;
    }
    const delta = parseInt(deltaValue, 10);
    if (isNaN(delta)) return null;
    return product.stock_quantity + delta;
  }, [mode, absoluteValue, deltaValue, product.stock_quantity]);

  // Validate current input
  const validate = useCallback((): string => {
    const result = computedStock();
    if (result === null) {
      return "Please enter a valid number.";
    }
    if (result < 0) {
      return "Stock cannot be negative.";
    }
    return "";
  }, [computedStock]);

  // Handle save
  const handleSave = () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    const newStock = computedStock()!;
    onSave(product.id, newStock);
  };

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Clear error on input change
  useEffect(() => {
    setError("");
  }, [absoluteValue, deltaValue, mode]);

  if (!isOpen) return null;

  const resultingStock = computedStock();
  const isValid = resultingStock !== null && resultingStock >= 0;

  return (
    <div
      data-testid="stock-editor-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        data-testid="stock-editor-modal"
        className="relative w-full max-w-md mx-4 bg-white rounded-xl shadow-2xl border border-slate-200 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-100">
              <Package className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Adjust Stock</h2>
              <p className="text-sm text-slate-500 truncate max-w-[250px]" title={product.name}>
                {product.name}
              </p>
            </div>
          </div>
          <button
            data-testid="stock-editor-close-btn"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Current Stock Display */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-sm font-medium text-slate-600">Current Stock</span>
            <span
              data-testid="stock-editor-current"
              className="text-lg font-bold text-slate-900"
            >
              {product.stock_quantity}
            </span>
          </div>

          {/* Mode Toggle */}
          <div className="flex gap-2">
            <button
              data-testid="stock-editor-mode-absolute"
              type="button"
              onClick={() => setMode("absolute")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition-all",
                mode === "absolute"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              )}
            >
              <Hash className="w-4 h-4" />
              Set Absolute
            </button>
            <button
              data-testid="stock-editor-mode-delta"
              type="button"
              onClick={() => setMode("delta")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition-all",
                mode === "delta"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              )}
            >
              <Plus className="w-3.5 h-3.5" />
              <Minus className="w-3.5 h-3.5 -ml-1.5" />
              Adjust Delta
            </button>
          </div>

          {/* Input Area */}
          {mode === "absolute" ? (
            <div>
              <label
                htmlFor="absolute-stock"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                New Stock Quantity
              </label>
              <input
                data-testid="stock-editor-absolute-input"
                id="absolute-stock"
                type="number"
                min="0"
                step="1"
                value={absoluteValue}
                onChange={(e) => setAbsoluteValue(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-shadow"
                placeholder="Enter new stock quantity"
              />
            </div>
          ) : (
            <div>
              <label
                htmlFor="delta-stock"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Adjustment Amount (+/-)
              </label>
              <input
                data-testid="stock-editor-delta-input"
                id="delta-stock"
                type="number"
                step="1"
                value={deltaValue}
                onChange={(e) => setDeltaValue(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-shadow"
                placeholder="e.g. +10 or -5"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                Use positive numbers to add stock, negative to reduce.
              </p>
            </div>
          )}

          {/* Resulting Stock Preview */}
          {resultingStock !== null && (
            <div
              data-testid="stock-editor-preview"
              className={cn(
                "flex items-center justify-between px-4 py-3 rounded-lg border",
                resultingStock < 0
                  ? "bg-red-50 border-red-200"
                  : resultingStock === 0
                    ? "bg-amber-50 border-amber-200"
                    : "bg-emerald-50 border-emerald-200"
              )}
            >
              <span className="text-sm font-medium text-slate-600">Resulting Stock</span>
              <span
                data-testid="stock-editor-result"
                className={cn(
                  "text-lg font-bold",
                  resultingStock < 0
                    ? "text-red-700"
                    : resultingStock === 0
                      ? "text-amber-700"
                      : "text-emerald-700"
                )}
              >
                {resultingStock}
              </span>
            </div>
          )}

          {/* Validation Error */}
          {error && (
            <p data-testid="stock-editor-error" className="text-sm text-red-600 font-medium">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button
            data-testid="stock-editor-cancel-btn"
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            data-testid="stock-editor-save-btn"
            type="button"
            onClick={handleSave}
            disabled={!isValid}
            className={cn(
              "px-6 py-2 rounded-lg text-sm font-semibold text-white transition-all",
              isValid
                ? "bg-slate-900 hover:bg-slate-800 active:scale-95"
                : "bg-slate-300 cursor-not-allowed"
            )}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

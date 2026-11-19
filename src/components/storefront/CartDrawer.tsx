"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import { BudgetMeter } from "@/components/storefront/BudgetMeter";
import { formatCurrency } from "@/lib/utils";
import {
  X,
  Trash2,
  Plus,
  Minus,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Loader2,
} from "lucide-react";

export interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  departmentBudget?: {
    totalCents: number;
    remainingCents: number;
  };
  autoApproveLimitCents?: number;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  departmentBudget = { totalCents: 100000, remainingCents: 100000 },
  autoApproveLimitCents = 10000,
}) => {
  const router = useRouter();
  const { items, updateQuantity, removeFromCart, clearCart, cartTotalCents } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const isOverBudget = cartTotalCents > departmentBudget.remainingCents;
  const isAutoApproved = cartTotalCents <= autoApproveLimitCents;

  const handleCheckout = async () => {
    if (items.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    const idempotencyKey = `chk-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          items: items.map((i) => ({
            productId: i.product.id,
            quantity: i.quantity,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Order submission failed");
      }

      clearCart();
      onClose();
      router.push("/orders?success=true");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to process checkout");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border-l border-transparent dark:border-slate-800 h-full shadow-2xl flex flex-col z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-slate-700 dark:text-slate-300" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Your Cart ({items.length})</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <ShoppingBag className="w-14 h-14 mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Your cart is empty</p>
              <p className="text-xs text-slate-400 mb-4">Add supplies from the catalog to build an order.</p>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-900 dark:bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 dark:hover:bg-indigo-500 transition-colors shadow-sm"
              >
                Browse Catalog
              </button>
            </div>
          ) : (
            <>
              {/* Line Items List */}
              <div className="space-y-3">
                {items.map(({ product, quantity }) => (
                  <div
                    key={product.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/60"
                  >
                    <div className="relative w-14 h-14 rounded bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0">
                      {product.imageUrl ? (
                        <Image
                          src={product.imageUrl}
                          alt={product.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                          Item
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-semibold text-slate-900 dark:text-white truncate" title={product.name}>
                        {product.name}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                        {formatCurrency(product.priceCents)} each
                      </p>

                      <div className="flex items-center justify-between">
                        {/* Stepper */}
                        <div className="flex items-center rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5">
                          <button
                            type="button"
                            onClick={() => updateQuantity(product.id, quantity - 1)}
                            className="w-5 h-5 flex items-center justify-center text-slate-500 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center text-xs font-medium text-slate-800 dark:text-slate-100">
                            {quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(product.id, quantity + 1)}
                            disabled={quantity >= product.stockQuantity}
                            className="w-5 h-5 flex items-center justify-center text-slate-500 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white disabled:opacity-30"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Subtotal & Remove */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {formatCurrency(product.priceCents * quantity)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeFromCart(product.id)}
                            className="text-slate-400 hover:text-red-600 dark:hover:text-rose-400 transition-colors"
                            title="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="p-3 bg-red-50 dark:bg-rose-950/60 border border-red-200 dark:border-rose-800 rounded-lg text-xs text-red-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Checkout Controls */}
        {items.length > 0 && (
          <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 space-y-3">
            <div className="flex justify-between items-baseline text-sm">
              <span className="text-slate-600 dark:text-slate-400">Cart Total</span>
              <span className="text-xl font-black text-slate-900 dark:text-white">
                {formatCurrency(cartTotalCents)}
              </span>
            </div>

            <div className="flex gap-2">
              <Link
                href="/cart"
                onClick={onClose}
                className="w-1/3 flex items-center justify-center py-2.5 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                View Full Cart
              </Link>

              <button
                type="button"
                data-testid="checkout-submit-btn"
                onClick={handleCheckout}
                disabled={isSubmitting}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-bold text-white transition-all ${
                  isSubmitting
                    ? "bg-slate-400 dark:bg-slate-800 cursor-not-allowed text-slate-500"
                    : "bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 active:scale-95 shadow"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting Order...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Checkout</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

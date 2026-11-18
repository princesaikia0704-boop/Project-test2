"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import { formatCurrency } from "@/lib/utils";
import {
  Plus,
  Minus,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Loader2,
} from "lucide-react";

export default function CartPage() {
  const router = useRouter();
  const { items, updateQuantity, removeFromCart, clearCart, cartTotalCents } = useCart();
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const autoApproveLimitCents = 10000; // $100
  const isAutoApproved = cartTotalCents <= autoApproveLimitCents;

  const handleCheckout = async () => {
    if (items.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    const idempotencyKey = `chk-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      const res = await fetch("/api/orders", {
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
          notes: notes.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Checkout submission failed");
      }

      clearCart();
      router.push(`/orders?placedOrder=${data.orderId}`);
    } catch (err: any) {
      setError(err.message || "Failed to submit order");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center max-w-lg mx-auto">
        <ShoppingBag className="w-16 h-16 mx-auto mb-3 text-slate-300" />
        <h2 className="text-lg font-bold text-slate-800 mb-1">Your Shopping Cart is Empty</h2>
        <p className="text-xs text-slate-500 mb-6">
          Your cart currently has no items. Visit the catalog to add stationery, electronics, or equipment.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition"
        >
          <span>Explore Catalog</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-3">
        <h1 className="text-2xl font-black text-slate-900">Review Cart & Checkout</h1>
        <p className="text-xs text-slate-500">
          Review requisition line items against your department budget before placing order.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Line Items Table & Notes */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 font-semibold text-xs text-slate-600">
              Cart Items ({items.length})
            </div>
            <div className="divide-y divide-slate-100">
              {items.map(({ product, quantity }) => (
                <div key={product.id} className="p-4 flex items-center gap-4">
                  <div className="relative w-16 h-16 rounded-lg bg-slate-100 overflow-hidden shrink-0">
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
                    <h3 className="font-semibold text-sm text-slate-900 truncate">
                      {product.name}
                    </h3>
                    <p className="text-xs text-slate-500">{formatCurrency(product.priceCents)} unit price</p>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1">
                    <button
                      type="button"
                      onClick={() => updateQuantity(product.id, quantity - 1)}
                      className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-slate-900"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center text-xs font-semibold text-slate-900">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(product.id, quantity + 1)}
                      disabled={quantity >= product.stockQuantity}
                      className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-slate-900 disabled:opacity-30"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Total & Remove */}
                  <div className="text-right min-w-[80px]">
                    <span className="block font-bold text-sm text-slate-900">
                      {formatCurrency(product.priceCents * quantity)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFromCart(product.id)}
                      className="text-xs text-slate-400 hover:text-red-600 transition"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Requisition Notes */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Order Requisition Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Provide business justification or specific delivery instructions..."
              rows={3}
              className="w-full p-2.5 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
            />
          </div>
        </div>

        {/* Right Column: Submit */}
        <div className="space-y-4">

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
              Order Summary
            </h3>

            {/* Price breakdown commented out for now:
            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-900">{formatCurrency(cartTotalCents)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping & Handling</span>
                <span className="font-semibold text-emerald-600">Free (Internal)</span>
              </div>
              <div className="flex justify-between">
                <span>Estimated Tax</span>
                <span className="font-semibold text-slate-900">$0.00 (Exempt)</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between text-sm">
                <span className="font-bold text-slate-900">Total Order</span>
                <span className="font-black text-slate-900">{formatCurrency(cartTotalCents)}</span>
              </div>
            </div>
            */}

            {/* Approval Routing Notice commented out for now:
            <div
              className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
                isAutoApproved
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-amber-50 border-amber-200 text-amber-800"
              }`}
            >
              {isAutoApproved ? (
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              )}
              <div>
                <span className="font-semibold block">
                  {isAutoApproved ? "Instant Auto-Approval" : "Manager Approval Required"}
                </span>
                <span className="text-[11px] leading-relaxed">
                  {isAutoApproved
                    ? `Order total is under ${formatCurrency(autoApproveLimitCents)} and will be processed immediately.`
                    : `Order total exceeds ${formatCurrency(autoApproveLimitCents)} threshold and must be approved by Carol Manager.`}
                </span>
              </div>
            </div>
            */}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleCheckout}
              disabled={isSubmitting}
              className={`w-full py-3 rounded-xl font-bold text-xs text-white flex items-center justify-center gap-2 transition shadow-sm ${
                isSubmitting
                  ? "bg-slate-300 cursor-not-allowed"
                  : "bg-slate-900 hover:bg-slate-800 active:scale-98"
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting Order...</span>
                </>
              ) : (
                <>
                  <span>Confirm & Submit Order</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

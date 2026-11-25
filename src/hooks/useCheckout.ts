/**
 * Hook that extracts checkout logic from CartDrawer into a reusable unit.
 * Handles order submission, idempotency key generation, loading state,
 * and error messages.
 */
"use client";

import { useState } from "react";

export interface CheckoutItem {
  productId: string;
  quantity: number;
}

export interface UseCheckoutOptions {
  onSuccess?: () => void;
  onError?: (message: string) => void;
}

export interface UseCheckoutReturn {
  submitOrder: (items: CheckoutItem[]) => Promise<string | null>;
  isSubmitting: boolean;
  errorMessage: string | null;
  clearError: () => void;
}

/**
 * Handles order submission to POST /api/orders.
 * Returns the new order ID on success, or null on failure.
 *
 * @param options.onSuccess - Callback invoked after a successful order
 * @param options.onError   - Callback invoked with the error message on failure
 */
export function useCheckout({
  onSuccess,
  onError,
}: UseCheckoutOptions = {}): UseCheckoutReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clearError = () => setErrorMessage(null);

  const submitOrder = async (items: CheckoutItem[]): Promise<string | null> => {
    if (items.length === 0 || isSubmitting) return null;

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
        body: JSON.stringify({ items }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Order submission failed");
      }

      onSuccess?.();
      return data.order?.id ?? data.id ?? null;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to process checkout";
      setErrorMessage(msg);
      onError?.(msg);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  return { submitOrder, isSubmitting, errorMessage, clearError };
}

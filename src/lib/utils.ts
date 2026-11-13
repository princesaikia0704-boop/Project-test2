import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility to merge Tailwind CSS classes with proper conflict resolution.
 * Combines clsx for conditional classes and tailwind-merge for deduplication.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format cents to USD display string.
 * @example formatCurrency(15099) => "$150.99"
 */
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/**
 * Format a date string or Date to a human-readable format.
 */
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

/**
 * Truncate a string to a max length with ellipsis.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + "…";
}

/**
 * Generate a UUIDv4 for idempotency keys.
 */
export function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}

/**
 * Delay helper for optimistic UI debouncing.
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type BudgetZone = "GREEN" | "AMBER" | "RED";

export interface BudgetZoneResult {
  zone: BudgetZone;
  ratio: number;
  projectedRemainingCents: number;
}

/**
 * Calculate the department budget zone, utilization ratio, and projected remaining cents.
 * - GREEN: < 70% utilized
 * - AMBER: 70% to 90% utilized
 * - RED: > 90% utilized or overdraft (< 0 remaining)
 */
export function calculateBudgetZone(
  totalCents: number,
  remainingCents: number,
  cartTotalCents: number = 0
): BudgetZoneResult {
  const projectedRemainingCents = remainingCents - cartTotalCents;

  if (totalCents <= 0) {
    return {
      zone: "RED",
      ratio: 1,
      projectedRemainingCents,
    };
  }

  // Spent includes committed spend + current cart addition
  const spentCents = totalCents - remainingCents + cartTotalCents;
  const ratio = Math.max(0, spentCents / totalCents);

  let zone: BudgetZone = "GREEN";
  if (ratio > 0.9 || projectedRemainingCents < 0) {
    zone = "RED";
  } else if (ratio >= 0.7) {
    zone = "AMBER";
  }

  return {
    zone,
    ratio,
    projectedRemainingCents,
  };
}

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Package,
  User,
  Building2,
  Clock,
  Loader2,
  Inbox,
} from "lucide-react";

interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
}

interface PendingOrder {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  departmentId: string;
  departmentName: string;
  totalCents: number;
  status: string;
  createdAt: string;
  items: OrderItem[];
}

export default function ApprovalsPage() {
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const fetchPendingOrders = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const res = await fetch("/api/admin/approvals");
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error("Failed to fetch pending approvals", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchPendingOrders();
  }, [fetchPendingOrders]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchPendingOrders(true), 15_000);
    return () => clearInterval(interval);
  }, [fetchPendingOrders]);

  const handleDecision = async (orderId: string, action: "APPROVED" | "REJECTED") => {
    setProcessingIds((prev) => new Set(prev).add(orderId));

    // Optimistic UI: remove from list immediately
    const previousOrders = [...orders];
    setOrders((prev) => prev.filter((o) => o.id !== orderId));

    try {
      const res = await fetch(`/api/orders/${orderId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        // Rollback on failure
        setOrders(previousOrders);
        console.error("Failed to process approval decision");
      }
    } catch (err) {
      // Rollback on error
      setOrders(previousOrders);
      console.error("Error processing approval", err);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  const toggleExpand = (orderId: string) => {
    setExpandedOrderId((prev) => (prev === orderId ? null : orderId));
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Order Approvals</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Review and approve pending purchase orders exceeding the auto-approval threshold.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            {orders.length} pending {orders.length === 1 ? "order" : "orders"}
          </span>
          <button
            type="button"
            data-testid="approvals-refresh-btn"
            onClick={() => fetchPendingOrders(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-slate-200 animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
          <Inbox className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <h3 className="text-base font-bold text-slate-700 mb-1">All caught up!</h3>
          <p className="text-xs text-slate-400">
            There are no orders pending approval right now. Orders exceeding the auto-approval threshold will appear here.
          </p>
        </div>
      ) : (
        /* Orders List */
        <div className="space-y-3">
          {orders.map((order) => {
            const isExpanded = expandedOrderId === order.id;
            const isProcessing = processingIds.has(order.id);

            return (
              <div
                key={order.id}
                data-testid={`approval-row-${order.id}`}
                className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition ${
                  isProcessing ? "opacity-50 pointer-events-none" : ""
                }`}
              >
                {/* Order Summary Row */}
                <div className="flex items-center gap-4 p-4">
                  <button
                    type="button"
                    onClick={() => toggleExpand(order.id)}
                    className="shrink-0 text-slate-400 hover:text-slate-600 transition"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                  </button>

                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-5 gap-2 items-center">
                    {/* Order ID */}
                    <div>
                      <span className="text-[10px] text-slate-400 font-medium block">Order</span>
                      <span className="text-xs font-bold text-slate-900 font-mono">
                        #{order.id.slice(0, 8)}
                      </span>
                    </div>

                    {/* Employee */}
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <div>
                        <span className="text-xs font-semibold text-slate-900 block">
                          {order.userName || order.userId}
                        </span>
                        <span className="text-[10px] text-slate-400">{order.userEmail}</span>
                      </div>
                    </div>

                    {/* Department */}
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-xs text-slate-600">
                        {order.departmentName || order.departmentId}
                      </span>
                    </div>

                    {/* Total */}
                    <div>
                      <span className="text-[10px] text-slate-400 font-medium block">Total</span>
                      <span className="text-sm font-black text-slate-900">
                        {formatCurrency(order.totalCents)}
                      </span>
                    </div>

                    {/* Date */}
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-[10px] text-slate-500">
                        {formatDate(order.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      data-testid={`approve-btn-${order.id}`}
                      onClick={() => handleDecision(order.id, "APPROVED")}
                      disabled={isProcessing}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      Approve
                    </button>
                    <button
                      type="button"
                      data-testid={`reject-btn-${order.id}`}
                      onClick={() => handleDecision(order.id, "REJECTED")}
                      disabled={isProcessing}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-rose-600 text-xs font-bold hover:bg-rose-50 transition disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Reject
                    </button>
                  </div>
                </div>

                {/* Expanded Order Items */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Order Items ({order.items?.length || 0})
                    </h4>
                    {order.items && order.items.length > 0 ? (
                      <div className="space-y-2">
                        {order.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 bg-white rounded-lg border border-slate-100 p-3"
                          >
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                              <Package className="w-4 h-4 text-slate-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-semibold text-slate-900 block truncate">
                                {item.productName || item.productId}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                Qty: {item.quantity} × {formatCurrency(item.unitPriceCents)}
                              </span>
                            </div>
                            <span className="text-xs font-bold text-slate-900">
                              {formatCurrency(item.quantity * item.unitPriceCents)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">No item details available.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
  History,
  AlertCircle,
  FileText,
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
  orderNumber?: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  departmentId: string;
  departmentName?: string;
  totalCents: number;
  status: string;
  createdAt: string;
  notes?: string | null;
  items?: OrderItem[];
}

export default function ApprovalsPage() {
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [historyOrders, setHistoryOrders] = useState<PendingOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // Rejection modal state
  const [rejectingOrder, setRejectingOrder] = useState<PendingOrder | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionError, setRejectionError] = useState<string | null>(null);

  // Fetch pending approvals: reads data.approvals instead of data.orders
  const fetchPendingOrders = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const res = await fetch("/api/admin/approvals");
      if (res.ok) {
        const data = await res.json();
        // Support both data.approvals and fallback to data.orders
        setOrders(data.approvals || data.orders || []);
      }
    } catch (err) {
      console.error("Failed to fetch pending approvals", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Fetch department-wide order history
  const fetchDepartmentHistory = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const res = await fetch("/api/admin/orders");
      if (res.ok) {
        const data = await res.json();
        setHistoryOrders(data.orders || []);
      }
    } catch (err) {
      console.error("Failed to fetch department order history", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial and tab-based fetch
  useEffect(() => {
    if (activeTab === "pending") {
      fetchPendingOrders();
    } else {
      fetchDepartmentHistory();
    }
  }, [activeTab, fetchPendingOrders, fetchDepartmentHistory]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeTab === "pending") fetchPendingOrders(true);
      else fetchDepartmentHistory(true);
    }, 15_000);
    return () => clearInterval(interval);
  }, [activeTab, fetchPendingOrders, fetchDepartmentHistory]);

  // Decision handler: sends { decision: "APPROVE" } or { decision: "REJECT", comment: "..." }
  const handleDecision = async (
    orderId: string,
    decision: "APPROVE" | "REJECT",
    comment?: string
  ) => {
    setProcessingIds((prev) => new Set(prev).add(orderId));

    // Optimistic UI: remove from pending list immediately
    const previousOrders = [...orders];
    setOrders((prev) => prev.filter((o) => o.id !== orderId));

    try {
      const payload: { decision: "APPROVE" | "REJECT"; comment?: string } =
        decision === "APPROVE"
          ? { decision: "APPROVE" }
          : { decision: "REJECT", comment: comment?.trim() };

      const res = await fetch(`/api/orders/${orderId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        // Rollback on failure
        setOrders(previousOrders);
        const errData = await res.json().catch(() => ({}));
        alert(errData.message || errData.error || "Failed to process approval decision");
      } else {
        // Refresh department history in the background
        fetchDepartmentHistory(true);
      }
    } catch (err: any) {
      // Rollback on error
      setOrders(previousOrders);
      alert(err.message || "Error processing approval");
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  const openRejectModal = (order: PendingOrder) => {
    setRejectingOrder(order);
    setRejectionReason("");
    setRejectionError(null);
  };

  const confirmRejection = async () => {
    if (!rejectionReason.trim()) {
      setRejectionError("Rejection reason comment is required by the approval API.");
      return;
    }
    if (!rejectingOrder) return;
    const orderId = rejectingOrder.id;
    const comment = rejectionReason.trim();
    setRejectingOrder(null);
    await handleDecision(orderId, "REJECT", comment);
  };

  const toggleExpand = (orderId: string) => {
    setExpandedOrderId((prev) => (prev === orderId ? null : orderId));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            Approved
          </span>
        );
      case "PENDING_APPROVAL":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3" />
            Pending Approval
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="w-3 h-3" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  const currentList = activeTab === "pending" ? orders : historyOrders;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Manager Approvals Portal</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Review department purchase requisitions and inspect department-wide order history.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            data-testid="approvals-refresh-btn"
            onClick={() => (activeTab === "pending" ? fetchPendingOrders(true) : fetchDepartmentHistory(true))}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
        <button
          type="button"
          onClick={() => setActiveTab("pending")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition ${
            activeTab === "pending"
              ? "bg-slate-900 text-white shadow"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <ClipboardCheck className="w-4 h-4" />
          <span>Pending Approvals</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeTab === "pending" ? "bg-slate-700 text-white" : "bg-slate-200 text-slate-700"
            }`}
          >
            {orders.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition ${
            activeTab === "history"
              ? "bg-slate-900 text-white shadow"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <History className="w-4 h-4" />
          <span>Department Order History</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeTab === "history" ? "bg-slate-700 text-white" : "bg-slate-200 text-slate-700"
            }`}
          >
            {historyOrders.length}
          </span>
        </button>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-slate-200 animate-pulse" />
          ))}
        </div>
      ) : currentList.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
          <Inbox className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <h3 className="text-base font-bold text-slate-700 mb-1">
            {activeTab === "pending" ? "All caught up!" : "No department orders yet"}
          </h3>
          <p className="text-xs text-slate-400">
            {activeTab === "pending"
              ? "There are no orders pending approval for your department right now."
              : "No orders have been placed in your department yet."}
          </p>
        </div>
      ) : (
        /* Orders List */
        <div className="space-y-3">
          {currentList.map((order) => {
            const isExpanded = expandedOrderId === order.id;
            const isProcessing = processingIds.has(order.id);

            return (
              <div
                key={order.id}
                data-testid={`approval-card-${order.id}`}
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:border-slate-300"
              >
                <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Order Info */}
                  <div className="flex flex-wrap items-center gap-4 flex-1">
                    <button
                      type="button"
                      onClick={() => toggleExpand(order.id)}
                      className="text-slate-400 hover:text-slate-600 p-1"
                      aria-label={isExpanded ? "Collapse details" : "Expand details"}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>

                    {/* Order Reference */}
                    <div>
                      <span className="font-mono text-xs font-bold text-slate-900 block">
                        {order.orderNumber || `#${order.id.slice(0, 8)}`}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ID: {order.id.slice(0, 8)}
                      </span>
                    </div>

                    {/* Requester */}
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <div>
                        <span className="text-xs font-semibold text-slate-700 block">
                          {order.userName || order.userId}
                        </span>
                        {order.userEmail && (
                          <span className="text-[10px] text-slate-400">{order.userEmail}</span>
                        )}
                      </div>
                    </div>

                    {/* Department */}
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-xs text-slate-600">
                        {order.departmentName || order.departmentId}
                      </span>
                    </div>

                    {/* Status Badge */}
                    <div>{getStatusBadge(order.status)}</div>

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

                  {/* Action Buttons for Pending Orders */}
                  {order.status === "PENDING_APPROVAL" && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        data-testid={`approve-btn-${order.id}`}
                        onClick={() => handleDecision(order.id, "APPROVE")}
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
                        onClick={() => openRejectModal(order)}
                        disabled={isProcessing}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-rose-600 text-xs font-bold hover:bg-rose-50 transition disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </div>
                  )}
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

      {/* Modal for Entering Rejection Reason */}
      {rejectingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600">
                  <XCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Reject Order Requisition</h3>
                  <p className="text-xs text-slate-400">
                    Order {rejectingOrder.orderNumber || `#${rejectingOrder.id.slice(0, 8)}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRejectingOrder(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Rejection Reason / Comment <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => {
                  setRejectionReason(e.target.value);
                  if (rejectionError) setRejectionError(null);
                }}
                placeholder="Explain why this requisition is being rejected (required by policy)..."
                rows={3}
                className="w-full p-2.5 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                autoFocus
              />
              {rejectionError && (
                <p className="text-xs text-rose-600 mt-1 font-medium">{rejectionError}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRejectingOrder(null)}
                className="px-3.5 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRejection}
                className="px-4 py-2 rounded-lg bg-rose-600 text-xs font-bold text-white hover:bg-rose-700 transition"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Shared TypeScript DTOs and interfaces for the Office Store application.
 * Import these types everywhere instead of re-defining inline.
 *
 * @module types
 */

// ─── Re-export DB schema types ───────────────────────────────────────────────
export type {
  Product,
  Order,
  OrderItem,
  Category,
  AuditLog,
  Department,
  User,
  DepartmentBudget,
  DepartmentBudget as Budget,
  StoreSettings,
  StoreSettings as StoreConfig,
  NewProduct,
  NewOrder,
  NewOrderItem,
  NewCategory,
  NewDepartment,
  NewUser,
  NewDepartmentBudget,
  NewDepartmentBudget as NewBudget,
  NewAuditLog,
  NewStoreSettings,
  NewStoreSettings as NewStoreConfig,
} from "@/lib/db/schema";

// ─── User / Auth ─────────────────────────────────────────────────────────────

export type UserRole = "EMPLOYEE" | "MANAGER" | "ADMIN";

export interface ResolvedUser {
  id: string;
  role: UserRole;
  departmentId: string;
  name?: string;
  email?: string;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  code: string;
  message?: string;
}

export interface ApiSuccess<T = unknown> {
  data: T;
  message?: string;
}

// ─── Store Config ─────────────────────────────────────────────────────────────

export interface StoreConfigData {
  company_name: string;
  logo_url: string;
  primary_color: string;
  currency: string;
  auto_approve_limit_cents: number;
  low_stock_threshold: number;
  require_justification_above_cents: number;
  max_order_quantity: number;
  notify_manager_on_order: boolean;
  notify_on_low_stock: boolean;
  enable_budget_enforcement: boolean;
  maintenance_mode: boolean;
  theme?: string;
  accent?: string;
  compact_mode?: boolean;
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export type OrderStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "FULFILLED";

export interface OrderWithItems {
  id: string;
  userId: string;
  departmentId: string;
  status: OrderStatus;
  totalCents: number;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    unitPriceCents: number;
    productName?: string;
  }>;
}

export interface CreateOrderPayload {
  items: Array<{ productId: string; quantity: number }>;
  notes?: string;
}

// ─── Products ─────────────────────────────────────────────────────────────────

export interface ProductFilters {
  categoryId?: string;
  search?: string;
  inStockOnly?: boolean;
  page?: number;
  limit?: number;
}

// ─── Budget ───────────────────────────────────────────────────────────────────

export interface BudgetSummary {
  departmentId: string;
  totalCents: number;
  spentCents: number;
  remainingCents: number;
  periodStart: Date;
  periodEnd: Date;
}

// ─── KPIs ─────────────────────────────────────────────────────────────────────

export interface DashboardKPIs {
  totalOrders: number;
  pendingApprovals: number;
  totalSpentCents: number;
  lowStockCount: number;
  budgetUtilizationPercent: number;
}

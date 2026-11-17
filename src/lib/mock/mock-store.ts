/**
 * In-Memory Reactive Data Store & Drizzle Query Adapter
 * Provides zero-crash fallback resilience when live database is unconfigured.
 */

import {
  SEED_DEPARTMENTS,
  SEED_BUDGETS,
  SEED_USERS,
  SEED_CATEGORIES,
  SEED_PRODUCTS,
  SEED_STORE_SETTINGS,
  SEED_AUDIT_LOGS,
  DepartmentSeed,
  UserSeed,
  DepartmentBudgetSeed,
  CategorySeed,
  ProductSeed,
  StoreSettingsSeed,
} from "./seed-data";

export interface OrderItemRecord {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPriceCents: number;
  totalPriceCents: number;
  createdAt: Date;
}

export interface OrderRecord {
  id: string;
  orderNumber: string;
  userId: string;
  departmentId: string;
  totalCents: number;
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "FULFILLED" | "CANCELLED";
  approvedByUserId: string | null;
  rejectionReason: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLogRecord {
  id: string;
  adminUserId: string | null;
  action: "CREATE" | "UPDATE" | "DELETE" | "APPROVE" | "REJECT" | "STOCK_ADJUST" | "CONFIG_UPDATE";
  entityType: "PRODUCT" | "CATEGORY" | "ORDER" | "STORE_SETTINGS" | "DEPARTMENT_BUDGET" | "USER" | "DEPARTMENT";
  entityId: string;
  oldValue: string | null;
  newValue: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export class MockDataStore {
  public departments = new Map<string, DepartmentSeed>();
  public departmentBudgets = new Map<string, DepartmentBudgetSeed>();
  public users = new Map<string, UserSeed>();
  public categories = new Map<string, CategorySeed>();
  public products = new Map<string, ProductSeed>();
  public orders = new Map<string, OrderRecord>();
  public orderItems = new Map<string, OrderItemRecord>();
  public storeSettings: StoreSettingsSeed = { ...SEED_STORE_SETTINGS };
  public auditLogs: AuditLogRecord[] = [];

  constructor() {
    this.reset();
  }

  /**
   * Resets all store collections back to initial clean seed state.
   */
  public reset(): void {
    this.departments.clear();
    for (const d of SEED_DEPARTMENTS) this.departments.set(d.id, { ...d });

    this.departmentBudgets.clear();
    for (const b of SEED_BUDGETS) this.departmentBudgets.set(b.id, { ...b });

    this.users.clear();
    for (const u of SEED_USERS) this.users.set(u.id, { ...u });
    // Also register mock persona users
    this.users.set("user-bob-emp", {
      id: "user-bob-emp",
      clerkId: "mock_bob",
      email: "bob@company.com",
      name: "Bob Staff Engineer",
      role: "EMPLOYEE",
      departmentId: "10000000-0000-0000-0000-000000000001",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    this.users.set("user-carol-mgr", {
      id: "user-carol-mgr",
      clerkId: "mock_carol",
      email: "carol@company.com",
      name: "Carol Manager",
      role: "MANAGER",
      departmentId: "10000000-0000-0000-0000-000000000001",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    this.users.set("user-dave-adm", {
      id: "user-dave-adm",
      clerkId: "mock_dave",
      email: "dave@company.com",
      name: "Dave Administrator",
      role: "ADMIN",
      departmentId: "10000000-0000-0000-0000-000000000002",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Ensure Operations department exists
    if (!this.departments.has("10000000-0000-0000-0000-000000000005")) {
      this.departments.set("10000000-0000-0000-0000-000000000005", {
        id: "10000000-0000-0000-0000-000000000005",
        name: "Operations",
        code: "OPS",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      this.departments.set("dept-ops", {
        id: "dept-ops",
        name: "Operations",
        code: "OPS",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    this.categories.clear();
    for (const c of SEED_CATEGORIES) this.categories.set(c.id, { ...c });

    this.products.clear();
    for (const p of SEED_PRODUCTS) this.products.set(p.id, { ...p });

    this.orders.clear();
    this.orderItems.clear();
    this.storeSettings = { ...SEED_STORE_SETTINGS };
    this.auditLogs = SEED_AUDIT_LOGS.map((a) => ({ ...a }));

    // Seed realistic sample orders for instant dashboard and approvals population
    const sampleOrderId1 = "60000000-0000-0000-0000-000000000001";
    this.orders.set(sampleOrderId1, {
      id: sampleOrderId1,
      orderNumber: "ORD-SAMPLE-0001",
      userId: "30000000-0000-0000-0000-000000000001", // Alex Chen
      departmentId: "10000000-0000-0000-0000-000000000001", // Engineering
      totalCents: 6999, // $69.99
      status: "APPROVED",
      approvedByUserId: "user-carol-mgr", // Carol Manager
      rejectionReason: null,
      notes: "Sample initial order - Precision Mouse",
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    });
    this.orderItems.set("70000000-0000-0000-0000-000000000001", {
      id: "70000000-0000-0000-0000-000000000001",
      orderId: sampleOrderId1,
      productId: "50000000-0000-0000-0000-000000000006", // Precision Mouse
      quantity: 1,
      unitPriceCents: 6999,
      totalPriceCents: 6999,
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    });

    // Pending Requisition 1: Ergonomic Mesh Chair
    const pendingOrderId1 = "60000000-0000-0000-0000-000000000002";
    this.orders.set(pendingOrderId1, {
      id: pendingOrderId1,
      orderNumber: "ORD-REQ-2026-002",
      userId: "user-bob-emp", // Bob Staff Engineer
      departmentId: "10000000-0000-0000-0000-000000000001", // Engineering
      totalCents: 34999, // $349.99
      status: "PENDING_APPROVAL",
      approvedByUserId: null,
      rejectionReason: null,
      notes: "Ergonomic Mesh Task Chair for remote workstation",
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    });
    this.orderItems.set("70000000-0000-0000-0000-000000000002", {
      id: "70000000-0000-0000-0000-000000000002",
      orderId: pendingOrderId1,
      productId: "50000000-0000-0000-0000-000000000001", // Ergonomic Mesh Task Chair
      quantity: 1,
      unitPriceCents: 34999,
      totalPriceCents: 34999,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    });

    // Pending Requisition 2: Standing Desk Converter
    const pendingOrderId2 = "60000000-0000-0000-0000-000000000003";
    this.orders.set(pendingOrderId2, {
      id: pendingOrderId2,
      orderNumber: "ORD-REQ-2026-003",
      userId: "30000000-0000-0000-0000-000000000001", // Alex Chen
      departmentId: "10000000-0000-0000-0000-000000000001", // Engineering
      totalCents: 18950, // $189.50
      status: "PENDING_APPROVAL",
      approvedByUserId: null,
      rejectionReason: null,
      notes: "Height-Adjustable Standing Desk Converter for sprint station",
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });
    this.orderItems.set("70000000-0000-0000-0000-000000000003", {
      id: "70000000-0000-0000-0000-000000000003",
      orderId: pendingOrderId2,
      productId: "50000000-0000-0000-0000-000000000003", // Standing Desk Converter
      quantity: 1,
      unitPriceCents: 18950,
      totalPriceCents: 18950,
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });

    // History Requisition 3 (Rejected): Active Sitting Stool
    const rejectedOrderId = "60000000-0000-0000-0000-000000000004";
    this.orders.set(rejectedOrderId, {
      id: rejectedOrderId,
      orderNumber: "ORD-REQ-2026-004",
      userId: "user-bob-emp", // Bob Staff Engineer
      departmentId: "10000000-0000-0000-0000-000000000001", // Engineering
      totalCents: 11900, // $119.00
      status: "REJECTED",
      approvedByUserId: "user-carol-mgr",
      rejectionReason: "Quarterly ergonomic allowance exceeded. Please re-submit next fiscal cycle.",
      notes: "Active Sitting Balance Stool",
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    });
    this.orderItems.set("70000000-0000-0000-0000-000000000004", {
      id: "70000000-0000-0000-0000-000000000004",
      orderId: rejectedOrderId,
      productId: "50000000-0000-0000-0000-000000000004", // Active Sitting Stool
      quantity: 1,
      unitPriceCents: 11900,
      totalPriceCents: 11900,
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    });
  }

  // ---------------------------------------------------------------------------
  // CATALOG & PRODUCTS
  // ---------------------------------------------------------------------------

  public getProducts(filter?: {
    categoryId?: string;
    search?: string;
    isActive?: boolean;
    lowStockOnly?: boolean;
    limit?: number;
    offset?: number;
  }): { products: ProductSeed[]; total: number } {
    let list = Array.from(this.products.values());

    if (filter?.isActive !== undefined) {
      list = list.filter((p) => p.isActive === filter.isActive);
    }
    if (filter?.categoryId) {
      list = list.filter((p) => p.categoryId === filter.categoryId);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q)
      );
    }
    if (filter?.lowStockOnly) {
      list = list.filter((p) => p.stockQuantity <= p.lowStockThreshold);
    }

    const total = list.length;
    const offset = filter?.offset ?? 0;
    const limit = filter?.limit ?? 50;
    const paged = list.slice(offset, offset + limit);

    return { products: paged, total };
  }

  public getProductById(id: string): ProductSeed | null {
    return this.products.get(id) ?? null;
  }

  public createProduct(data: Omit<ProductSeed, "id" | "createdAt" | "updatedAt">): ProductSeed {
    const id = `50000000-${Date.now().toString(16).padStart(12, "0")}`;
    const now = new Date();
    const product: ProductSeed = {
      id,
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    this.products.set(id, product);
    return { ...product };
  }

  public updateProduct(id: string, data: Partial<ProductSeed>): ProductSeed {
    const p = this.products.get(id);
    if (!p) throw new Error(`Product not found: ${id}`);
    const updated = { ...p, ...data, updatedAt: new Date() };
    this.products.set(id, updated);
    return { ...updated };
  }

  public deleteProduct(id: string): boolean {
    return this.products.delete(id);
  }

  public updateStock(productId: string, delta: number): ProductSeed {
    const p = this.products.get(productId);
    if (!p) throw new Error(`Product not found: ${productId}`);
    const nextStock = p.stockQuantity + delta;
    if (nextStock < 0) {
      throw new Error(`INSUFFICIENT_STOCK: Product ${p.name} has only ${p.stockQuantity} remaining.`);
    }
    p.stockQuantity = nextStock;
    p.updatedAt = new Date();
    return { ...p };
  }

  // ---------------------------------------------------------------------------
  // CATEGORIES
  // ---------------------------------------------------------------------------

  public getCategories(filter?: { isActive?: boolean }): CategorySeed[] {
    let list = Array.from(this.categories.values());
    if (filter?.isActive !== undefined) {
      list = list.filter((c) => c.isActive === filter.isActive);
    }
    return list.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  public getCategoryById(id: string): CategorySeed | null {
    return this.categories.get(id) ?? null;
  }

  public createCategory(data: Omit<CategorySeed, "id" | "createdAt" | "updatedAt">): CategorySeed {
    const id = `40000000-${Date.now().toString(16).padStart(12, "0")}`;
    const now = new Date();
    const cat: CategorySeed = {
      id,
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    this.categories.set(id, cat);
    return { ...cat };
  }

  public updateCategory(id: string, data: Partial<CategorySeed>): CategorySeed {
    const c = this.categories.get(id);
    if (!c) throw new Error(`Category not found: ${id}`);
    const updated = { ...c, ...data, updatedAt: new Date() };
    this.categories.set(id, updated);
    return { ...updated };
  }

  // ---------------------------------------------------------------------------
  // DEPARTMENTS & BUDGETS
  // ---------------------------------------------------------------------------

  public getDepartments(): DepartmentSeed[] {
    return Array.from(this.departments.values());
  }

  public getDepartmentById(id: string): DepartmentSeed | null {
    return this.departments.get(id) ?? null;
  }

  public getDepartmentBudgets(departmentId?: string): DepartmentBudgetSeed[] {
    const list = Array.from(this.departmentBudgets.values());
    if (departmentId) {
      return list.filter((b) => b.departmentId === departmentId);
    }
    return list;
  }

  public getActiveBudget(departmentId: string): DepartmentBudgetSeed | null {
    const now = new Date();
    for (const b of this.departmentBudgets.values()) {
      if (b.departmentId === departmentId && b.periodStart <= now && b.periodEnd >= now) {
        return { ...b };
      }
    }
    return null;
  }

  public deductBudget(budgetId: string, amountCents: number): DepartmentBudgetSeed {
    const b = this.departmentBudgets.get(budgetId);
    if (!b) throw new Error(`Budget not found: ${budgetId}`);
    if (b.remainingCents < amountCents) {
      throw new Error(
        `INSUFFICIENT_DEPARTMENT_BUDGET: Required ${amountCents} cents, only ${b.remainingCents} cents remaining.`
      );
    }
    b.remainingCents -= amountCents;
    b.updatedAt = new Date();
    return { ...b };
  }

  public refundBudget(budgetId: string, amountCents: number): DepartmentBudgetSeed {
    const b = this.departmentBudgets.get(budgetId);
    if (!b) throw new Error(`Budget not found: ${budgetId}`);
    b.remainingCents = Math.min(b.totalCents, b.remainingCents + amountCents);
    b.updatedAt = new Date();
    return { ...b };
  }

  public updateBudget(budgetId: string, data: Partial<DepartmentBudgetSeed>): DepartmentBudgetSeed {
    const b = this.departmentBudgets.get(budgetId);
    if (!b) throw new Error(`Budget not found: ${budgetId}`);
    const updated = { ...b, ...data, updatedAt: new Date() };
    this.departmentBudgets.set(budgetId, updated);
    return { ...updated };
  }

  // ---------------------------------------------------------------------------
  // USERS
  // ---------------------------------------------------------------------------

  public getUsers(): UserSeed[] {
    return Array.from(this.users.values());
  }

  public getUserById(id: string): UserSeed | null {
    return this.users.get(id) ?? null;
  }

  public getUserByClerkId(clerkId: string): UserSeed | null {
    for (const u of this.users.values()) {
      if (u.clerkId === clerkId) return { ...u };
    }
    return null;
  }

  public getUserByEmail(email: string): UserSeed | null {
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) return { ...u };
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // ORDER PROCESSING & ACID SIMULATION
  // ---------------------------------------------------------------------------

  public createOrder(
    orderData: Omit<OrderRecord, "id" | "orderNumber" | "createdAt" | "updatedAt">,
    itemsData: { productId: string; quantity: number; unitPriceCents: number }[]
  ): { order: OrderRecord; items: OrderItemRecord[] } {
    const orderId = `60000000-${Date.now().toString(16).padStart(12, "0")}`;
    const rand = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${rand}`;
    const now = new Date();

    const order: OrderRecord = {
      id: orderId,
      orderNumber,
      ...orderData,
      createdAt: now,
      updatedAt: now,
    };

    const createdItems: OrderItemRecord[] = [];
    for (const it of itemsData) {
      const itemId = `70000000-${Date.now().toString(16).padStart(12, "0")}-${Math.random().toString(16).slice(2, 6)}`;
      const rec: OrderItemRecord = {
        id: itemId,
        orderId,
        productId: it.productId,
        quantity: it.quantity,
        unitPriceCents: it.unitPriceCents,
        totalPriceCents: it.quantity * it.unitPriceCents,
        createdAt: now,
      };
      this.orderItems.set(itemId, rec);
      createdItems.push(rec);
    }

    this.orders.set(orderId, order);
    return { order, items: createdItems };
  }

  public getOrderById(id: string): (OrderRecord & { items: (OrderItemRecord & { product?: ProductSeed })[]; user?: UserSeed; department?: DepartmentSeed }) | null {
    const order = this.orders.get(id);
    if (!order) return null;

    const items: (OrderItemRecord & { product?: ProductSeed })[] = [];
    for (const item of this.orderItems.values()) {
      if (item.orderId === id) {
        items.push({
          ...item,
          product: this.products.get(item.productId) ?? undefined,
        });
      }
    }

    return {
      ...order,
      items,
      user: this.users.get(order.userId) ?? undefined,
      department: this.departments.get(order.departmentId) ?? undefined,
    };
  }

  public getOrders(filter?: {
    userId?: string;
    departmentId?: string;
    status?: OrderRecord["status"];
    limit?: number;
    offset?: number;
  }): OrderRecord[] {
    let list = Array.from(this.orders.values());

    if (filter?.userId) {
      list = list.filter((o) => o.userId === filter.userId);
    }
    if (filter?.departmentId) {
      list = list.filter(
        (o) =>
          o.departmentId === filter.departmentId ||
          (filter.departmentId === "dept-eng" &&
            o.departmentId === "10000000-0000-0000-0000-000000000001") ||
          (filter.departmentId === "10000000-0000-0000-0000-000000000001" &&
            o.departmentId === "dept-eng")
      );
    }
    if (filter?.status) {
      list = list.filter((o) => o.status === filter.status);
    }

    list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const offset = filter?.offset ?? 0;
    const limit = filter?.limit ?? 50;
    return list.slice(offset, offset + limit);
  }

  public updateOrderStatus(
    orderId: string,
    status: OrderRecord["status"],
    approvedByUserId?: string,
    rejectionReason?: string
  ): OrderRecord {
    const order = this.orders.get(orderId);
    if (!order) throw new Error(`Order not found: ${orderId}`);

    const oldStatus = order.status;
    order.status = status;
    order.updatedAt = new Date();

    if (approvedByUserId) order.approvedByUserId = approvedByUserId;
    if (rejectionReason) order.rejectionReason = rejectionReason;

    // Automatic rollback if order is rejected or cancelled
    if ((status === "REJECTED" || status === "CANCELLED") && oldStatus !== "REJECTED" && oldStatus !== "CANCELLED") {
      const budget = this.getActiveBudget(order.departmentId);
      if (budget) {
        this.refundBudget(budget.id, order.totalCents);
      }
      // Restore stock for all line items
      for (const item of this.orderItems.values()) {
        if (item.orderId === orderId) {
          const product = this.products.get(item.productId);
          if (product) {
            product.stockQuantity += item.quantity;
            product.updatedAt = new Date();
          }
        }
      }
    }

    return { ...order };
  }

  // ---------------------------------------------------------------------------
  // STORE SETTINGS
  // ---------------------------------------------------------------------------

  public getStoreSettings(): StoreSettingsSeed {
    return { ...this.storeSettings };
  }

  public updateStoreSettings(data: Partial<StoreSettingsSeed>): StoreSettingsSeed {
    this.storeSettings = {
      ...this.storeSettings,
      ...data,
      id: 1, // ensure singleton id remains 1
      updatedAt: new Date(),
    };
    return { ...this.storeSettings };
  }

  // ---------------------------------------------------------------------------
  // AUDIT LOGS
  // ---------------------------------------------------------------------------

  public addAuditLog(entry: Omit<AuditLogRecord, "id" | "createdAt">): AuditLogRecord {
    const id = `80000000-${Date.now().toString(16).padStart(12, "0")}`;
    const rec: AuditLogRecord = {
      id,
      ...entry,
      createdAt: new Date(),
    };
    this.auditLogs.unshift(rec);
    return { ...rec };
  }

  public getFilteredAuditLogs(filter?: {
    entityType?: string;
    entityId?: string;
    adminUserId?: string;
    action?: string;
    from?: string;
    to?: string;
  }): AuditLogRecord[] {
    let list = this.auditLogs;
    if (filter?.entityType && filter.entityType !== "ALL") {
      list = list.filter((l) => l.entityType === filter.entityType);
    }
    if (filter?.action && filter.action !== "ALL") {
      list = list.filter((l) => l.action === filter.action);
    }
    if (filter?.entityId) {
      list = list.filter((l) => l.entityId === filter.entityId);
    }
    if (filter?.adminUserId) {
      list = list.filter((l) => l.adminUserId === filter.adminUserId);
    }
    if (filter?.from) {
      const fromDate = new Date(filter.from);
      list = list.filter((l) => new Date(l.createdAt) >= fromDate);
    }
    if (filter?.to) {
      const toDate = new Date(filter.to);
      toDate.setHours(23, 59, 59, 999);
      list = list.filter((l) => new Date(l.createdAt) <= toDate);
    }
    return list;
  }

  public getAuditLogs(filter?: {
    entityType?: string;
    entityId?: string;
    adminUserId?: string;
    action?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }): AuditLogRecord[] {
    const list = this.getFilteredAuditLogs(filter);
    const offset = filter?.offset ?? 0;
    const limit = filter?.limit ?? 50;
    return list.slice(offset, offset + limit);
  }

  public countAuditLogs(filter?: {
    entityType?: string;
    entityId?: string;
    adminUserId?: string;
    action?: string;
    from?: string;
    to?: string;
  }): number {
    return this.getFilteredAuditLogs(filter).length;
  }

  // ---------------------------------------------------------------------------
  // SNAPSHOT & TRANSACTION ROLLBACK
  // ---------------------------------------------------------------------------

  public snapshot(): string {
    return JSON.stringify({
      departments: Array.from(this.departments.entries()),
      departmentBudgets: Array.from(this.departmentBudgets.entries()),
      users: Array.from(this.users.entries()),
      categories: Array.from(this.categories.entries()),
      products: Array.from(this.products.entries()),
      orders: Array.from(this.orders.entries()),
      orderItems: Array.from(this.orderItems.entries()),
      storeSettings: this.storeSettings,
      auditLogs: this.auditLogs,
    });
  }

  public restore(snapshotStr: string): void {
    const data = JSON.parse(snapshotStr);
    this.departments = new Map(data.departments);
    this.departmentBudgets = new Map(data.departmentBudgets);
    this.users = new Map(data.users);
    this.categories = new Map(data.categories);
    this.products = new Map(data.products);
    this.orders = new Map(data.orders);
    this.orderItems = new Map(data.orderItems);
    this.storeSettings = data.storeSettings;
    this.auditLogs = data.auditLogs;
  }

  public async transaction<T>(callback: () => Promise<T>): Promise<T> {
    const snap = this.snapshot();
    try {
      return await callback();
    } catch (err) {
      this.restore(snap);
      throw err;
    }
  }
}

// -----------------------------------------------------------------------------
// SINGLETON & DRIZZLE MOCK ADAPTER
// -----------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line no-var
  var _mockDataStore: MockDataStore | undefined;
}

export const mockDataStore = globalThis._mockDataStore ?? new MockDataStore();
if (process.env.NODE_ENV !== "production") {
  globalThis._mockDataStore = mockDataStore;
}

/**
 * Creates a Drizzle-compatible database proxy routing to MockDataStore
 */
export function getMockDrizzleClient(): any {
  const queryProxy = new Proxy(
    {},
    {
      get(_target, prop: string) {
        return {
          findMany: async (options?: any) => {
            if (prop === "products") {
              const res = mockDataStore.getProducts(options);
              return res.products;
            }
            if (prop === "categories") return mockDataStore.getCategories();
            if (prop === "departments") return mockDataStore.getDepartments();
            if (prop === "departmentBudgets") return mockDataStore.getDepartmentBudgets();
            if (prop === "users") return mockDataStore.getUsers();
            if (prop === "orders") return mockDataStore.getOrders(options);
            if (prop === "orderItems") return Array.from(mockDataStore.orderItems.values());
            if (prop === "storeSettings") return [mockDataStore.getStoreSettings()];
            if (prop === "auditLogs") return mockDataStore.getAuditLogs(options);
            return [];
          },
          findFirst: async (options?: any) => {
            if (prop === "storeSettings") return mockDataStore.getStoreSettings();
            if (prop === "products") {
              const res = Array.from(mockDataStore.products.values());
              return res[0] ?? null;
            }
            if (prop === "departmentBudgets") {
              const res = Array.from(mockDataStore.departmentBudgets.values());
              return res[0] ?? null;
            }
            if (prop === "users") {
              const res = Array.from(mockDataStore.users.values());
              return res[0] ?? null;
            }
            if (prop === "orders") {
              const res = Array.from(mockDataStore.orders.values());
              return res[0] ?? null;
            }
            if (prop === "categories") {
              const res = Array.from(mockDataStore.categories.values());
              return res[0] ?? null;
            }
            if (prop === "departments") {
              const res = Array.from(mockDataStore.departments.values());
              return res[0] ?? null;
            }
            return null;
          },
        };
      },
    }
  );

  return {
    query: queryProxy,
    select: () => {
      const builder: any = {
        from: (table: any) => {
          const tableName = table?._?.name ?? table?.tableName ?? "products";
          builder._table = tableName;
          return builder;
        },
        where: () => builder,
        orderBy: () => builder,
        limit: () => builder,
        offset: () => builder,
        then: (resolve: any) => {
          const table = builder._table;
          if (table === "products") return resolve(Array.from(mockDataStore.products.values()));
          if (table === "categories") return resolve(mockDataStore.getCategories());
          if (table === "departments") return resolve(mockDataStore.getDepartments());
          if (table === "department_budgets" || table === "departmentBudgets")
            return resolve(mockDataStore.getDepartmentBudgets());
          if (table === "users") return resolve(mockDataStore.getUsers());
          if (table === "orders") return resolve(mockDataStore.getOrders());
          if (table === "order_items" || table === "orderItems")
            return resolve(Array.from(mockDataStore.orderItems.values()));
          if (table === "store_settings" || table === "storeSettings")
            return resolve([mockDataStore.getStoreSettings()]);
          if (table === "audit_logs" || table === "auditLogs")
            return resolve(mockDataStore.getAuditLogs());
          return resolve([]);
        },
      };
      return builder;
    },
    insert: (table: any) => {
      const tableName = table?._?.name ?? table?.tableName ?? "";
      return {
        values: (vals: any) => ({
          returning: () => {
            const records = Array.isArray(vals) ? vals : [vals];
            return Promise.resolve(records);
          },
          then: (resolve: any) => {
            const records = Array.isArray(vals) ? vals : [vals];
            return resolve(records);
          },
        }),
      };
    },
    update: (table: any) => ({
      set: (vals: any) => ({
        where: () => ({
          returning: () => Promise.resolve([vals]),
          then: (resolve: any) => resolve([vals]),
        }),
      }),
    }),
    delete: (table: any) => ({
      where: () => Promise.resolve([]),
    }),
    execute: async () => [],
    transaction: async (cb: (tx: any) => Promise<any>) => {
      return await mockDataStore.transaction(async () => {
        return await cb(getMockDrizzleClient());
      });
    },
  };
}

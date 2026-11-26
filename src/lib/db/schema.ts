import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  check,
  pgEnum,
} from "drizzle-orm/pg-core";
import { sql, relations } from "drizzle-orm";

// =============================================================================
// ENUMS
// =============================================================================

// User roles for Role-Based Access Control (RBAC)
export const userRoleEnum = pgEnum("user_role", [
  "EMPLOYEE",
  "MANAGER",
  "ADMIN",
]);

// Purchase order lifecycle states
export const orderStatusEnum = pgEnum("order_status", [
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "FULFILLED",
  "CANCELLED",
]);

// Administrative audit action types
export const auditActionEnum = pgEnum("audit_action", [
  "CREATE",
  "UPDATE",
  "DELETE",
  "APPROVE",
  "REJECT",
  "STOCK_ADJUST",
  "CONFIG_UPDATE",
]);

// Audited domain entity types
export const entityTypeEnum = pgEnum("entity_type", [
  "PRODUCT",
  "CATEGORY",
  "ORDER",
  "STORE_SETTINGS",
  "DEPARTMENT_BUDGET",
  "USER",
  "DEPARTMENT",
]);

// TypeScript Types for Enums
export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type OrderStatus = (typeof orderStatusEnum.enumValues)[number];
export type AuditAction = (typeof auditActionEnum.enumValues)[number];
export type EntityType = (typeof entityTypeEnum.enumValues)[number];

// =============================================================================
// 1. DEPARTMENTS TABLE
// =============================================================================
export const departments = pgTable(
  "departments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    code: varchar("code", { length: 50 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("departments_name_idx").on(table.name),
    uniqueIndex("departments_code_idx").on(table.code),
  ]
);

// =============================================================================
// 2. USERS TABLE
// =============================================================================
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkId: varchar("clerk_id", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    passwordHash: text("password_hash"),
    sessionVersion: integer("session_version").default(1).notNull(),
    failedLoginAttempts: integer("failed_login_attempts").default(0).notNull(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    role: userRoleEnum("role").default("EMPLOYEE").notNull(),
    departmentId: uuid("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("users_clerk_id_idx").on(table.clerkId),
    uniqueIndex("users_email_idx").on(table.email),
    index("users_department_id_idx").on(table.departmentId),
    index("users_role_idx").on(table.role),
  ]
);

// =============================================================================
// 2B. PASSWORD RESET TOKENS TABLE (Single-Use, Hashed, Expiring)
// =============================================================================
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("password_reset_tokens_hash_idx").on(table.tokenHash),
    index("password_reset_tokens_user_idx").on(table.userId),
    index("password_reset_tokens_expires_idx").on(table.expiresAt),
  ]
);

// =============================================================================
// 3. DEPARTMENT BUDGETS TABLE
// =============================================================================
export const departmentBudgets = pgTable(
  "department_budgets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    departmentId: uuid("department_id")
      .references(() => departments.id, { onDelete: "cascade" })
      .notNull(),
    totalCents: integer("total_cents").notNull(),
    remainingCents: integer("remaining_cents").notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Composite index for high-throughput budget balance queries during checkout
    index("dept_budgets_dept_period_idx").on(
      table.departmentId,
      table.periodStart,
      table.periodEnd
    ),
    index("dept_budgets_department_id_idx").on(table.departmentId),
    // Check constraints ensuring financial integrity
    check("budget_total_non_negative", sql`${table.totalCents} >= 0`),
    check("budget_remaining_non_negative", sql`${table.remainingCents} >= 0`),
    check(
      "budget_remaining_lte_total",
      sql`${table.remainingCents} <= ${table.totalCents}`
    ),
  ]
);

// =============================================================================
// 4. CATEGORIES TABLE
// =============================================================================
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    parentId: uuid("parent_id").references((): any => categories.id, {
      onDelete: "set null",
    }),
    isActive: boolean("is_active").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("categories_slug_idx").on(table.slug),
    index("categories_parent_id_idx").on(table.parentId),
    index("categories_is_active_idx").on(table.isActive),
  ]
);

// =============================================================================
// 5. PRODUCTS TABLE
// =============================================================================
export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    sku: varchar("sku", { length: 100 }),
    priceCents: integer("price_cents").notNull(),
    stockQuantity: integer("stock_quantity").default(0).notNull(),
    lowStockThreshold: integer("low_stock_threshold").default(5).notNull(),
    categoryId: uuid("category_id")
      .references(() => categories.id, { onDelete: "restrict" })
      .notNull(),
    imageUrl: text("image_url"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Composite index for fast category filtering in storefront
    index("products_category_active_idx").on(
      table.categoryId,
      table.isActive
    ),
    uniqueIndex("products_sku_idx").on(table.sku),
    index("products_is_active_idx").on(table.isActive),
    index("products_stock_quantity_idx").on(table.stockQuantity),
    // Check constraints preventing invalid catalog states
    check("product_price_non_negative", sql`${table.priceCents} >= 0`),
    check("product_stock_non_negative", sql`${table.stockQuantity} >= 0`),
    check(
      "product_low_stock_non_negative",
      sql`${table.lowStockThreshold} >= 0`
    ),
  ]
);

// =============================================================================
// 6. ORDERS TABLE
// =============================================================================
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderNumber: varchar("order_number", { length: 50 }).notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "restrict" })
      .notNull(),
    departmentId: uuid("department_id")
      .references(() => departments.id, { onDelete: "restrict" })
      .notNull(),
    totalCents: integer("total_cents").notNull(),
    status: orderStatusEnum("status").default("PENDING_APPROVAL").notNull(),
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    rejectionReason: text("rejection_reason"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("orders_order_number_idx").on(table.orderNumber),
    // Composite index for employee order list queries
    index("orders_user_created_idx").on(table.userId, table.createdAt),
    // Composite index for manager approval queue FIFO queries
    index("orders_status_created_idx").on(table.status, table.createdAt),
    // Composite index for department analytics queries
    index("orders_dept_created_idx").on(table.departmentId, table.createdAt),
    // Check constraint ensuring non-negative total
    check("order_total_non_negative", sql`${table.totalCents} >= 0`),
  ]
);

// =============================================================================
// 7. ORDER ITEMS TABLE
// =============================================================================
export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .references(() => orders.id, { onDelete: "cascade" })
      .notNull(),
    productId: uuid("product_id")
      .references(() => products.id, { onDelete: "restrict" })
      .notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    totalPriceCents: integer("total_price_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("order_items_order_id_idx").on(table.orderId),
    index("order_items_product_id_idx").on(table.productId),
    // Check constraints
    check("order_items_quantity_positive", sql`${table.quantity} > 0`),
    check(
      "order_items_unit_price_non_negative",
      sql`${table.unitPriceCents} >= 0`
    ),
    check(
      "order_items_total_price_non_negative",
      sql`${table.totalPriceCents} >= 0`
    ),
  ]
);

// =============================================================================
// 8. STORE SETTINGS TABLE (Singleton)
// =============================================================================
export const storeSettings = pgTable(
  "store_settings",
  {
    id: integer("id").primaryKey().default(1),
    autoApproveLimitCents: integer("auto_approve_limit_cents")
      .default(10000) // Default ₹100.00
      .notNull(),
    companyName: varchar("company_name", { length: 255 })
      .default("Office Store")
      .notNull(),
    primaryColor: varchar("primary_color", { length: 50 })
      .default("#0F172A")
      .notNull(),
    logoUrl: text("logo_url"),
    currency: varchar("currency", { length: 10 }).default("INR").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Singleton check constraint ensuring exactly 1 row can exist
    check("store_settings_single_row", sql`${table.id} = 1`),
    check(
      "store_settings_auto_approve_limit_non_negative",
      sql`${table.autoApproveLimitCents} >= 0`
    ),
  ]
);

// =============================================================================
// 9. AUDIT LOGS TABLE
// =============================================================================
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    adminUserId: uuid("admin_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: auditActionEnum("action").notNull(),
    entityType: entityTypeEnum("entity_type").notNull(),
    entityId: varchar("entity_id", { length: 255 }).notNull(),
    oldValue: text("old_value"), // JSON serialized string
    newValue: text("new_value"), // JSON serialized string
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_logs_admin_user_idx").on(table.adminUserId),
    // Composite index for fast entity history lookups
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
    index("audit_logs_created_at_idx").on(table.createdAt),
    index("audit_logs_action_idx").on(table.action),
  ]
);

// =============================================================================
// RELATIONS DEFINITIONS (Drizzle Type-Safe Query API)
// =============================================================================

export const departmentsRelations = relations(departments, ({ many }) => ({
  users: many(users),
  budgets: many(departmentBudgets),
  orders: many(orders),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  department: one(departments, {
    fields: [users.departmentId],
    references: [departments.id],
  }),
  orders: many(orders, { relationName: "orderAuthor" }),
  approvedOrders: many(orders, { relationName: "orderApprover" }),
  auditLogs: many(auditLogs),
  passwordResetTokens: many(passwordResetTokens),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetTokens.userId],
    references: [users.id],
  }),
}));

export const departmentBudgetsRelations = relations(
  departmentBudgets,
  ({ one }) => ({
    department: one(departments, {
      fields: [departmentBudgets.departmentId],
      references: [departments.id],
    }),
  })
);

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: "categoryHierarchy",
  }),
  children: many(categories, { relationName: "categoryHierarchy" }),
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  orderItems: many(orderItems),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
    relationName: "orderAuthor",
  }),
  approvedBy: one(users, {
    fields: [orders.approvedByUserId],
    references: [users.id],
    relationName: "orderApprover",
  }),
  department: one(departments, {
    fields: [orders.departmentId],
    references: [departments.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  adminUser: one(users, {
    fields: [auditLogs.adminUserId],
    references: [users.id],
  }),
}));

// =============================================================================
// INFERRED TYPES
// =============================================================================

export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type DepartmentBudget = typeof departmentBudgets.$inferSelect;
export type NewDepartmentBudget = typeof departmentBudgets.$inferInsert;

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;

export type StoreSettings = typeof storeSettings.$inferSelect;
export type NewStoreSettings = typeof storeSettings.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;

-- Create ENUMs
CREATE TYPE "public"."user_role" AS ENUM('EMPLOYEE', 'MANAGER', 'ADMIN');
CREATE TYPE "public"."order_status" AS ENUM('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'FULFILLED', 'CANCELLED');
CREATE TYPE "public"."audit_action" AS ENUM('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'STOCK_ADJUST', 'CONFIG_UPDATE');
CREATE TYPE "public"."entity_type" AS ENUM('PRODUCT', 'CATEGORY', 'ORDER', 'STORE_SETTINGS', 'DEPARTMENT_BUDGET', 'USER', 'DEPARTMENT');

-- Create DEPARTMENTS table
CREATE TABLE IF NOT EXISTS "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create USERS table
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_id" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"role" "user_role" DEFAULT 'EMPLOYEE' NOT NULL,
	"department_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE set null ON UPDATE no action
);

-- Create DEPARTMENT_BUDGETS table
CREATE TABLE IF NOT EXISTS "department_budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"department_id" uuid NOT NULL,
	"total_cents" integer NOT NULL,
	"remaining_cents" integer NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "department_budgets_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "budget_total_non_negative" CHECK ("department_budgets"."total_cents" >= 0),
	CONSTRAINT "budget_remaining_non_negative" CHECK ("department_budgets"."remaining_cents" >= 0),
	CONSTRAINT "budget_remaining_lte_total" CHECK ("department_budgets"."remaining_cents" <= "department_budgets"."total_cents")
);

-- Create CATEGORIES table
CREATE TABLE IF NOT EXISTS "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"parent_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE set null ON UPDATE no action
);

-- Create PRODUCTS table
CREATE TABLE IF NOT EXISTS "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"sku" varchar(100),
	"price_cents" integer NOT NULL,
	"stock_quantity" integer DEFAULT 0 NOT NULL,
	"low_stock_threshold" integer DEFAULT 5 NOT NULL,
	"category_id" uuid NOT NULL,
	"image_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "product_price_non_negative" CHECK ("products"."price_cents" >= 0),
	CONSTRAINT "product_stock_non_negative" CHECK ("products"."stock_quantity" >= 0),
	CONSTRAINT "product_low_stock_non_negative" CHECK ("products"."low_stock_threshold" >= 0)
);

-- Create ORDERS table
CREATE TABLE IF NOT EXISTS "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" varchar(50) NOT NULL,
	"user_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"total_cents" integer NOT NULL,
	"status" "order_status" DEFAULT 'PENDING_APPROVAL' NOT NULL,
	"approved_by_user_id" uuid,
	"rejection_reason" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "orders_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "orders_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "order_total_non_negative" CHECK ("orders"."total_cents" >= 0)
);

-- Create ORDER_ITEMS table
CREATE TABLE IF NOT EXISTS "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"total_price_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "order_items_quantity_positive" CHECK ("order_items"."quantity" > 0),
	CONSTRAINT "order_items_unit_price_non_negative" CHECK ("order_items"."unit_price_cents" >= 0),
	CONSTRAINT "order_items_total_price_non_negative" CHECK ("order_items"."total_price_cents" >= 0)
);

-- Create STORE_SETTINGS table
CREATE TABLE IF NOT EXISTS "store_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"auto_approve_limit_cents" integer DEFAULT 10000 NOT NULL,
	"company_name" varchar(255) DEFAULT 'Office Store' NOT NULL,
	"primary_color" varchar(50) DEFAULT '#0F172A' NOT NULL,
	"logo_url" text,
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_settings_single_row" CHECK ("store_settings"."id" = 1),
	CONSTRAINT "store_settings_auto_approve_limit_non_negative" CHECK ("store_settings"."auto_approve_limit_cents" >= 0)
);

-- Create AUDIT_LOGS table
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" uuid,
	"action" "audit_action" NOT NULL,
	"entity_type" "entity_type" NOT NULL,
	"entity_id" varchar(255) NOT NULL,
	"old_value" text,
	"new_value" text,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_logs_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action
);

-- Indexes and Unique Constraints
CREATE UNIQUE INDEX IF NOT EXISTS "departments_name_idx" ON "departments" ("name");
CREATE UNIQUE INDEX IF NOT EXISTS "departments_code_idx" ON "departments" ("code");
CREATE UNIQUE INDEX IF NOT EXISTS "users_clerk_id_idx" ON "users" ("clerk_id");
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email");
CREATE INDEX IF NOT EXISTS "users_department_id_idx" ON "users" ("department_id");
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users" ("role");
CREATE INDEX IF NOT EXISTS "dept_budgets_dept_period_idx" ON "department_budgets" ("department_id", "period_start", "period_end");
CREATE INDEX IF NOT EXISTS "dept_budgets_department_id_idx" ON "department_budgets" ("department_id");
CREATE UNIQUE INDEX IF NOT EXISTS "categories_slug_idx" ON "categories" ("slug");
CREATE INDEX IF NOT EXISTS "categories_parent_id_idx" ON "categories" ("parent_id");
CREATE INDEX IF NOT EXISTS "categories_is_active_idx" ON "categories" ("is_active");
CREATE INDEX IF NOT EXISTS "products_category_active_idx" ON "products" ("category_id", "is_active");
CREATE UNIQUE INDEX IF NOT EXISTS "products_sku_idx" ON "products" ("sku");
CREATE INDEX IF NOT EXISTS "products_is_active_idx" ON "products" ("is_active");
CREATE INDEX IF NOT EXISTS "products_stock_quantity_idx" ON "products" ("stock_quantity");
CREATE UNIQUE INDEX IF NOT EXISTS "orders_order_number_idx" ON "orders" ("order_number");
CREATE INDEX IF NOT EXISTS "orders_user_created_idx" ON "orders" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "orders_status_created_idx" ON "orders" ("status", "created_at");
CREATE INDEX IF NOT EXISTS "orders_dept_created_idx" ON "orders" ("department_id", "created_at");
CREATE INDEX IF NOT EXISTS "order_items_order_id_idx" ON "order_items" ("order_id");
CREATE INDEX IF NOT EXISTS "order_items_product_id_idx" ON "order_items" ("product_id");
CREATE INDEX IF NOT EXISTS "audit_logs_admin_user_idx" ON "audit_logs" ("admin_user_id");
CREATE INDEX IF NOT EXISTS "audit_logs_entity_idx" ON "audit_logs" ("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs" ("created_at");
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs" ("action");

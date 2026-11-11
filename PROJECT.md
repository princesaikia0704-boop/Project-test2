# Project: Cloud-Native Corporate Office Store Management System

## Architecture
- **Framework**: Next.js 15 (App Router, TypeScript, React 19)
- **Database & ORM**: Neon Serverless Postgres (with PgBouncer connection pooling) + Drizzle ORM
- **Cache & Distributed Locks**: Upstash Redis (Idempotency mutex `SET NX EX 30`, rate limiting)
- **Asynchronous Queue**: Upstash QStash (HMAC signature verified background workers)
- **Storage**: Cloudflare R2 (S3-compatible, pre-signed upload & download URLs)
- **Auth & RBAC**: Clerk Edge JWT Auth with role-based routing (`EMPLOYEE`, `MANAGER`, `ADMIN`)
- **Notifications**: Resend Email API
- **UI Engine**: Tailwind CSS + shadcn/ui + TanStack Query (Optimistic UI)
- **Resilience**: Zero-crash mock/placeholder key architecture with in-memory adapters for dev/test

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Serverless DB Connection Pooling | Neon HTTP driver (`fetchConnectionCache: true`) + WebSocket Pool singleton | M1 | Survey 1 |
| 2 | PostgreSQL Drizzle ORM Schema | Complete 9 tables (`users`, `departments`, `department_budgets`, `categories`, `products`, `orders`, `order_items`, `store_settings`, `audit_logs`), enums, relations, check constraints, composite indexes | M1 | Survey 1 |
| 3 | DevContainer & Environment Blueprint | DevContainer (Node 22 LTS), `.env.example`, `package.json`, Next.js 15 configs | M1 | Survey 3 |
| 4 | Mock/Placeholder Resiliency Framework | Transparent fallback adapters for Clerk, Neon, Upstash, R2, and Resend | M1 | Survey 3 |
| 5 | Redis Distributed Cache & Idempotency Store | Upstash Redis client with atomic idempotency locks and cached payload replay | M2 | Survey 1 |
| 6 | Upstash QStash Queue Client & Receiver | HMAC signature verification receiver and background job publisher | M2 | Survey 1 |
| 7 | Global API Timeout & Idempotency Wrapper | `withApiReliability()` higher-order wrapper with 8s AbortController timeout & Redis mutex | M2 | Survey 1 |
| 8 | ACID Order & Stock Transactions | Concurrency-safe transactions with sorted product ID locks (`ORDER BY id ASC FOR UPDATE`) and session timeouts (`lock_timeout = 2s`, `statement_timeout = 5s`) | M2 | Survey 1 |
| 9 | Budget Enforcement & Atomic Deduction | Department budget verification and atomic balance encumbrance within ACID checkout | M2 | Survey 1 |
| 10 | Data Repositories Layer | `product.repo.ts`, `order.repo.ts`, `budget.repo.ts`, `config.repo.ts` | M2 | Survey 1 |
| 11 | Domain Services Layer | `order.service.ts`, `inventory.service.ts`, `store-config.service.ts`, `storage.service.ts` | M2 | Survey 1 |
| 12 | Cloudflare R2 / S3 Presigned URL Service | Secure presigned PUT/GET URL generator for product images & CSV imports | M2 | Survey 2 |
| 13 | Edge Middleware Auth & RBAC Guard | Clerk JWT validation and role-based route guard (`EMPLOYEE`, `MANAGER`, `ADMIN`) | M3 | Survey 2 |
| 14 | Edge Rate Limiting Guard | Upstash REST sliding window rate limiting (<5ms target) with fail-open fallback | M3 | Survey 2 |
| 15 | Storefront Catalog Browsing & Filter | Debounced search (300ms), category tree filter, stock status chips | M3 | Survey 2 |
| 16 | Budget-Aware Cart & Budget Meter | Dynamic 3-zone color-coded budget meter (<70% green, 70-90% amber, >90% red) and cart drawer | M3 | Survey 2 |
| 17 | Idempotent Order Checkout Submission | Checkout API route (`POST /api/orders`) with idempotency header & ACID execution | M3 | Survey 2 |
| 18 | Employee Order Tracking Portal | Order list view with status chips (`PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `FULFILLED`, `CANCELLED`) and cancellation action | M3 | Survey 2 |
| 19 | Dynamic Auto-Approval Rule Engine | Auto-approval evaluation against dynamic threshold ($100 default) in `store_settings` | M4 | Survey 2 |
| 20 | Manager Order Approval Queue Portal | Approval portal (`/admin/approvals`) with approve and reject workflows & budget/stock rollback | M4 | Survey 2 |
| 21 | Executive KPI Dashboard | KPI cards (Spend MTD, Pending Approvals, Total Volume, Stock Alerts) and department charts | M4 | Survey 2 |
| 22 | Dynamic Catalog Management | Category hierarchy editor and full Product CRUD with image presigned URLs | M4 | Survey 2 |
| 23 | Dynamic Stock Editor Modal | Interactive stock level updater with real-time audit logging | M4 | Survey 2 |
| 24 | Dynamic Store Settings & Budgets | Store rules editor, auto-approval threshold config, department budgets, and branding config | M4 | Survey 2 |
| 25 | Immutable Audit Logs Viewer | Chronological modification history with visual diffs (old vs. new values) | M4 | Survey 2 |
| 26 | Bulk CSV Inventory Import Worker | Background QStash worker streaming CSV in 200-row batches with Zod validation | M5 | Survey 2 |
| 27 | Asynchronous Email Notifications | Background worker dispatching Resend emails for order status changes | M5 | Survey 2 |
| 28 | Asynchronous Audit Log Worker | Background worker writing immutable audit entries to database | M5 | Survey 2 |
| 29 | Opaque-Box E2E Test Suite (Tiers 1-4) | Comprehensive independent test suite covering all features, boundaries, and scenarios | M6 | Blueprint |
| 30 | Adversarial Coverage Hardening (Tier 5) | White-box stress testing and adversarial gap verification via Challenger loop | M6 | Blueprint |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Testing Track | Independent opaque-box test runner & Tiers 1-4 test suites | none | PLANNED |
| 1 | Foundation & Core Schema | DevContainer, configs, Drizzle ORM schema (9 tables, enums, indexes), DB pool singleton, mock store | none | PLANNED |
| 2 | Core Libs, Reliability Engine & Services | Redis cache, QStash client, `withApiReliability`, ACID order/stock transaction logic, Repositories & Services | M1 | PLANNED |
| 3 | Storefront & Budget Management | Edge middleware, RBAC, storefront components (BudgetMeter, CartDrawer), pages (catalog, cart, orders), checkout API | M1, M2 | PLANNED |
| 4 | Admin Portal & Approval Engine | Manager approvals queue API & UI, KPI dashboard, product/category catalog, stock editor, store settings, audit logs UI | M1, M2 | PLANNED |
| 5 | Background Workers & Integrations | CSV import worker (200-row batching), notification worker (Resend), audit-log worker | M1, M2 | PLANNED |
| 6 | Final E2E Pass & Adversarial Hardening | Phase 1: 100% E2E test pass (Tiers 1-4); Phase 2: Tier 5 adversarial coverage hardening | M1, M2, M3, M4, M5, E2E | PLANNED |

## Interface Contracts

### Database Singleton (`src/lib/db/index.ts`)
```typescript
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export const db: NeonHttpDatabase<typeof schema>;
export const txDb: NodePgDatabase<typeof schema>;
```

### API Reliability Wrapper (`src/lib/http/api-handler.ts`)
```typescript
import { NextRequest, NextResponse } from 'next/server';

export interface ApiHandlerOptions {
  timeoutMs?: number;        // default: 8000
  requireIdempotency?: boolean; // default: false
  allowedRoles?: ('EMPLOYEE' | 'MANAGER' | 'ADMIN')[];
}

export function withApiReliability(
  handler: (req: NextRequest, context?: any) => Promise<NextResponse>,
  options?: ApiHandlerOptions
): (req: NextRequest, context?: any) => Promise<NextResponse>;
```

### Order Service (`src/services/order.service.ts`)
```typescript
export interface CreateOrderInput {
  userId: string;
  departmentId: string;
  items: { productId: string; quantity: number }[];
  idempotencyKey?: string;
}

export interface CreateOrderResult {
  orderId: string;
  status: 'PENDING_APPROVAL' | 'APPROVED';
  totalCents: number;
  remainingBudgetCents: number;
}

export function createOrderWithACID(input: CreateOrderInput): Promise<CreateOrderResult>;
export function approveOrder(orderId: string, managerUserId: string): Promise<void>;
export function rejectOrder(orderId: string, managerUserId: string, reason?: string): Promise<void>;
export function cancelOrder(orderId: string, userId: string): Promise<void>;
```

### Storefront & Admin Component Interfaces
- `BudgetMeter`: Props `{ totalCents: number; remainingCents: number; cartTotalCents: number }`
- `ProductCard`: Props `{ product: Product; onAddToCart: (product: Product, quantity: number) => void }`
- `CartDrawer`: Props `{ isOpen: boolean; onClose: () => void }`
- `StockEditorModal`: Props `{ product: Product; isOpen: boolean; onClose: () => void; onStockUpdated: (newStock: number) => void }`
- `CsvUploader`: Props `{ onUploadComplete: (jobId: string) => void }`

## Code Layout
```
corporate-office-store/
├── .devcontainer/
│   └── devcontainer.json
├── drizzle/
│   └── migrations/
├── src/
│   ├── middleware.ts
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/page.tsx
│   │   ├── (storefront)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── cart/page.tsx
│   │   │   └── orders/page.tsx
│   │   ├── (admin)/
│   │   │   └── admin/
│   │   │       ├── layout.tsx
│   │   │       ├── page.tsx
│   │   │       ├── catalog/page.tsx
│   │   │       ├── approvals/page.tsx
│   │   │       ├── settings/page.tsx
│   │   │       └── audit-logs/page.tsx
│   │   └── api/
│   │       ├── orders/
│   │       │   ├── route.ts
│   │       │   └── [orderId]/approve/route.ts
│   │       ├── admin/
│   │       │   ├── products/route.ts
│   │       │   ├── categories/route.ts
│   │       │   ├── store-config/route.ts
│   │       │   └── uploads/presign/route.ts
│   │       └── workers/
│   │           ├── csv-import/route.ts
│   │           ├── notifications/route.ts
│   │           └── audit-log/route.ts
│   ├── services/
│   │   ├── order.service.ts
│   │   ├── inventory.service.ts
│   │   ├── store-config.service.ts
│   │   └── storage.service.ts
│   ├── repositories/
│   │   ├── product.repo.ts
│   │   ├── order.repo.ts
│   │   ├── budget.repo.ts
│   │   └── config.repo.ts
│   ├── lib/
│   │   ├── db/
│   │   │   ├── index.ts
│   │   │   └── schema.ts
│   │   ├── http/
│   │   │   ├── api-handler.ts
│   │   │   └── fetch-with-timeout.ts
│   │   ├── cache/
│   │   │   └── redis.ts
│   │   ├── queue/
│   │   │   └── qstash.ts
│   │   └── validators/
│   │       ├── order.schema.ts
│   │       ├── product.schema.ts
│   │       └── store-config.schema.ts
│   └── components/
│       ├── storefront/
│       │   ├── ProductCard.tsx
│       │   ├── BudgetMeter.tsx
│       │   └── CartDrawer.tsx
│       └── admin/
│           ├── DynamicRuleBuilder.tsx
│           ├── StockEditorModal.tsx
│           └── CsvUploader.tsx
├── drizzle.config.ts
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── components.json
├── package.json
└── .env.example
```

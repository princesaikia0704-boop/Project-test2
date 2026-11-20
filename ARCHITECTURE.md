# 🏛️ Architecture & Engineering Standards

Corporate Office Store Management System — Next.js 15 App Router & Full-Stack Clean Architecture.

---

## 1. High-Level System Architecture

The application is structured into strict unidirectional layers:

```
┌────────────────────────────────────────────────────────┐
│                      Client Layer                      │
│   src/app/ (Pages, Layouts, Loading & Error Boundaries) │
│   src/components/ (Storefront, Admin, Shared & UI)     │
│   src/hooks/ (Client Data & Workflow Abstractions)     │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTP / Fetch (SLA Timeout)
┌──────────────────────────▼─────────────────────────────┐
│                   Route Handler Layer                   │
│   src/app/api/ (withApiReliability(), Zod Validation,   │
│                 RBAC Guards & Idempotency Keys)        │
└──────────────────────────┬─────────────────────────────┘
                           │ Direct Function Invocations
┌──────────────────────────▼─────────────────────────────┐
│                      Service Layer                     │
│   src/services/ (Pure Business Logic, ACID Workflows,  │
│                  Domain Validation, Error Handling)    │
└──────────────────────────┬─────────────────────────────┘
                           │ Repository Invocations
┌──────────────────────────▼─────────────────────────────┐
│                    Repository Layer                    │
│   src/repositories/ (Isolated Database Queries, Drizzle │
│                      ORM & In-Memory Mock Store)       │
└──────────────────────────┬─────────────────────────────┘
                           │ Data Access
┌──────────────────────────▼─────────────────────────────┐
│                     Database / State                    │
│   src/lib/db (Neon PostgreSQL / Mock In-Memory Store)  │
│   src/lib/cache (Upstash Redis Idempotency / Cache)    │
└────────────────────────────────────────────────────────┘
```

---

## 2. Unidirectional Import Rules

To prevent circular dependencies and spaghetti coupling, the following import hierarchy is strictly enforced:

1. **`src/app/api/**`** → May import `src/services/`, `src/lib/`, `src/types/`. (Thin controllers only).
2. **`src/services/**`** → May import `src/repositories/`, `src/lib/`, `src/types/`. (Orchestration & rules).
3. **`src/repositories/**`** → May import `src/lib/db/`, `src/lib/mock/`, `src/types/`. (Data access only).
4. **`src/components/**`** → May import `src/hooks/`, `src/components/ui/`, `src/lib/utils`, `src/types/`. UI components **never** perform direct database queries or raw `fetch()` calls.
5. **`src/hooks/**`** → Client workflows, API communication, and state hooks.
6. **`src/types/**`** → Shared contracts, DTOs, interfaces. No downstream dependencies.

---

## 3. Directory Layout & Responsibilities

| Directory | Layer Responsibility |
|---|---|
| `src/app/` | Next.js App Router route segments, layouts, error boundaries (`error.tsx`, `global-error.tsx`), route loading skeletons (`loading.tsx`), and REST API route handlers. |
| `src/components/ui/` | Primitive, composable, theme-adaptive UI widgets (`StatusBadge`, `EmptyState`, `Pagination`, `ConfirmModal`, `LoadingSkeleton`). |
| `src/components/storefront/` | Storefront domain UI: `ProductCard`, `CartDrawer`, `StorefrontNavbar`, `BudgetMeter`. |
| `src/components/admin/` | Admin domain UI: `CsvUploader`, `DynamicRuleBuilder`, `StockEditorModal`. |
| `src/components/shared/` | Shared domain components (`PersonaSwitcher`). |
| `src/services/` | Core transactional logic (`order.service.ts`, `inventory.service.ts`, `store-config.service.ts`, `storage.service.ts`). |
| `src/repositories/` | Data access abstraction for Neon PostgreSQL and in-memory mock engine. |
| `src/hooks/` | Custom React hooks (`useCheckout`, `useBranding`, `useCsvUpload`, `useImageUpload`). |
| `src/lib/` | Cross-cutting infrastructure: `errors.ts` (custom error classes), `utils.ts` (formatting, currencies, normalization), `http/api-handler.ts` (SLA & reliability wrapper), `cache/redis.ts`, `db/`. |
| `src/types/` | Shared TypeScript interfaces, DTOs, and API responses. |

---

## 4. Error Handling Standards

### Frontend
- Every major route group has an associated `loading.tsx` skeleton and `error.tsx` boundary.
- Catastrophic root layout failures are caught by `src/app/global-error.tsx`.
- User interactions report errors through clear visual inline banners or modal dialogues rather than crashing or freezing.

### Backend & API Handlers
- All API routes are wrapped in `withApiReliability()`.
- Domain exceptions inherit from `AppError` in `src/lib/errors.ts` (`ValidationError`, `UnauthorizedError`, `NotFoundError`, `InsufficientStockError`, `BudgetExceededError`, `TimeoutError`).
- Handlers sanitize outputs against secret leaking (redacting DB strings, auth tokens) and return structured JSON:
  ```json
  {
    "error": "InsufficientStockError",
    "message": "Insufficient stock for product 'p1': requested 5, available 2",
    "statusCode": 409
  }
  ```

---

## 5. Security & RBAC Guards

- **Edge Middleware (`src/middleware.ts`)**: Evaluates rate-limiting sliding windows (100 req/min fail-open), resolves session personas (`EMPLOYEE`, `MANAGER`, `ADMIN`), and enforces route-level access.
- **Storefront Branding Route**: `/api/admin/store-config` allows `GET` operations across all roles so company name, logo, and theme variables can hydrate dynamic navigation bars.
- **Database Safety**: Dual-mode execution supports local mock stores (`MOCK_DATABASE="true"`) for zero-dependency development and Neon Serverless PostgreSQL with Drizzle ORM for cloud production.

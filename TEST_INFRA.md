# TEST_INFRA.md: E2E Test Suite Infrastructure & Architecture Specification

**Project:** Cloud-Native Corporate Office Store Management System  
**Document Version:** 1.0.0  
**Status:** Approved & Authoritative  
**Milestone:** E2E Testing Track  

---

## 1. Test Philosophy & Principles

The E2E Test Suite for the Cloud-Native Corporate Office Store Management System is engineered according to **Dual Track** principles, guaranteeing decoupled, requirement-driven, and high-fidelity testing:

1. **Opaque-Box Verification**:
   - The test suite treats the application as an opaque black box. All interactions occur exclusively across external public boundaries: HTTP REST endpoints (`/api/*`), Edge Middleware request/response headers (`Authorization`, `Idempotency-Key`, `X-RateLimit-*`, `Upstash-Signature`), and verifiable database state invariants.
   - Zero tests rely on internal private helper functions, non-exported variables, or framework-specific internals. Refactoring implementation code leaves tests completely undisturbed as long as interface contracts are preserved.

2. **Requirement-Driven Expected Outputs**:
   - Every single test case derives its inputs and expected outputs directly from authoritative specification sources: `ORIGINAL_REQUEST.md`, `PROJECT.md`, and survey reports (`SPEC-SURVEY-PHASE-1`, `SPEC-SURVEY-PHASE-2`).
   - Expected status codes (e.g., `200 OK`, `201 Created`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `409 Conflict`, `422 Unprocessable Entity`, `429 Too Many Requests`, `504 Gateway Timeout`) and response envelopes (`{ success, data, error }`) are explicitly asserted against canonical business rules.

3. **Zero Internal Coupling & Independent Execution**:
   - Tests do not require in-tree build artifacts to run. The test suite operates via a standalone TypeScript/Node test runner (`tests/e2e/runner.ts`) capable of executing against:
     a. A live Next.js HTTP server (`API_BASE_URL=http://localhost:3000`).
     b. An in-process protocol simulator (`MockHttpDriver`) providing high-fidelity contract simulation for offline, pre-deployment, and greenfield CI validation.
   - Each test is completely isolated and self-contained: it initializes its test fixtures, executes actions, asserts outcomes, and guarantees zero side-effect leakage to sibling tests.

4. **Progressive Testability & Tiered Defense**:
   - The suite is organized into 4 distinct verification tiers:
     - **Tier 1: Feature Coverage**: Exhaustive baseline coverage for each of the 30 features (>= 5 test cases per feature, >= 150 test cases total).
     - **Tier 2: Boundary & Corner Cases**: Strict validation of system limits, negative values, race conditions, timeouts, corrupted inputs, and unauthorized actions (>= 5 test cases per feature, >= 150 test cases total).
     - **Tier 3: Cross-Feature Combinations**: Pairwise and cascading interactions across architectural subsystems (cart + budget deduction, auto-approval thresholds + manager routing, rejection + stock refund, CSV import + stock alert).
     - **Tier 4: Real-World Scenarios**: Complete end-to-end multi-persona workflows mimicking authentic corporate supply operations.

---

## 2. Test Architecture & Directory Layout

### 2.1 Directory Tree
```
tests/
└── e2e/
    ├── runner.ts                     # Standalone CLI test engine (runner, runner filters, reporter)
    ├── test-client.ts                # Opaque HTTP client with persona auth & idempotency injection
    ├── types.ts                      # Common test types, assertions, and reporter data structures
    ├── mock-driver.ts                # In-memory protocol simulator matching full HTTP/DB contracts
    ├── run-tests.ps1                 # Windows PowerShell execution harness bridge
    ├── tier1-features/               # Tier 1: 30 Feature Coverage Suites (>= 5 tests each -> 150 tests)
    │   ├── feat-01-pooling.test.ts
    │   ├── feat-02-schema.test.ts
    │   ├── feat-03-devcontainer.test.ts
    │   ├── feat-04-mock-resiliency.test.ts
    │   ├── feat-05-redis-cache.test.ts
    │   ├── feat-06-qstash-queue.test.ts
    │   ├── feat-07-api-reliability.test.ts
    │   ├── feat-08-acid-transactions.test.ts
    │   ├── feat-09-budget-enforcement.test.ts
    │   ├── feat-10-repositories.test.ts
    │   ├── feat-11-domain-services.test.ts
    │   ├── feat-12-s3-presigned.test.ts
    │   ├── feat-13-edge-auth-rbac.test.ts
    │   ├── feat-14-rate-limiting.test.ts
    │   ├── feat-15-catalog-browsing.test.ts
    │   ├── feat-16-cart-budget-meter.test.ts
    │   ├── feat-17-idempotent-checkout.test.ts
    │   ├── feat-18-order-tracking.test.ts
    │   ├── feat-19-auto-approval.test.ts
    │   ├── feat-20-manager-approvals.test.ts
    │   ├── feat-21-kpi-dashboard.test.ts
    │   ├── feat-22-catalog-management.test.ts
    │   ├── feat-23-stock-editor.test.ts
    │   ├── feat-24-store-settings.test.ts
    │   ├── feat-25-audit-logs.test.ts
    │   ├── feat-26-csv-import.test.ts
    │   ├── feat-27-email-notifications.test.ts
    │   ├── feat-28-audit-worker.test.ts
    │   ├── feat-29-e2e-test-suite.test.ts
    │   └── feat-30-adversarial-hardening.test.ts
    ├── tier2-boundaries/             # Tier 2: 30 Boundary & Corner Suites (>= 5 tests each -> 150 tests)
    │   ├── bnd-01-pooling.test.ts
    │   ├── bnd-02-schema.test.ts
    │   ├── bnd-03-devcontainer.test.ts
    │   ├── bnd-04-mock-resiliency.test.ts
    │   ├── bnd-05-redis-cache.test.ts
    │   ├── bnd-06-qstash-queue.test.ts
    │   ├── bnd-07-api-reliability.test.ts
    │   ├── bnd-08-acid-transactions.test.ts
    │   ├── bnd-09-budget-enforcement.test.ts
    │   ├── bnd-10-repositories.test.ts
    │   ├── bnd-11-domain-services.test.ts
    │   ├── bnd-12-s3-presigned.test.ts
    │   ├── bnd-13-edge-auth-rbac.test.ts
    │   ├── bnd-14-rate-limiting.test.ts
    │   ├── bnd-15-catalog-browsing.test.ts
    │   ├── bnd-16-cart-budget-meter.test.ts
    │   ├── bnd-17-idempotent-checkout.test.ts
    │   ├── bnd-18-order-tracking.test.ts
    │   ├── bnd-19-auto-approval.test.ts
    │   ├── bnd-20-manager-approvals.test.ts
    │   ├── bnd-21-kpi-dashboard.test.ts
    │   ├── bnd-22-catalog-management.test.ts
    │   ├── bnd-23-stock-editor.test.ts
    │   ├── bnd-24-store-settings.test.ts
    │   ├── bnd-25-audit-logs.test.ts
    │   ├── bnd-26-csv-import.test.ts
    │   ├── bnd-27-email-notifications.test.ts
    │   ├── bnd-28-audit-worker.test.ts
    │   ├── bnd-29-e2e-test-suite.test.ts
    │   └── bnd-30-adversarial-hardening.test.ts
    ├── tier3-combinations/           # Tier 3: Pairwise Cross-Feature Suites (10 suites -> 30 tests)
    │   ├── comb-01-cart-budget-checkout.test.ts
    │   ├── comb-02-approval-threshold-routing.test.ts
    │   ├── comb-03-rejection-stock-budget-refund.test.ts
    │   ├── comb-04-csv-import-stock-alert.test.ts
    │   ├── comb-05-idempotency-concurrent-double-submit.test.ts
    │   ├── comb-06-rbac-manager-vs-employee-escalation.test.ts
    │   ├── comb-07-stock-depletion-to-cart-validation.test.ts
    │   ├── comb-08-audit-logging-pipeline-on-admin-mutations.test.ts
    │   ├── comb-09-dynamic-branding-color-propagation.test.ts
    │   └── comb-10-rate-limit-and-timeout-cascading.test.ts
    └── tier4-scenarios/              # Tier 4: Real-World Multi-Persona Scenarios (5 suites -> 15 tests)
        ├── scen-01-onboarding-to-first-order.test.ts
        ├── scen-02-manager-high-value-approval-workflow.test.ts
        ├── scen-03-admin-bulk-restock-and-catalog-expansion.test.ts
        ├── scen-04-fiscal-year-end-budget-exhaustion.test.ts
        └── scen-05-incident-recovery-and-audit-investigation.test.ts
```

### 2.2 Test Client & Persona Abstraction
The opaque test client (`test-client.ts`) provides pre-configured client personas matching corporate roles:
- **`employeeClient`**: Authenticated with standard `EMPLOYEE` JWT token, tied to Department "Engineering" (`dept-eng`).
- **`managerClient`**: Authenticated with `MANAGER` JWT token for Department "Engineering", with approval permissions.
- **`adminClient`**: Authenticated with `ADMIN` JWT token, endowed with global catalog, store configuration, and audit log access.
- **`unauthenticatedClient`**: Raw HTTP client with no session tokens to verify edge 307 redirects and 401 Unauthorized responses.
- **`externalWorkerClient`**: Client configured with valid HMAC-SHA256 QStash signatures for background worker endpoints.

---

## 3. Complete Feature Mapping: All 30 Features Across Tiers 1-3

| # | Feature Code & Name | Primary Target / Route | Tier 1: Feature Coverage (>=5 Tests) | Tier 2: Boundary & Corner Cases (>=5 Tests) | Tier 3: Cross-Feature Interactions |
|---|---------------------|------------------------|---------------------------------------|----------------------------------------------|-------------------------------------|
| 1 | `F01`: Serverless DB Connection Pooling | `/api/health`, DB pool singleton | T1.1: Single query pool acquisition<br>T1.2: Concurrent query reuse<br>T1.3: HTTP connection cache flag validation<br>T1.4: WebSocket pool checkout<br>T1.5: Connection release on commit | T2.1: Pool exhaustion backpressure<br>T2.2: Neon cold-start connection latency<br>T2.3: Reconnect on dropped socket<br>T2.4: Idle connection eviction<br>T2.5: Zero leaked connections under error | COMB-10: Connection pool resilience under API timeout cascade |
| 2 | `F02`: PostgreSQL Drizzle ORM Schema | DB Tables & Constraints | T1.1: Verify `users` table schema & FKs<br>T1.2: Verify `products` check constraint (`stock >= 0`)<br>T1.3: Verify `department_budgets` check (`remaining >= 0`)<br>T1.4: Verify `order_items` composite index<br>T1.5: Verify `audit_logs` immutable schema | T2.1: Rejection of negative price cents<br>T2.2: Rejection of circular category parent_id<br>T2.3: Cascade delete isolation (audit log `ON DELETE SET NULL`)<br>T2.4: Category deletion blocked when products exist (`RESTRICT`)<br>T2.5: Enum violation on invalid order status | COMB-08: Schema check constraint enforcement during admin budget mutations |
| 3 | `F03`: DevContainer & Environment Blueprint | `.devcontainer/devcontainer.json`, `.env.example` | T1.1: Node 22 LTS container base image check<br>T1.2: Required VS Code extensions present<br>T1.3: `.env.example` placeholder keys complete<br>T1.4: `package.json` engines specify Node >=20<br>T1.5: Port forwarding 3000 configured | T2.1: Missing env variable fallback detection<br>T2.2: DevContainer root vs non-root user permissions<br>T2.3: Malformed `.env` line parsing resilience<br>T2.4: Empty string vs undefined env values<br>T2.5: Platform line ending CRLF vs LF invariance | COMB-09: Environment variable override of default auto-approval limit |
| 4 | `F04`: Mock/Placeholder Resiliency Framework | Mock Service Layer (`src/lib/mock/*`) | T1.1: Clerk mock auth token generation<br>T1.2: In-memory Postgres table seeding<br>T1.3: In-memory Redis cache read/write<br>T1.4: Cloudflare R2 mock presigned URL<br>T1.5: Resend email mock logger dispatch | T2.1: Rapid switching between mock and real mode<br>T2.2: Mock DB reset across test runs<br>T2.3: Mock Redis TTL expiration simulation<br>T2.4: Malformed mock token rejection<br>T2.5: Zero network calls made when mock mode active | COMB-06: Mock authentication role assertion in RBAC middleware |
| 5 | `F05`: Redis Distributed Cache & Idempotency Store | Upstash Redis Adapter | T1.1: `SET NX EX` atomic lock acquisition<br>T1.2: Mutex lock release on completion<br>T1.3: Cached response storage with 30s TTL<br>T1.4: Fast cache hit retrieval (<10ms)<br>T1.5: Cache key namespace isolation | T2.1: Lock collision returns 409 Conflict<br>T2.2: Lock TTL auto-expiry prevents deadlock<br>T2.3: Redis connection failure fail-open behavior<br>T2.4: Concurrent identical key lock competition<br>T2.5: Delete key on unhandled transaction crash | COMB-05: Double-click checkout submission idempotency mutex |
| 6 | `F06`: Upstash QStash Queue Client & Receiver | `POST /api/workers/*` | T1.1: Message enqueue via QStash client<br>T1.2: Valid HMAC-SHA256 signature verification<br>T1.3: Payload deserialization in worker<br>T1.4: HTTP 202 Accepted response on publish<br>T1.5: Immediate worker dispatch for async jobs | T2.1: Invalid HMAC signature returns 401 Unauthorized<br>T2.2: Missing signature header returns 401<br>T2.3: Expired signature timestamp returns 401<br>T2.4: Malformed worker body returns 400 Bad Request<br>T2.5: Worker retry on transient 500 error | COMB-04: QStash worker execution for CSV batch processing |
| 7 | `F07`: Global API Timeout & Idempotency Wrapper | `withApiReliability()` wrapper | T1.1: Successful route execution wrapped cleanly<br>T1.2: Standard JSON error envelope formatting<br>T1.3: AbortController instantiation with 8s timer<br>T1.4: Role authorization check in wrapper<br>T1.5: Pass-through of valid headers and status | T2.1: 8001ms execution triggers 504 Gateway Timeout<br>T2.2: Aborted upstream queries on client disconnect<br>T2.3: Handling of non-Error thrown primitives<br>T2.4: Sanitization of internal stack traces in prod<br>T2.5: Lock cleanup verified after timeout abort | COMB-10: Rate limiting and timeout cascading on high concurrency |
| 8 | `F08`: ACID Order & Stock Transactions | `POST /api/orders`, order service | T1.1: Ascending product ID lock acquisition (`ORDER BY id ASC FOR UPDATE`)<br>T1.2: Atomic stock decrement on order submission<br>T1.3: Stock verification prior to deduction<br>T1.4: Commit writes both order and item rows<br>T1.5: Transaction session timeouts set (`lock_timeout=2s`) | T2.1: Reverse order ID submission deadlock immunity<br>T2.2: Zero-stock product checkout returns 422<br>T2.3: Partial stock shortage rolls back all items<br>T2.4: Database lock timeout triggers 503 Retry-After<br>T2.5: Concurrent purchase of last single unit isolates winner | COMB-07: Depletion of stock updates cart availability status |
| 9 | `F09`: Budget Enforcement & Atomic Deduction | `POST /api/orders`, budget repo | T1.1: Department budget row locked `FOR UPDATE`<br>T1.2: Atomic balance decrement (`remaining - total`)<br>T1.3: Order allowed when total < remaining<br>T1.4: Order allowed when total == remaining<br>T1.5: Updated remaining balance reflected immediately | T2.1: Order exceeding remaining budget returns 400/422<br>T2.2: Negative order total rejected in validation<br>T2.3: Zero remaining budget blocks checkout<br>T2.4: Expired budget fiscal period blocks order<br>T2.5: Concurrent budget contention isolates valid orders | COMB-01: Real-time budget meter deduction during checkout |
| 10 | `F10`: Data Repositories Layer | Repositories (`product`, `order`, `budget`, `config`) | T1.1: `productRepo.findById` retrieves correct item<br>T1.2: `orderRepo.create` creates relational order<br>T1.3: `budgetRepo.lockForUpdate` locks row<br>T1.4: `configRepo.getSettings` retrieves singleton<br>T1.5: Typed DTO return contracts strictly met | T2.1: `findById` with non-existent UUID returns null<br>T2.2: Repositories handle empty query results cleanly<br>T2.3: Handling SQL syntax/connection errors gracefully<br>T2.4: Parameterized queries protect against SQL injection<br>T2.5: Repository pagination bounds enforcement (limit/offset) | COMB-08: Repository transactional coordination in order creation |
| 11 | `F11`: Domain Services Layer | Domain Services (`order`, `inventory`, `config`, `storage`) | T1.1: `orderService.createOrderWithACID` workflow<br>T1.2: `inventoryService.adjustStock` delta updates<br>T1.3: `storeConfigService.updateThreshold` updates limit<br>T1.4: `storageService.createPresignedUrl` generates URL<br>T1.5: Domain event emission on service mutations | T2.1: Service rejects negative stock adjustments<br>T2.2: Order cancellation rejected if status != PENDING<br>T2.3: Service rejects unauthorized manager decision<br>T2.4: Rollback logic triggered on downstream failure<br>T2.5: Invalid UUID format throws typed ValidationError | COMB-03: Order rejection invokes inventory and budget refund services |
| 12 | `F12`: Cloudflare R2 / S3 Presigned URL Service | `POST /api/admin/uploads/presign` | T1.1: Generates valid S3 PUT presigned URL<br>T1.2: URL contains expiration timestamp (<= 900s)<br>T1.3: Returns unique object key with UUID<br>T1.4: Admin authentication verified before generation<br>T1.5: Presigned GET URL generated for product image | T2.1: Non-admin request returns 403 Forbidden<br>T2.2: File size exceeding 10MB rejected with 400<br>T2.3: Disallowed file extension (.exe, .sh) rejected<br>T2.4: Expired presigned URL rejected by storage mock<br>T2.5: Empty filename rejected with 400 Bad Request | COMB-04: Presigned URL upload piping into CSV import worker |
| 13 | `F13`: Edge Middleware Auth & RBAC Guard | `src/middleware.ts` | T1.1: Public routes (`/login`, `/_next`) pass through<br>T1.2: Unauthenticated request to `/` redirects to `/login`<br>T1.3: `EMPLOYEE` role allowed access to `/`, `/cart`<br>T1.4: `MANAGER` role allowed access to `/admin/approvals`<br>T1.5: `ADMIN` role allowed access to all `/admin/*` | T2.1: `EMPLOYEE` accessing `/admin` returns 403 Forbidden<br>T2.2: Tampered/invalid JWT token redirects to `/login`<br>T2.3: Expired JWT token forces re-authentication<br>T2.4: Missing role claim defaults to least privilege<br>T2.5: Sub-path traversal (`/admin/../cart`) sanitized | COMB-06: RBAC escalation attempts blocked between Employee and Manager |
| 14 | `F14`: Edge Rate Limiting Guard | `src/middleware.ts`, Upstash REST | T1.1: Normal traffic increments sliding window counter<br>T1.2: Response includes `X-RateLimit-Limit` header<br>T1.3: Response includes `X-RateLimit-Remaining` header<br>T1.4: Response includes `X-RateLimit-Reset` header<br>T1.5: Rate limit resets after sliding window elapses | T2.1: Exceeding request quota returns 429 Too Many Requests<br>T2.2: `Retry-After` header present on 429 response<br>T2.3: Upstash Redis timeout (>25ms) triggers fail-open<br>T2.4: Degraded header `X-RateLimit-Degraded: true` emitted<br>T2.5: Distinct IPs tracked with separate rate budgets | COMB-10: Rate limiting triggers prior to API handler execution |
| 15 | `F15`: Storefront Catalog Browsing & Filter | `GET /api/products`, `src/app/(storefront)/page.tsx` | T1.1: Returns active products with price, stock, category<br>T1.2: Filter by category slug returns matching items<br>T1.3: Debounced search (`?q=pens`) matches name/desc<br>T1.4: Sort by price ascending returns sorted list<br>T1.5: Inactive products (`is_active=false`) omitted | T2.1: Search query with special characters sanitized<br>T2.2: Non-existent category slug returns empty list<br>T2.3: Zero products found displays empty state<br>T2.4: Pagination offset beyond total items returns empty<br>T2.5: Negative page index defaulted to page 1 | COMB-07: Catalog stock badge dynamically reflects stock editor updates |
| 16 | `F16`: Budget-Aware Cart & Budget Meter | `src/components/storefront/BudgetMeter.tsx`, `cart/page.tsx` | T1.1: Cart total computed correctly from line items<br>T1.2: Budget meter calculates spent + cart impact<br>T1.3: Green meter zone displayed when spend < 70%<br>T1.4: Amber meter zone displayed when spend 70-90%<br>T1.5: Red meter zone displayed when spend > 90% | T2.1: Cart total exceeding remaining budget displays alert<br>T2.2: Checkout button disabled when cart > remaining<br>T2.3: Adding item quantity exceeding live stock prevented<br>T2.4: Zero items in cart disables checkout button<br>T2.5: Currency formatted accurately to 2 decimal places | COMB-01: Adding items updates budget meter color band in real-time |
| 17 | `F17`: Idempotent Order Checkout Submission | `POST /api/orders` | T1.1: Order checkout returns 201 Created with order ID<br>T1.2: Header `Idempotency-Key` accepted and stored<br>T1.3: Order status initialized correctly<br>T1.4: Stock deducted and budget decremented atomically<br>T1.5: Order items persisted with unit price snapshot | T2.1: Duplicate request with same key returns cached 201<br>T2.2: Cache hit includes `X-Cache: IDEMPOTENT_HIT`<br>T2.3: Missing `Idempotency-Key` rejected with 400<br>T2.4: Empty items array rejected with 400 Bad Request<br>T2.5: Non-existent product ID returns 404 / 422 | COMB-05: Double-click submission generates identical order ID |
| 18 | `F18`: Employee Order Tracking Portal | `GET /api/orders`, `src/app/(storefront)/orders/page.tsx` | T1.1: Employee views list of personal orders<br>T1.2: Status badge displayed (`PENDING_APPROVAL`, `APPROVED`, etc.)<br>T1.3: Order line items and totals formatted in USD<br>T1.4: Self-service cancel button visible for `PENDING_APPROVAL`<br>T1.5: Cancellation transitions status to `CANCELLED` | T2.1: Employee cannot view orders belonging to other users<br>T2.2: Cancelling already `APPROVED` order returns 400<br>T2.3: Cancelling already `CANCELLED` order returns 400<br>T2.4: Empty order history displays empty state<br>T2.5: Cancellation reason recorded in audit log | COMB-03: Cancellation restores stock and department budget |
| 19 | `F19`: Dynamic Auto-Approval Rule Engine | Order Service, `store_settings` | T1.1: Order total < limit ($100 default) auto-approved (`APPROVED`)<br>T1.2: Order total >= limit routed to `PENDING_APPROVAL`<br>T1.3: Evaluation uses dynamic `auto_approve_limit_cents`<br>T1.4: Setting updated to $50 routes $75 order to pending<br>T1.5: Auto-approved orders bypass manager approval queue | T2.1: Order total exactly at limit ($100.00) routed to pending<br>T2.2: Order total of $0.01 auto-approved<br>T2.3: Missing store setting falls back safely to $100<br>T2.4: Limit set to $0 routes all orders to pending<br>T2.5: Fractional cent rounding handled strictly | COMB-02: Updating auto-approval threshold dynamically shifts routing |
| 20 | `F20`: Manager Order Approval Queue Portal | `GET /api/admin/approvals`, `POST /api/orders/[id]/approve` | T1.1: Manager views pending orders in their department<br>T1.2: Manager approves order -> status becomes `APPROVED`<br>T1.3: Manager rejects order with comment -> status `REJECTED`<br>T1.4: Rejection reason persisted and visible to employee<br>T1.5: Approved order removed from pending queue | T2.1: Plain `EMPLOYEE` calling approve route returns 403<br>T2.2: Approving already approved order returns 409 Conflict<br>T2.3: Rejecting without required comment returns 400<br>T2.4: Manager cannot approve orders for other departments<br>T2.5: Approving non-existent order ID returns 404 | COMB-03: Rejection triggers automated inventory and budget refund |
| 21 | `F21`: Executive KPI Dashboard | `GET /api/admin/kpis`, `src/app/(admin)/admin/page.tsx` | T1.1: Spend MTD calculated accurately across approved orders<br>T1.2: Pending approvals count matches database count<br>T1.3: Total order volume metric computed accurately<br>T1.4: Low stock alert count lists items with stock <= 5<br>T1.5: Departmental spend breakdown formatted properly | T2.1: Greenfield database with zero orders returns 0 KPIs<br>T2.2: Cancelled and rejected orders excluded from Spend MTD<br>T2.3: Date range filter boundaries respected<br>T2.4: Out of stock (stock = 0) highlighted in critical alert<br>T2.5: Non-admin/manager access returns 403 Forbidden | COMB-04: Bulk CSV import immediately updates low stock KPI count |
| 22 | `F22`: Dynamic Catalog Management | `POST`, `PUT`, `DELETE /api/admin/products`, `/api/admin/categories` | T1.1: Admin creates new category with slug<br>T1.2: Admin creates new product with price and category<br>T1.3: Admin updates product title and description<br>T1.4: Admin toggles product `is_active` status<br>T1.5: Category hierarchy nesting with parent_id | T2.1: Duplicate category slug returns 409 Conflict<br>T2.2: Deleting category with active products returns 400<br>T2.3: Creating product with negative price rejected with 422<br>T2.4: Non-admin product mutation returns 403 Forbidden<br>T2.5: Updating non-existent product ID returns 404 | COMB-08: Product creation creates corresponding audit log record |
| 23 | `F23`: Dynamic Stock Editor Modal | `POST /api/admin/products/[id]/stock` | T1.1: Set absolute stock quantity updates DB immediately<br>T1.2: Relative adjustment (+10, -5) calculates correct stock<br>T1.3: Stock editor accepts required adjustment reason code<br>T1.4: Stock update generates real-time audit log entry<br>T1.5: Updated stock visible in storefront catalog query | T2.1: Relative adjustment resulting in negative stock returns 400<br>T2.2: Setting absolute stock to negative number returns 400<br>T2.3: Missing adjustment reason returns 400 Bad Request<br>T2.4: Non-admin stock adjustment returns 403 Forbidden<br>T2.5: Concurrent stock updates serialize safely | COMB-07: Stock editor reduction to 0 triggers out-of-stock badge |
| 24 | `F24`: Dynamic Store Settings & Budgets | `GET`, `PUT /api/admin/store-config`, `/budgets` | T1.1: Update `auto_approve_limit_cents` persists to DB<br>T1.2: Update company name and logo URL persists<br>T1.3: Update primary branding color persists<br>T1.4: Allocate department budget updates `total_cents`<br>T1.5: Reset department budget refreshes `remaining_cents` | T2.1: Negative auto-approve limit rejected with 400<br>T2.2: Invalid hex color string rejected with 400<br>T2.3: Budget period end <= period start rejected with 400<br>T2.4: Negative budget allocation rejected with 400<br>T2.5: Non-admin store config update returns 403 | COMB-09: Updated branding color immediately served via config API |
| 25 | `F25`: Immutable Audit Logs Viewer | `GET /api/admin/audit-logs`, `audit-logs/page.tsx` | T1.1: Admin views chronological log of system mutations<br>T1.2: Visual diff present showing old vs new values<br>T1.3: Filter by entity type (`ORDER`, `PRODUCT`, `BUDGET`)<br>T1.4: Filter by admin user ID works as expected<br>T1.5: Audit logs are append-only (no DELETE or PUT endpoint) | T2.1: HTTP PUT/DELETE on `/api/admin/audit-logs` returns 405<br>T2.2: Audit log pagination handles 10,000+ records cleanly<br>T2.3: Non-admin access to audit logs returns 403 Forbidden<br>T2.4: Deleted admin user shows `[Deleted User]` (SET NULL)<br>T2.5: Malformed JSON in old/new value handled gracefully | COMB-08: Complete lifecycle mutations verifiable via audit log feed |
| 26 | `F26`: Bulk CSV Inventory Import Worker | `POST /api/workers/csv-import` | T1.1: Valid CSV stream processed in 200-row chunks<br>T1.2: Upsert modifies existing products and inserts new<br>T1.3: Summary metrics return total, inserted, updated counts<br>T1.4: Worker processes R2 object key asynchronously<br>T1.5: Valid products immediately appear in catalog query | T2.1: CSV with non-numeric price logs row error and continues<br>T2.2: CSV with negative stock logs row error and continues<br>T2.3: Missing required CSV headers aborts file with 400<br>T2.4: CSV with 1,500 rows chunks into 8 batches without timeout<br>T2.5: Worker aborts if QStash signature verification fails | COMB-04: Batch import triggers inventory updates and low stock alerts |
| 27 | `F27`: Asynchronous Email Notifications | `POST /api/workers/notifications` | T1.1: Order confirmation email job dispatched on checkout<br>T1.2: Manager approval request email dispatched on pending<br>T1.3: Order approved/rejected decision email dispatched<br>T1.4: Email payload contains order ID and total amount<br>T1.5: Resend API mock logs email delivery without errors | T2.1: Invalid recipient email logged as delivery failure<br>T2.2: Resend API rate limit triggers QStash retry<br>T2.3: Missing email template variables caught in validation<br>T2.4: Worker rejects unsigned notification webhook with 401<br>T2.5: Idempotent email deduplication avoids duplicate emails | COMB-02: High-value order triggers approval notification job |
| 28 | `F28`: Asynchronous Audit Log Worker | `POST /api/workers/audit-log` | T1.1: Background worker receives audit log payload<br>T1.2: Worker inserts row into `audit_logs` table<br>T1.3: Timestamp set automatically to current UTC time<br>T1.4: Worker acknowledges QStash with 200 OK<br>T1.5: Async decoupled ingestion keeps main mutation < 50ms | T2.1: Transient DB failure retried via QStash backoff<br>T2.2: Worker rejects unauthenticated webhook with 401<br>T2.3: Malformed payload missing entity_id logged as error<br>T2.4: Database constraint error handled without worker crash<br>T2.5: Large JSON diffs (e.g. bulk changes) stored cleanly | COMB-08: Audit worker asynchronously records admin product update |
| 29 | `F29`: Opaque-Box E2E Test Suite (Tiers 1-4) | `tests/e2e/runner.ts` CLI | T1.1: Test runner executes all test suites sequentially<br>T1.2: Flag `--tier=1` executes only Tier 1 tests<br>T1.3: Flag `--feature=F08` filters tests by feature code<br>T1.4: Exit code 0 returned when all tests pass<br>T1.5: Formatted ANSI summary table printed on completion | T2.1: Test failure returns exit code 1<br>T2.2: Invalid CLI flag `--unknown` displays help and exits 1<br>T2.3: Test timeout properly isolates and reports hanging test<br>T2.4: Unhandled promise rejection inside test caught cleanly<br>T2.5: Test runner functions without external test frameworks | T4: Full suite execution verifies all real-world scenarios |
| 30 | `F30`: Adversarial Coverage Hardening (Tier 5) | Adversarial test suite | T1.1: SQL injection attempts in search queries sanitized<br>T1.2: CSV formula injection (`=CMD|' /C ...'`) neutralized<br>T1.3: Clock drift simulation handled in JWT validation<br>T1.4: Excessive payload size (>10MB) rejected with 413<br>T1.5: Rapid concurrency flood test on single-stock item | T2.1: Unicode exploit strings (null bytes, zero-width spaces)<br>T2.2: XSS script injection in product names escaped in HTML<br>T2.3: IDOR attempt on orders belonging to other departments<br>T2.4: Negative budget manipulation via integer overflow<br>T2.5: Replay of expired idempotency keys rejected cleanly | COMB-06: RBAC adversarial privilege escalation testing |

---

## 4. Tier 4: Real-World Multi-Persona Scenarios

Tier 4 tests execute complete end-to-end user journeys traversing multiple architectural boundaries and personas:

### Scenario 1: New Employee Onboarding to First Supply Order (`scen-01-onboarding-to-first-order.test.ts`)
- **Persona**: Alice (New Hire, Role: `EMPLOYEE`, Department: `Engineering`, Initial Budget: $1,000.00).
- **Workflow**:
  1. Alice navigates to `/login` with initial session, gets redirected to storefront catalog `/`.
  2. Alice searches for `"ballpoint pens"` using debounced search, selects Blue Pens ($15.00, stock: 50).
  3. Alice adds 2 packs to cart ($30.00). Budget meter updates from $1,000.00 remaining to $970.00 (Green zone, < 70%).
  4. Alice navigates to `/cart`, supplies UUID idempotency key, and clicks "Submit Order".
  5. System evaluates auto-approval ($30.00 < $100.00 auto-approve threshold) -> Status transitions to `APPROVED`.
  6. Blue Pens stock drops from 50 to 48. Department budget drops to $970.00.
  7. Alice visits `/orders`, verifies order is listed with `APPROVED` chip, and confirms cancellation button is disabled.

### Scenario 2: High-Value Equipment Order & Manager Approval Workflow (`scen-02-manager-high-value-approval-workflow.test.ts`)
- **Personas**: Bob (Senior Engineer, `EMPLOYEE`), Carol (Engineering Manager, `MANAGER`).
- **Workflow**:
  1. Bob selects an Ergonomic Standing Desk Converter ($280.00, stock: 10).
  2. Bob submits order. Since $280.00 >= $100.00 auto-approve limit, order status initializes as `PENDING_APPROVAL`.
  3. Stock is reserved (desk stock decrements from 10 to 9), budget is encumbered.
  4. Asynchronous notification worker dispatches approval request email to Carol.
  5. Carol logs into `/admin/approvals`, reviews pending queue, sees Bob's order with line items and budget impact.
  6. Carol clicks "Approve" with comment `"Approved for home ergonomics"`.
  7. Order transitions to `APPROVED`. Bob receives approval confirmation email. Audit log records Carol's approval action.

### Scenario 3: Admin Bulk Restock & Catalog Expansion (`scen-03-admin-bulk-restock-and-catalog-expansion.test.ts`)
- **Persona**: Dave (System Administrator, `ADMIN`).
- **Workflow**:
  1. Dave accesses `/admin/catalog`, requests S3 presigned upload URL for `inventory-restock-2026.csv`.
  2. Presigned PUT URL generated and validated. Dave simulates uploading a 600-row inventory CSV.
  3. QStash worker processes file in 3 batches of 200 rows.
  4. Batch 1 and 2 succeed; Batch 3 contains 1 invalid row (negative stock), which is logged to error summary while remaining 199 rows succeed.
  5. Total 599 products created/updated. Low stock KPI card on `/admin` drops from 12 alerts to 0 alerts.
  6. Dave views `/admin/audit-logs` and verifies the CSV bulk import event was recorded with processed counts.

### Scenario 4: Fiscal Year-End Budget Exhaustion & Denial (`scen-04-fiscal-year-end-budget-exhaustion.test.ts`)
- **Personas**: Alice (`EMPLOYEE`), Dave (`ADMIN`).
- **Workflow**:
  1. Department budget has only $45.00 remaining for the fiscal period.
  2. Alice adds a high-capacity laser toner cartridge ($85.00) to her cart.
  3. Budget meter immediately shifts into Red Zone (> 90%), displaying negative projected balance `-$40.00` with warning banner.
  4. Alice attempts checkout submission. Checkout is rejected with HTTP `422 Unprocessable Entity` ("Insufficient department budget: remaining $45.00, required $85.00").
  5. Alice contacts Dave (Admin). Dave navigates to `/admin/settings`, allocates an additional $500.00 to Engineering budget.
  6. Audit log records Dave's budget adjustment.
  7. Alice retries checkout with the same cart; checkout now succeeds and order is placed.

### Scenario 5: Incident Recovery, Order Rejection & Audit Log Investigation (`scen-05-incident-recovery-and-audit-investigation.test.ts`)
- **Personas**: Bob (`EMPLOYEE`), Carol (`MANAGER`), Dave (`ADMIN`).
- **Workflow**:
  1. Bob places order for 4 External Monitors ($150 each, total $600.00). Stock drops by 4, budget encumbered by $600.00. Order status: `PENDING_APPROVAL`.
  2. Carol reviews the order, realizes department project was cancelled, and clicks "Reject" with comment `"Project cancelled by VP"`.
  3. System triggers automated rollback: Monitor stock is restored (+4 units), Department budget is refunded (+$600.00). Order status: `REJECTED`.
  4. Bob checks `/orders` and observes rejection status with Carol's explanation.
  5. Dave performs security/compliance audit on `/admin/audit-logs`: filters by Entity `ORDER` and verifies complete audit trail: Bob's creation event, Carol's rejection event, and automated stock/budget restoration entries.

---

## 5. Coverage Thresholds & Quality Gates

To ensure uncompromising software quality, the test runner enforces the following strict criteria:

| Metric | Target Threshold | Action on Violation |
|--------|------------------|---------------------|
| **Feature Coverage (Tiers 1 & 2)** | 100% of 30 Features (>= 5 tests each) | Test suite fails; milestone progression blocked |
| **Total Test Count** | >= 345 Automated Test Cases | Runner asserts test density requirement |
| **Pass Rate** | 100% (0 failures, 0 unhandled errors) | Exit code 1; build rejected |
| **Test Execution Speed** | Full suite execution < 60 seconds | Flagged for performance optimization |
| **Independence & Isolation** | 100% (zero test-order dependencies) | Random execution permutation validation |
| **Contract Fidelity** | Zero internal imports (public HTTP/DB only) | Linter rejects imports from `src/` inside tests |

---

## 6. Execution Semantics & CI/CD Integration

### Command Line Interface
```bash
# Execute entire E2E test suite (all tiers)
npx tsx tests/e2e/runner.ts

# Execute specific tier
npx tsx tests/e2e/runner.ts --tier=1
npx tsx tests/e2e/runner.ts --tier=2
npx tsx tests/e2e/runner.ts --tier=3
npx tsx tests/e2e/runner.ts --tier=4

# Filter tests by feature code
npx tsx tests/e2e/runner.ts --feature=F08
npx tsx tests/e2e/runner.ts --feature=F17

# Target live deployment or local Next.js server
API_BASE_URL=http://localhost:3000 npx tsx tests/e2e/runner.ts

# Target mock/offline protocol simulator (default in greenfield/pre-deployment)
MOCK_SIMULATOR=true npx tsx tests/e2e/runner.ts
```

### Windows Host Bridge
For Windows environments where Node.js is run inside containers or external runners, the project provides:
```powershell
powershell -ExecutionPolicy Bypass -File tests/e2e/run-tests.ps1
```
This PowerShell harness executes structural, fixture, and contract verification checks directly on Windows.

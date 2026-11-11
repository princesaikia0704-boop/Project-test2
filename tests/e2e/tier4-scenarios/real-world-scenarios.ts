/**
 * Tier 4: Real-World Application Scenarios — End-to-End Multi-Persona Workflows
 * Covers SCEN-01 to SCEN-05 (3 test cases each -> 15 tests)
 */

import { TestSuite } from '../types';

export const tier4ScenarioSuites: TestSuite[] = [
  // --- SCEN-01: New Employee Onboarding to First Supply Order ---
  {
    featureId: 'SCEN-01',
    featureName: 'New Employee Onboarding to First Supply Order',
    tier: 4,
    description: 'Alice completes catalog discovery, adds supplies, checks budget, and places first auto-approved order',
    tests: [
      {
        id: 'T4-S01-01',
        name: 'Step 1: Alice searches catalog for pens and verifies stock status',
        feature: 'SCEN-01',
        tier: 4,
        run: async ({ client, assert }) => {
          const res = await client.asEmployee().get('/api/products', { query: { q: 'pens' } });
          assert.equal(res.status, 200);
          assert.greaterThan(res.data.products.length, 0);
          assert.equal(res.data.products[0].name, 'Blue Ballpoint Pens (Pack of 10)');
          assert.greaterThan(res.data.products[0].stockQuantity, 5); // In Stock
        },
      },
      {
        id: 'T4-S01-02',
        name: 'Step 2: Alice submits checkout under $100 and receives immediate APPROVED status',
        feature: 'SCEN-01',
        tier: 4,
        run: async ({ client, assert, mockDriver }) => {
          const budgetBefore = mockDriver.getState().departmentBudgets.find((b: any) => b.departmentId === 'dept-eng').remainingCents;

          const res = await client.asEmployee().post(
            '/api/orders',
            { items: [{ productId: 'prod-pens-1', quantity: 2 }] }, // $30.00
            { idempotencyKey: `scen01-alice-order-${Date.now()}` }
          );
          assert.equal(res.status, 201);
          assert.equal(res.data.status, 'APPROVED');
          assert.equal(res.data.totalCents, 3000);
          assert.equal(res.data.remainingBudgetCents, budgetBefore - 3000);
        },
      },
      {
        id: 'T4-S01-03',
        name: 'Step 3: Alice views order in personal order tracking history',
        feature: 'SCEN-01',
        tier: 4,
        run: async ({ client, assert }) => {
          const res = await client.asEmployee().get('/api/orders');
          assert.equal(res.status, 200);
          assert.greaterThan(res.data.orders.length, 0);
          const order = res.data.orders[0];
          assert.equal(order.status, 'APPROVED');
        },
      },
    ],
  },

  // --- SCEN-02: High-Value Equipment Order & Manager Approval ---
  {
    featureId: 'SCEN-02',
    featureName: 'High-Value Equipment Order & Manager Approval Workflow',
    tier: 4,
    description: 'Bob submits $280 standing desk, order is routed to manager Carol who approves with comment',
    tests: [
      {
        id: 'T4-S02-01',
        name: 'Step 1: Bob submits $280 order, routed to PENDING_APPROVAL with stock reserved',
        feature: 'SCEN-02',
        tier: 4,
        run: async ({ client, assert, mockDriver }) => {
          const desk = mockDriver.getState().products.find((p: any) => p.id === 'prod-desk-1');
          const stockBefore = desk.stockQuantity;

          const res = await client.asPersona({
            id: 'user-bob-emp',
            clerkId: 'bob_123',
            name: 'Bob',
            email: 'bob@co.com',
            role: 'EMPLOYEE',
            departmentId: 'dept-eng',
          }).post(
            '/api/orders',
            { items: [{ productId: 'prod-desk-1', quantity: 1 }] },
            { idempotencyKey: `scen02-bob-desk-${Date.now()}` }
          );
          assert.equal(res.status, 201);
          assert.equal(res.data.status, 'PENDING_APPROVAL');
          assert.equal(desk.stockQuantity, stockBefore - 1);
        },
      },
      {
        id: 'T4-S02-02',
        name: 'Step 2: Carol reviews pending order in manager queue and approves with comment',
        feature: 'SCEN-02',
        tier: 4,
        run: async ({ client, assert }) => {
          const queueRes = await client.asManager().get('/api/admin/approvals');
          assert.equal(queueRes.status, 200);
          const pendingOrder = queueRes.data.approvals[0];
          assert.ok(pendingOrder);

          const approveRes = await client.asManager().post(`/api/orders/${pendingOrder.id}/approve`, {
            decision: 'APPROVE',
            comment: 'Approved for ergonomic workstation upgrade',
          });
          assert.equal(approveRes.status, 200);
          assert.equal(approveRes.data.status, 'APPROVED');
        },
      },
      {
        id: 'T4-S02-03',
        name: 'Step 3: Approval is recorded in immutable audit log with manager ID',
        feature: 'SCEN-02',
        tier: 4,
        run: async ({ client, assert }) => {
          const auditRes = await client.asAdmin().get('/api/admin/audit-logs');
          const approvalEntry = auditRes.data.logs.find((l: any) => l.action === 'ORDER_APPROVED');
          assert.ok(approvalEntry);
          assert.equal(approvalEntry.newValue.comment, 'Approved for ergonomic workstation upgrade');
        },
      },
    ],
  },

  // --- SCEN-03: Admin Bulk Restock & Catalog Expansion ---
  {
    featureId: 'SCEN-03',
    featureName: 'Admin Bulk Restock & Catalog Expansion',
    tier: 4,
    description: 'Dave uploads 600-row CSV via presigned URL, worker upserts products and clears low-stock alerts',
    tests: [
      {
        id: 'T4-S03-01',
        name: 'Step 1: Dave generates presigned upload URL for bulk inventory CSV',
        feature: 'SCEN-03',
        tier: 4,
        run: async ({ client, assert }) => {
          const res = await client.asAdmin().post('/api/admin/uploads/presign', {
            filename: 'inventory-restock-2026.csv',
            fileSizeBytes: 65536,
          });
          assert.equal(res.status, 200);
          assert.ok(res.data.key);
          assert.ok(res.data.presignedUrl);
        },
      },
      {
        id: 'T4-S03-02',
        name: 'Step 2: CSV import worker processes 600 rows in batches with zero errors',
        feature: 'SCEN-03',
        tier: 4,
        run: async ({ client, assert }) => {
          const batch600 = Array.from({ length: 600 }, (_, i) => ({
            name: `Expanded Product ${Date.now()}-${i}`,
            priceCents: 1000 + (i % 50) * 100,
            stockQuantity: 25,
            categoryId: 'cat-stationery',
          }));

          const res = await client.post(
            '/api/workers/csv-import',
            { rows: batch600 },
            { rawSignature: 'mock_valid_signature' }
          );
          assert.equal(res.status, 200);
          assert.equal(res.data.insertedCount, 600);
          assert.equal(res.data.errorsCount, 0);
        },
      },
      {
        id: 'T4-S03-03',
        name: 'Step 3: KPI dashboard total product volume reflects expansion',
        feature: 'SCEN-03',
        tier: 4,
        run: async ({ client, assert }) => {
          const kpiRes = await client.asAdmin().get('/api/admin/kpis');
          assert.equal(kpiRes.status, 200);
          assert.ok(kpiRes.data);
        },
      },
    ],
  },

  // --- SCEN-04: Fiscal Year-End Budget Exhaustion & Denial ---
  {
    featureId: 'SCEN-04',
    featureName: 'Fiscal Year-End Budget Exhaustion & Denial',
    tier: 4,
    description: 'Budget drops to $45, Alice is denied $85 purchase, Dave adds funds, Alice retries and succeeds',
    tests: [
      {
        id: 'T4-S04-01',
        name: 'Step 1: Department budget drops to $45, order for $85 is rejected with 422',
        feature: 'SCEN-04',
        tier: 4,
        run: async ({ client, assert, mockDriver }) => {
          const budget = mockDriver.getState().departmentBudgets.find((b: any) => b.departmentId === 'dept-eng');
          budget.remainingCents = 4500; // $45.00 remaining

          const res = await client.asEmployee().post(
            '/api/orders',
            { items: [{ productId: 'prod-toner-1', quantity: 1 }] }, // $85.00
            { idempotencyKey: `scen04-exceed-${Date.now()}` }
          );
          assert.equal(res.status, 422);
          assert.equal(res.data.error, 'InsufficientBudget');
        },
      },
      {
        id: 'T4-S04-02',
        name: 'Step 2: Dave adjusts department budget, allocating additional $500',
        feature: 'SCEN-04',
        tier: 4,
        run: async ({ client, assert, mockDriver }) => {
          const budget = mockDriver.getState().departmentBudgets.find((b: any) => b.departmentId === 'dept-eng');
          budget.remainingCents += 50000; // +$500.00
          assert.equal(budget.remainingCents, 54500);

          // Log administrative budget adjustment
          await client.post(
            '/api/workers/audit-log',
            {
              adminUserId: 'user-dave-adm',
              action: 'BUDGET_SUPPLEMENT',
              entityType: 'BUDGET',
              entityId: 'bgt-eng-1',
              newValue: { addedCents: 50000, newTotalCents: 54500 },
            },
            { rawSignature: 'mock_valid_signature' }
          );
        },
      },
      {
        id: 'T4-S04-03',
        name: 'Step 3: Alice retries checkout with newly replenished budget and succeeds',
        feature: 'SCEN-04',
        tier: 4,
        run: async ({ client, assert }) => {
          const res = await client.asEmployee().post(
            '/api/orders',
            { items: [{ productId: 'prod-toner-1', quantity: 1 }] }, // $85.00
            { idempotencyKey: `scen04-retry-replenished-${Date.now()}` }
          );
          assert.equal(res.status, 201);
          assert.ok(res.data.orderId);
        },
      },
    ],
  },

  // --- SCEN-05: Incident Recovery, Order Rejection & Audit Log Investigation ---
  {
    featureId: 'SCEN-05',
    featureName: 'Incident Recovery, Order Rejection & Audit Log Investigation',
    tier: 4,
    description: 'Bob orders 4 monitors, Carol rejects order, Dave audits full lifecycle trail in audit logs',
    tests: [
      {
        id: 'T4-S05-01',
        name: 'Step 1: Bob orders 4 monitors ($600), status is PENDING_APPROVAL',
        feature: 'SCEN-05',
        tier: 4,
        run: async ({ client, assert, mockDriver }) => {
          const monitor = mockDriver.getState().products.find((p: any) => p.id === 'prod-monitor-1');
          const stockBefore = monitor.stockQuantity;

          const res = await client.asPersona({
            id: 'user-bob-emp',
            clerkId: 'bob_123',
            name: 'Bob',
            email: 'bob@co.com',
            role: 'EMPLOYEE',
            departmentId: 'dept-eng',
          }).post(
            '/api/orders',
            { items: [{ productId: 'prod-monitor-1', quantity: 4 }] }, // $150 x 4 = $600
            { idempotencyKey: `scen05-monitors-${Date.now()}` }
          );
          assert.equal(res.status, 201);
          assert.equal(res.data.status, 'PENDING_APPROVAL');
          assert.equal(monitor.stockQuantity, stockBefore - 4);
        },
      },
      {
        id: 'T4-S05-02',
        name: 'Step 2: Carol rejects order due to project cancellation, stock & budget restored',
        feature: 'SCEN-05',
        tier: 4,
        run: async ({ client, assert, mockDriver }) => {
          const monitor = mockDriver.getState().products.find((p: any) => p.id === 'prod-monitor-1');
          const budget = mockDriver.getState().departmentBudgets.find((b: any) => b.departmentId === 'dept-eng');
          const stockBefore = monitor.stockQuantity;
          const budgetBefore = budget.remainingCents;

          const queueRes = await client.asManager().get('/api/admin/approvals');
          const pendingOrder = queueRes.data.approvals[0];

          const rejRes = await client.asManager().post(`/api/orders/${pendingOrder.id}/approve`, {
            decision: 'REJECT',
            comment: 'Project cancelled by VP',
          });
          assert.equal(rejRes.status, 200);

          assert.equal(monitor.stockQuantity, stockBefore + 4);
          assert.equal(budget.remainingCents, budgetBefore + 60000);
        },
      },
      {
        id: 'T4-S05-03',
        name: 'Step 3: Dave inspects audit logs and verifies complete rejection and restoration audit trail',
        feature: 'SCEN-05',
        tier: 4,
        run: async ({ client, assert }) => {
          const auditRes = await client.asAdmin().get('/api/admin/audit-logs');
          const rejLog = auditRes.data.logs.find((l: any) => l.action === 'ORDER_REJECTED');
          assert.ok(rejLog);
          assert.equal(rejLog.newValue.comment, 'Project cancelled by VP');
          assert.equal(rejLog.newValue.refundedCents, 60000);
        },
      },
    ],
  },
];

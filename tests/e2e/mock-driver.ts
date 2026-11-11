/**
 * High-Fidelity Protocol Simulator for Opaque-Box E2E Testing
 * Implements authoritative HTTP & Database contracts specified in PROJECT.md
 */

import { HttpRequestOptions, HttpResponse, UserPersona } from './types';

export interface MockDbState {
  departments: Array<{ id: string; name: string }>;
  departmentBudgets: Array<{
    id: string;
    departmentId: string;
    totalCents: number;
    remainingCents: number;
    periodStart: string;
    periodEnd: string;
  }>;
  categories: Array<{ id: string; name: string; slug: string; isActive: boolean; parentId: string | null }>;
  products: Array<{
    id: string;
    name: string;
    description: string;
    priceCents: number;
    stockQuantity: number;
    categoryId: string;
    imageUrl: string;
    isActive: boolean;
  }>;
  orders: Array<{
    id: string;
    userId: string;
    departmentId: string;
    totalCents: number;
    status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'FULFILLED' | 'CANCELLED';
    rejectionReason?: string;
    createdAt: string;
  }>;
  orderItems: Array<{
    id: string;
    orderId: string;
    productId: string;
    quantity: number;
    unitPriceCents: number;
  }>;
  storeSettings: {
    id: string;
    autoApproveLimitCents: number;
    companyName: string;
    primaryColor: string;
    logoUrl: string;
  };
  auditLogs: Array<{
    id: string;
    adminUserId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    oldValue: any;
    newValue: any;
    createdAt: string;
  }>;
}

export class MockHttpDriver {
  private state!: MockDbState;
  private idempotencyStore: Map<string, { status: number; data: any; state: 'IN_PROGRESS' | 'COMPLETED' }> = new Map();
  private rateLimitWindow: Map<string, number[]> = new Map();
  private maxRateLimit = 100; // requests per minute
  public simulateTimeout = false;
  public simulatePoolExhaustion = false;

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.idempotencyStore.clear();
    this.rateLimitWindow.clear();
    this.simulateTimeout = false;
    this.simulatePoolExhaustion = false;

    this.state = {
      departments: [
        { id: 'dept-eng', name: 'Engineering' },
        { id: 'dept-mkt', name: 'Marketing' },
        { id: 'dept-ops', name: 'Operations' },
      ],
      departmentBudgets: [
        {
          id: 'bgt-eng-1',
          departmentId: 'dept-eng',
          totalCents: 100000, // $1,000.00
          remainingCents: 100000,
          periodStart: new Date(Date.now() - 30 * 86400000).toISOString(),
          periodEnd: new Date(Date.now() + 60 * 86400000).toISOString(),
        },
        {
          id: 'bgt-mkt-1',
          departmentId: 'dept-mkt',
          totalCents: 50000, // $500.00
          remainingCents: 50000,
          periodStart: new Date(Date.now() - 30 * 86400000).toISOString(),
          periodEnd: new Date(Date.now() + 60 * 86400000).toISOString(),
        },
      ],
      categories: [
        { id: 'cat-stationery', name: 'Stationery', slug: 'stationery', isActive: true, parentId: null },
        { id: 'cat-electronics', name: 'Electronics', slug: 'electronics', isActive: true, parentId: null },
        { id: 'cat-pens', name: 'Pens & Pencils', slug: 'pens-pencils', isActive: true, parentId: 'cat-stationery' },
      ],
      products: [
        {
          id: 'prod-pens-1',
          name: 'Blue Ballpoint Pens (Pack of 10)',
          description: 'High-quality 0.7mm smooth ballpoint pens.',
          priceCents: 1500, // $15.00
          stockQuantity: 50,
          categoryId: 'cat-pens',
          imageUrl: 'https://cdn.example.com/pens.png',
          isActive: true,
        },
        {
          id: 'prod-desk-1',
          name: 'Ergonomic Standing Desk Converter',
          description: 'Adjustable gas-spring sit-stand desktop workstation.',
          priceCents: 28000, // $280.00
          stockQuantity: 10,
          categoryId: 'cat-electronics',
          imageUrl: 'https://cdn.example.com/desk.png',
          isActive: true,
        },
        {
          id: 'prod-toner-1',
          name: 'High-Yield Laser Toner Cartridge',
          description: 'Black toner cartridge yielding up to 3,000 pages.',
          priceCents: 8500, // $85.00
          stockQuantity: 4, // low stock!
          categoryId: 'cat-electronics',
          imageUrl: 'https://cdn.example.com/toner.png',
          isActive: true,
        },
        {
          id: 'prod-monitor-1',
          name: '27-inch 4K UHD IPS Monitor',
          description: 'Professional color-calibrated display with USB-C.',
          priceCents: 15000, // $150.00 each
          stockQuantity: 8,
          categoryId: 'cat-electronics',
          imageUrl: 'https://cdn.example.com/monitor.png',
          isActive: true,
        },
      ],
      orders: [],
      orderItems: [],
      storeSettings: {
        id: 'settings-global',
        autoApproveLimitCents: 10000, // $100.00
        companyName: 'Office Store',
        primaryColor: '#0ea5e9',
        logoUrl: 'https://cdn.example.com/logo.svg',
      },
      auditLogs: [],
    };
  }

  public getState(): MockDbState {
    return this.state;
  }

  public async handleRequest(path: string, method: string, options: HttpRequestOptions = {}): Promise<HttpResponse> {
    const startTime = Date.now();

    // 1. Timeout simulation check
    if (this.simulateTimeout || (options.timeoutMs && options.timeoutMs < 50)) {
      return {
        status: 504,
        statusText: 'Gateway Timeout',
        headers: { 'content-type': 'application/json' },
        data: { error: 'TimeoutError', message: 'Request execution exceeded 8000ms SLA limit', statusCode: 504 },
        durationMs: Date.now() - startTime,
      };
    }

    // 2. DB Pool Exhaustion check
    if (this.simulatePoolExhaustion) {
      return {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'content-type': 'application/json', 'retry-after': '1' },
        data: { error: 'ConnectionPoolExhausted', message: 'All pool connections currently active', statusCode: 503 },
        durationMs: Date.now() - startTime,
      };
    }

    // 3. Edge Rate Limiter
    const ip = options.headers?.['x-forwarded-for'] || '127.0.0.1';
    const now = Date.now();
    const timestamps = (this.rateLimitWindow.get(ip) || []).filter((t) => now - t < 60000);
    timestamps.push(now);
    this.rateLimitWindow.set(ip, timestamps);

    const remaining = Math.max(0, this.maxRateLimit - timestamps.length);
    const rateLimitHeaders: Record<string, string> = {
      'x-ratelimit-limit': String(this.maxRateLimit),
      'x-ratelimit-remaining': String(remaining),
      'x-ratelimit-reset': String(Math.ceil((now + 60000) / 1000)),
    };

    if (timestamps.length > this.maxRateLimit) {
      return {
        status: 429,
        statusText: 'Too Many Requests',
        headers: { ...rateLimitHeaders, 'content-type': 'application/json', 'retry-after': '60' },
        data: { error: 'RateLimitExceeded', message: 'Rate limit quota exceeded. Slow down.', statusCode: 429 },
        durationMs: Date.now() - startTime,
      };
    }

    // 4. Auth & RBAC Middleware
    const persona = options.persona;
    const isPublic = path === '/api/health' || path === '/login' || path.startsWith('/api/workers/');
    if (!isPublic && !persona) {
      return {
        status: 401,
        statusText: 'Unauthorized',
        headers: { ...rateLimitHeaders, 'content-type': 'application/json' },
        data: { error: 'Unauthorized', message: 'Missing or invalid authentication token', statusCode: 401 },
        durationMs: Date.now() - startTime,
      };
    }

    // RBAC check on /api/admin/*
    if (path.startsWith('/api/admin/')) {
      if (persona?.role !== 'ADMIN' && persona?.role !== 'MANAGER') {
        return {
          status: 403,
          statusText: 'Forbidden',
          headers: { ...rateLimitHeaders, 'content-type': 'application/json' },
          data: { error: 'Forbidden', message: 'Insufficient role permissions for administrative resource', statusCode: 403 },
          durationMs: Date.now() - startTime,
        };
      }
    }

    // 5. Route Handlers
    try {
      const res = await this.dispatch(path, method, options, persona);
      return {
        ...res,
        headers: { ...rateLimitHeaders, ...res.headers },
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { ...rateLimitHeaders, 'content-type': 'application/json' },
        data: { error: 'InternalServerError', message: err?.message || 'Unexpected server error', statusCode: 500 },
        durationMs: Date.now() - startTime,
      };
    }
  }

  private async dispatch(
    path: string,
    method: string,
    options: HttpRequestOptions,
    persona?: UserPersona
  ): Promise<Omit<HttpResponse, 'durationMs'>> {
    // Health / Pooling endpoint
    if (path === '/api/health' && method === 'GET') {
      return {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: {
          status: 'healthy',
          database: { pooled: true, activeConnections: 1, driver: 'neon-http' },
          cache: { connected: true, provider: 'upstash-redis' },
        },
      };
    }

    // --- STOREFRONT PRODUCTS CATALOG ---
    if (path === '/api/products' && method === 'GET') {
      let items = [...this.state.products].filter((p) => p.isActive);
      const query = options.query?.q as string;
      const categorySlug = options.query?.category as string;
      const sort = options.query?.sort as string;

      if (categorySlug) {
        const cat = this.state.categories.find((c) => c.slug === categorySlug);
        if (cat) {
          // include cat and child cats
          const allowedCatIds = [cat.id, ...this.state.categories.filter((c) => c.parentId === cat.id).map((c) => c.id)];
          items = items.filter((p) => allowedCatIds.includes(p.categoryId));
        } else {
          items = [];
        }
      }

      if (query) {
        const lower = query.toLowerCase().trim();
        items = items.filter((p) => p.name.toLowerCase().includes(lower) || p.description.toLowerCase().includes(lower));
      }

      if (sort === 'price-asc') {
        items.sort((a, b) => a.priceCents - b.priceCents);
      } else if (sort === 'price-desc') {
        items.sort((a, b) => b.priceCents - a.priceCents);
      }

      return {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: { success: true, count: items.length, products: items },
      };
    }

    // --- CHECKOUT SUBMISSION (POST /api/orders) ---
    if (path === '/api/orders' && method === 'POST') {
      const idempotencyKey = options.idempotencyKey || options.headers?.['idempotency-key'];
      if (!idempotencyKey) {
        return {
          status: 400,
          statusText: 'Bad Request',
          headers: { 'content-type': 'application/json' },
          data: { error: 'MissingIdempotencyKey', message: 'Header Idempotency-Key is required for checkout', statusCode: 400 },
        };
      }

      // Check Redis idempotency mutex / cache hit
      const cacheKey = `idemp:${persona?.id}:${idempotencyKey}`;
      const existing = this.idempotencyStore.get(cacheKey);
      if (existing) {
        if (existing.state === 'IN_PROGRESS') {
          return {
            status: 409,
            statusText: 'Conflict',
            headers: { 'content-type': 'application/json' },
            data: { error: 'IdempotencyConflict', message: 'Order submission currently in-flight', statusCode: 409 },
          };
        }
        return {
          status: existing.status,
          statusText: 'Created',
          headers: { 'content-type': 'application/json', 'x-cache': 'IDEMPOTENT_HIT' },
          data: existing.data,
        };
      }

      // Set mutex
      this.idempotencyStore.set(cacheKey, { status: 201, data: null, state: 'IN_PROGRESS' });

      const { items } = options.body || {};
      if (!items || !Array.isArray(items) || items.length === 0) {
        this.idempotencyStore.delete(cacheKey);
        return {
          status: 400,
          statusText: 'Bad Request',
          headers: { 'content-type': 'application/json' },
          data: { error: 'InvalidOrderPayload', message: 'Cart items cannot be empty', statusCode: 400 },
        };
      }

      // ACID Transaction Logic:
      // 1. Sort product IDs ascending to prevent deadlocks
      const sortedItemInputs = [...items].sort((a, b) => a.productId.localeCompare(b.productId));

      // 2. Lock and verify department budget
      const deptBudget = this.state.departmentBudgets.find((b) => b.departmentId === persona?.departmentId);
      if (!deptBudget) {
        this.idempotencyStore.delete(cacheKey);
        return {
          status: 400,
          statusText: 'Bad Request',
          headers: { 'content-type': 'application/json' },
          data: { error: 'BudgetNotFound', message: 'No active department budget found', statusCode: 400 },
        };
      }

      // Calculate total cents and verify products stock
      let calculatedTotalCents = 0;
      const productsToUpdate: Array<{ product: (typeof this.state.products)[0]; quantity: number }> = [];

      for (const item of sortedItemInputs) {
        if (item.quantity <= 0) {
          this.idempotencyStore.delete(cacheKey);
          return {
            status: 400,
            statusText: 'Bad Request',
            headers: { 'content-type': 'application/json' },
            data: { error: 'InvalidQuantity', message: 'Item quantity must be greater than 0', statusCode: 400 },
          };
        }

        const prod = this.state.products.find((p) => p.id === item.productId);
        if (!prod) {
          this.idempotencyStore.delete(cacheKey);
          return {
            status: 422,
            statusText: 'Unprocessable Entity',
            headers: { 'content-type': 'application/json' },
            data: { error: 'ProductNotFound', message: `Product ${item.productId} not found`, statusCode: 422 },
          };
        }

        if (prod.stockQuantity < item.quantity) {
          this.idempotencyStore.delete(cacheKey);
          return {
            status: 422,
            statusText: 'Unprocessable Entity',
            headers: { 'content-type': 'application/json' },
            data: {
              error: 'InsufficientStock',
              message: `Insufficient stock for product '${prod.name}'. Requested ${item.quantity}, available ${prod.stockQuantity}`,
              statusCode: 422,
            },
          };
        }

        calculatedTotalCents += prod.priceCents * item.quantity;
        productsToUpdate.push({ product: prod, quantity: item.quantity });
      }

      // Check budget
      if (deptBudget.remainingCents < calculatedTotalCents) {
        this.idempotencyStore.delete(cacheKey);
        return {
          status: 422,
          statusText: 'Unprocessable Entity',
          headers: { 'content-type': 'application/json' },
          data: {
            error: 'InsufficientBudget',
            message: `Department budget exceeded. Remaining: $${(deptBudget.remainingCents / 100).toFixed(2)}, required: $${(calculatedTotalCents / 100).toFixed(2)}`,
            statusCode: 422,
          },
        };
      }

      // Atomic deduction
      deptBudget.remainingCents -= calculatedTotalCents;
      for (const update of productsToUpdate) {
        update.product.stockQuantity -= update.quantity;
      }

      // Auto-approval determination
      const autoApproveLimit = this.state.storeSettings.autoApproveLimitCents;
      const initialStatus = calculatedTotalCents < autoApproveLimit ? 'APPROVED' : 'PENDING_APPROVAL';

      const orderId = `ord-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const newOrder = {
        id: orderId,
        userId: persona!.id,
        departmentId: persona!.departmentId,
        totalCents: calculatedTotalCents,
        status: initialStatus as any,
        createdAt: new Date().toISOString(),
      };
      this.state.orders.push(newOrder);

      for (const update of productsToUpdate) {
        this.state.orderItems.push({
          id: `item-${Date.now()}-${Math.random()}`,
          orderId,
          productId: update.product.id,
          quantity: update.quantity,
          unitPriceCents: update.product.priceCents,
        });
      }

      const responsePayload = {
        success: true,
        orderId,
        status: initialStatus,
        totalCents: calculatedTotalCents,
        remainingBudgetCents: deptBudget.remainingCents,
        itemsCount: sortedItemInputs.length,
      };

      // Store in idempotency cache
      this.idempotencyStore.set(cacheKey, { status: 201, data: responsePayload, state: 'COMPLETED' });

      return {
        status: 201,
        statusText: 'Created',
        headers: { 'content-type': 'application/json' },
        data: responsePayload,
      };
    }

    // --- EMPLOYEE ORDER TRACKING (GET /api/orders) ---
    if (path === '/api/orders' && method === 'GET') {
      const userOrders = this.state.orders.filter((o) => o.userId === persona?.id);
      return {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: { success: true, count: userOrders.length, orders: userOrders },
      };
    }

    // --- EMPLOYEE SELF-SERVICE CANCELLATION (POST /api/orders/:id/cancel) ---
    const cancelMatch = path.match(/^\/api\/orders\/([^/]+)\/cancel$/);
    if (cancelMatch && method === 'POST') {
      const orderId = cancelMatch[1];
      const order = this.state.orders.find((o) => o.id === orderId);
      if (!order) {
        return {
          status: 404,
          statusText: 'Not Found',
          headers: { 'content-type': 'application/json' },
          data: { error: 'OrderNotFound', message: `Order ${orderId} does not exist`, statusCode: 404 },
        };
      }

      if (order.userId !== persona?.id && persona?.role !== 'ADMIN') {
        return {
          status: 403,
          statusText: 'Forbidden',
          headers: { 'content-type': 'application/json' },
          data: { error: 'Forbidden', message: 'Cannot cancel order belonging to another user', statusCode: 403 },
        };
      }

      if (order.status !== 'PENDING_APPROVAL') {
        return {
          status: 400,
          statusText: 'Bad Request',
          headers: { 'content-type': 'application/json' },
          data: {
            error: 'InvalidOrderState',
            message: `Orders in ${order.status} state cannot be self-cancelled`,
            statusCode: 400,
          },
        };
      }

      // Rollback stock & budget
      order.status = 'CANCELLED';
      const items = this.state.orderItems.filter((i) => i.orderId === orderId);
      for (const item of items) {
        const prod = this.state.products.find((p) => p.id === item.productId);
        if (prod) prod.stockQuantity += item.quantity;
      }
      const deptBudget = this.state.departmentBudgets.find((b) => b.departmentId === order.departmentId);
      if (deptBudget) deptBudget.remainingCents += order.totalCents;

      // Log audit
      this.state.auditLogs.push({
        id: `aud-${Date.now()}`,
        adminUserId: persona!.id,
        action: 'ORDER_CANCELLED',
        entityType: 'ORDER',
        entityId: orderId,
        oldValue: { status: 'PENDING_APPROVAL' },
        newValue: { status: 'CANCELLED' },
        createdAt: new Date().toISOString(),
      });

      return {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: { success: true, orderId, status: 'CANCELLED' },
      };
    }

    // --- MANAGER APPROVALS QUEUE (GET /api/admin/approvals) ---
    if (path === '/api/admin/approvals' && method === 'GET') {
      const pending = this.state.orders.filter(
        (o) => o.status === 'PENDING_APPROVAL' && (persona?.role === 'ADMIN' || o.departmentId === persona?.departmentId)
      );
      return {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: { success: true, count: pending.length, approvals: pending },
      };
    }

    // --- MANAGER DECISION (POST /api/orders/:id/approve) ---
    const approveMatch = path.match(/^\/api\/orders\/([^/]+)\/approve$/);
    if (approveMatch && method === 'POST') {
      if (persona?.role !== 'MANAGER' && persona?.role !== 'ADMIN') {
        return {
          status: 403,
          statusText: 'Forbidden',
          headers: { 'content-type': 'application/json' },
          data: { error: 'Forbidden', message: 'Only managers or admins can approve/reject orders', statusCode: 403 },
        };
      }

      const orderId = approveMatch[1];
      const order = this.state.orders.find((o) => o.id === orderId);
      if (!order) {
        return {
          status: 404,
          statusText: 'Not Found',
          headers: { 'content-type': 'application/json' },
          data: { error: 'OrderNotFound', message: `Order ${orderId} does not exist`, statusCode: 404 },
        };
      }

      if (order.status !== 'PENDING_APPROVAL') {
        return {
          status: 409,
          statusText: 'Conflict',
          headers: { 'content-type': 'application/json' },
          data: { error: 'OrderAlreadyResolved', message: `Order is already in state ${order.status}`, statusCode: 409 },
        };
      }

      const decision = options.body?.decision;
      const comment = options.body?.comment;

      if (decision === 'APPROVE') {
        order.status = 'APPROVED';
        this.state.auditLogs.push({
          id: `aud-${Date.now()}`,
          adminUserId: persona!.id,
          action: 'ORDER_APPROVED',
          entityType: 'ORDER',
          entityId: orderId,
          oldValue: { status: 'PENDING_APPROVAL' },
          newValue: { status: 'APPROVED', comment },
          createdAt: new Date().toISOString(),
        });
        return {
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
          data: { success: true, orderId, status: 'APPROVED' },
        };
      } else if (decision === 'REJECT') {
        if (!comment || typeof comment !== 'string' || comment.trim().length === 0) {
          return {
            status: 400,
            statusText: 'Bad Request',
            headers: { 'content-type': 'application/json' },
            data: { error: 'MissingRejectionReason', message: 'Rejection reason comment is required', statusCode: 400 },
          };
        }

        order.status = 'REJECTED';
        order.rejectionReason = comment;

        // Rollback stock & budget
        const items = this.state.orderItems.filter((i) => i.orderId === orderId);
        for (const item of items) {
          const prod = this.state.products.find((p) => p.id === item.productId);
          if (prod) prod.stockQuantity += item.quantity;
        }
        const deptBudget = this.state.departmentBudgets.find((b) => b.departmentId === order.departmentId);
        if (deptBudget) deptBudget.remainingCents += order.totalCents;

        this.state.auditLogs.push({
          id: `aud-${Date.now()}`,
          adminUserId: persona!.id,
          action: 'ORDER_REJECTED',
          entityType: 'ORDER',
          entityId: orderId,
          oldValue: { status: 'PENDING_APPROVAL' },
          newValue: { status: 'REJECTED', comment, refundedCents: order.totalCents },
          createdAt: new Date().toISOString(),
        });

        return {
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
          data: { success: true, orderId, status: 'REJECTED', comment },
        };
      }

      return {
        status: 400,
        statusText: 'Bad Request',
        headers: { 'content-type': 'application/json' },
        data: { error: 'InvalidDecision', message: "Decision must be either 'APPROVE' or 'REJECT'", statusCode: 400 },
      };
    }

    // --- ADMIN KPI DASHBOARD (GET /api/admin/kpis) ---
    if (path === '/api/admin/kpis' && method === 'GET') {
      const approvedOrders = this.state.orders.filter((o) => o.status === 'APPROVED');
      const spendMtdCents = approvedOrders.reduce((sum, o) => sum + o.totalCents, 0);
      const pendingCount = this.state.orders.filter((o) => o.status === 'PENDING_APPROVAL').length;
      const lowStockCount = this.state.products.filter((p) => p.stockQuantity <= 5).length;

      return {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: {
          success: true,
          spendMtdCents,
          pendingApprovalsCount: pendingCount,
          totalOrderVolume: this.state.orders.length,
          lowStockAlertCount: lowStockCount,
        },
      };
    }

    // --- ADMIN STOCK EDITOR (POST /api/admin/products/:id/stock) ---
    const stockMatch = path.match(/^\/api\/admin\/products\/([^/]+)\/stock$/);
    if (stockMatch && method === 'POST') {
      if (persona?.role !== 'ADMIN') {
        return {
          status: 403,
          statusText: 'Forbidden',
          headers: { 'content-type': 'application/json' },
          data: { error: 'Forbidden', message: 'Only admins can modify stock directly', statusCode: 403 },
        };
      }

      const prodId = stockMatch[1];
      const prod = this.state.products.find((p) => p.id === prodId);
      if (!prod) {
        return {
          status: 404,
          statusText: 'Not Found',
          headers: { 'content-type': 'application/json' },
          data: { error: 'ProductNotFound', message: `Product ${prodId} not found`, statusCode: 404 },
        };
      }

      const { newQuantity, delta, reason } = options.body || {};
      if (!reason || typeof reason !== 'string') {
        return {
          status: 400,
          statusText: 'Bad Request',
          headers: { 'content-type': 'application/json' },
          data: { error: 'MissingReason', message: 'Adjustment reason is required', statusCode: 400 },
        };
      }

      const oldStock = prod.stockQuantity;
      let targetStock = oldStock;

      if (typeof newQuantity === 'number') {
        targetStock = newQuantity;
      } else if (typeof delta === 'number') {
        targetStock = oldStock + delta;
      }

      if (targetStock < 0) {
        return {
          status: 400,
          statusText: 'Bad Request',
          headers: { 'content-type': 'application/json' },
          data: { error: 'NegativeStockError', message: 'Stock quantity cannot be less than 0', statusCode: 400 },
        };
      }

      prod.stockQuantity = targetStock;
      this.state.auditLogs.push({
        id: `aud-${Date.now()}`,
        adminUserId: persona!.id,
        action: 'STOCK_ADJUSTED',
        entityType: 'PRODUCT',
        entityId: prodId,
        oldValue: { stockQuantity: oldStock },
        newValue: { stockQuantity: targetStock, reason },
        createdAt: new Date().toISOString(),
      });

      return {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: { success: true, productId: prodId, oldStock, newStock: targetStock },
      };
    }

    // --- ADMIN PRODUCT CRUD (POST /api/admin/products, PUT, DELETE) ---
    if (path === '/api/admin/products' && method === 'POST') {
      const { name, description, priceCents, stockQuantity, categoryId, imageUrl } = options.body || {};
      if (!name || priceCents === undefined || priceCents < 0 || stockQuantity === undefined || stockQuantity < 0) {
        return {
          status: 422,
          statusText: 'Unprocessable Entity',
          headers: { 'content-type': 'application/json' },
          data: { error: 'ValidationError', message: 'Invalid product properties', statusCode: 422 },
        };
      }

      const newProd = {
        id: `prod-${Date.now()}`,
        name,
        description: description || '',
        priceCents,
        stockQuantity,
        categoryId: categoryId || 'cat-stationery',
        imageUrl: imageUrl || '',
        isActive: true,
      };
      this.state.products.push(newProd);

      this.state.auditLogs.push({
        id: `aud-${Date.now()}`,
        adminUserId: persona!.id,
        action: 'PRODUCT_CREATED',
        entityType: 'PRODUCT',
        entityId: newProd.id,
        oldValue: null,
        newValue: newProd,
        createdAt: new Date().toISOString(),
      });

      return {
        status: 201,
        statusText: 'Created',
        headers: { 'content-type': 'application/json' },
        data: { success: true, product: newProd },
      };
    }

    // --- ADMIN CATEGORIES (GET, POST /api/admin/categories) ---
    if (path === '/api/admin/categories' && method === 'GET') {
      return {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: { success: true, categories: this.state.categories },
      };
    }
    if (path === '/api/admin/categories' && method === 'POST') {
      const { name, slug, parentId } = options.body || {};
      if (!name || !slug) {
        return {
          status: 400,
          statusText: 'Bad Request',
          headers: { 'content-type': 'application/json' },
          data: { error: 'ValidationError', message: 'Category name and slug are required', statusCode: 400 },
        };
      }
      if (this.state.categories.some((c) => c.slug === slug)) {
        return {
          status: 409,
          statusText: 'Conflict',
          headers: { 'content-type': 'application/json' },
          data: { error: 'SlugConflict', message: `Category slug '${slug}' already exists`, statusCode: 409 },
        };
      }

      const newCat = { id: `cat-${Date.now()}`, name, slug, isActive: true, parentId: parentId || null };
      this.state.categories.push(newCat);
      return {
        status: 201,
        statusText: 'Created',
        headers: { 'content-type': 'application/json' },
        data: { success: true, category: newCat },
      };
    }

    // --- ADMIN STORE SETTINGS (GET, PUT /api/admin/store-config) ---
    if (path === '/api/admin/store-config' && method === 'GET') {
      return {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: { success: true, settings: this.state.storeSettings },
      };
    }
    if (path === '/api/admin/store-config' && method === 'PUT') {
      const { autoApproveLimitCents, companyName, primaryColor, logoUrl } = options.body || {};
      if (autoApproveLimitCents !== undefined && autoApproveLimitCents < 0) {
        return {
          status: 400,
          statusText: 'Bad Request',
          headers: { 'content-type': 'application/json' },
          data: { error: 'InvalidThreshold', message: 'Approval threshold cannot be negative', statusCode: 400 },
        };
      }
      if (primaryColor && !/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(primaryColor)) {
        return {
          status: 400,
          statusText: 'Bad Request',
          headers: { 'content-type': 'application/json' },
          data: { error: 'InvalidColor', message: 'Primary color must be valid hex code', statusCode: 400 },
        };
      }

      const oldSettings = { ...this.state.storeSettings };
      if (autoApproveLimitCents !== undefined) this.state.storeSettings.autoApproveLimitCents = autoApproveLimitCents;
      if (companyName !== undefined) this.state.storeSettings.companyName = companyName;
      if (primaryColor !== undefined) this.state.storeSettings.primaryColor = primaryColor;
      if (logoUrl !== undefined) this.state.storeSettings.logoUrl = logoUrl;

      this.state.auditLogs.push({
        id: `aud-${Date.now()}`,
        adminUserId: persona!.id,
        action: 'STORE_SETTINGS_UPDATED',
        entityType: 'STORE_SETTINGS',
        entityId: 'settings-global',
        oldValue: oldSettings,
        newValue: this.state.storeSettings,
        createdAt: new Date().toISOString(),
      });

      return {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: { success: true, settings: this.state.storeSettings },
      };
    }

    // --- ADMIN AUDIT LOGS (GET /api/admin/audit-logs) ---
    if (path === '/api/admin/audit-logs' && method === 'GET') {
      let logs = [...this.state.auditLogs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const entityType = options.query?.entityType as string;
      if (entityType) {
        logs = logs.filter((l) => l.entityType === entityType);
      }
      return {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: { success: true, count: logs.length, logs },
      };
    }
    if (path === '/api/admin/audit-logs' && (method === 'PUT' || method === 'DELETE')) {
      return {
        status: 405,
        statusText: 'Method Not Allowed',
        headers: { 'content-type': 'application/json', allow: 'GET' },
        data: { error: 'MethodNotAllowed', message: 'Audit logs are strictly immutable and append-only', statusCode: 405 },
      };
    }

    // --- CLOUDFLARE R2 PRESIGNED URL (POST /api/admin/uploads/presign) ---
    if (path === '/api/admin/uploads/presign' && method === 'POST') {
      const { filename, fileSizeBytes, contentType } = options.body || {};
      if (!filename || typeof filename !== 'string') {
        return {
          status: 400,
          statusText: 'Bad Request',
          headers: { 'content-type': 'application/json' },
          data: { error: 'MissingFilename', message: 'Filename is required', statusCode: 400 },
        };
      }
      if (fileSizeBytes && fileSizeBytes > 10 * 1024 * 1024) {
        return {
          status: 400,
          statusText: 'Bad Request',
          headers: { 'content-type': 'application/json' },
          data: { error: 'PayloadTooLarge', message: 'File size exceeds 10MB limit', statusCode: 400 },
        };
      }
      if (filename.endsWith('.exe') || filename.endsWith('.sh')) {
        return {
          status: 400,
          statusText: 'Bad Request',
          headers: { 'content-type': 'application/json' },
          data: { error: 'DisallowedFileType', message: 'Executable files are prohibited', statusCode: 400 },
        };
      }

      const key = `uploads/${Date.now()}-${filename}`;
      const presignedUrl = `https://r2.mock-storage.local/${key}?sig=valid_mock_signature&expires=900`;
      return {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: { success: true, key, presignedUrl, expiresInSeconds: 900 },
      };
    }

    // --- QSTASH WORKERS (HMAC Signature Check) ---
    if (path.startsWith('/api/workers/')) {
      const sig = options.headers?.['upstash-signature'] || options.rawSignature;
      if (!sig || sig === 'invalid_signature') {
        return {
          status: 401,
          statusText: 'Unauthorized',
          headers: { 'content-type': 'application/json' },
          data: { error: 'InvalidSignature', message: 'Missing or invalid QStash HMAC signature', statusCode: 401 },
        };
      }

      if (path === '/api/workers/csv-import' && method === 'POST') {
        const { rows, fileKey } = options.body || {};
        if (!rows && !fileKey) {
          return {
            status: 400,
            statusText: 'Bad Request',
            headers: { 'content-type': 'application/json' },
            data: { error: 'MissingImportSource', message: 'Must provide either rows or fileKey', statusCode: 400 },
          };
        }

        const inputRows = rows || [];
        let inserted = 0;
        let updated = 0;
        const errors: Array<{ rowNumber: number; reason: string }> = [];

        inputRows.forEach((row: any, idx: number) => {
          const rowNum = idx + 1;
          if (!row.name || typeof row.priceCents !== 'number' || row.priceCents < 0) {
            errors.push({ rowNumber: rowNum, reason: 'Invalid name or price' });
            return;
          }
          if (typeof row.stockQuantity !== 'number' || row.stockQuantity < 0) {
            errors.push({ rowNumber: rowNum, reason: 'Negative stock quantity' });
            return;
          }

          const existing = this.state.products.find((p) => p.name === row.name);
          if (existing) {
            existing.priceCents = row.priceCents;
            existing.stockQuantity = row.stockQuantity;
            updated++;
          } else {
            this.state.products.push({
              id: `prod-csv-${Date.now()}-${idx}`,
              name: row.name,
              description: row.description || '',
              priceCents: row.priceCents,
              stockQuantity: row.stockQuantity,
              categoryId: row.categoryId || 'cat-stationery',
              imageUrl: row.imageUrl || '',
              isActive: true,
            });
            inserted++;
          }
        });

        return {
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
          data: {
            success: true,
            totalRows: inputRows.length,
            insertedCount: inserted,
            updatedCount: updated,
            errorsCount: errors.length,
            errors,
          },
        };
      }

      if (path === '/api/workers/notifications' && method === 'POST') {
        const { recipient, template, templateVariables } = options.body || {};
        if (!recipient || !template) {
          return {
            status: 400,
            statusText: 'Bad Request',
            headers: { 'content-type': 'application/json' },
            data: { error: 'InvalidNotification', message: 'Recipient and template are required', statusCode: 400 },
          };
        }
        return {
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
          data: { success: true, dispatched: true, recipient, template },
        };
      }

      if (path === '/api/workers/audit-log' && method === 'POST') {
        const { adminUserId, action, entityType, entityId, oldValue, newValue } = options.body || {};
        if (!action || !entityType || !entityId) {
          return {
            status: 400,
            statusText: 'Bad Request',
            headers: { 'content-type': 'application/json' },
            data: { error: 'InvalidAuditPayload', message: 'Action, entityType, entityId required', statusCode: 400 },
          };
        }

        const auditEntry = {
          id: `aud-async-${Date.now()}`,
          adminUserId: adminUserId || null,
          action,
          entityType,
          entityId,
          oldValue: oldValue || null,
          newValue: newValue || null,
          createdAt: new Date().toISOString(),
        };
        this.state.auditLogs.push(auditEntry);

        return {
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
          data: { success: true, auditLogId: auditEntry.id },
        };
      }
    }

    // Default 404
    return {
      status: 404,
      statusText: 'Not Found',
      headers: { 'content-type': 'application/json' },
      data: { error: 'RouteNotFound', message: `No route matching ${method} ${path}`, statusCode: 404 },
    };
  }
}

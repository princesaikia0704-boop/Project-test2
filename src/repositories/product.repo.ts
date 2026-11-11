/**
 * Corporate Office Store - Product Repository
 * Supports dual-mode execution (Live Neon PostgreSQL with row-level locks vs in-memory MockDataStore).
 */

import { asc, desc, eq, and, ilike, or, inArray, sql } from "drizzle-orm";
import { db, schema, mockDataStore } from "@/lib/db";
import { Product, NewProduct } from "@/lib/db/schema";
import { isDatabaseMocked } from "@/lib/mock/utils";

export interface ListProductsOptions {
  categoryId?: string;
  search?: string;
  isActive?: boolean;
  lowStockOnly?: boolean;
  limit?: number;
  offset?: number;
  sort?: "price-asc" | "price-desc" | "name-asc" | "newest";
}

export interface IProductRepository {
  findById(id: string, tx?: any): Promise<Product | null>;
  listActive(options?: ListProductsOptions): Promise<{ products: Product[]; total: number }>;
  updateStock(productId: string, delta: number, tx?: any): Promise<Product>;
  setAbsoluteStock(productId: string, newStock: number, tx?: any): Promise<Product>;
  search(query: string, options?: { limit?: number; offset?: number }): Promise<Product[]>;
  filterByCategory(categoryId: string, options?: { limit?: number; offset?: number }): Promise<Product[]>;
  batchFindByIds(productIds: string[], sortAscending?: boolean, tx?: any): Promise<Product[]>;
  findLowStockProducts(): Promise<Product[]>;
  create(product: Omit<NewProduct, "id" | "createdAt" | "updatedAt">, tx?: any): Promise<Product>;
  update(id: string, data: Partial<NewProduct>, tx?: any): Promise<Product>;
  delete(id: string, tx?: any): Promise<boolean>;
}

export class ProductRepository implements IProductRepository {
  async findById(id: string, tx?: any): Promise<Product | null> {
    if (isDatabaseMocked()) {
      return (mockDataStore.getProductById(id) as unknown as Product) ?? null;
    }

    const client = tx || db;
    const rows = await client
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, id))
      .limit(1);

    return rows[0] ?? null;
  }

  async listActive(options?: ListProductsOptions): Promise<{ products: Product[]; total: number }> {
    if (isDatabaseMocked()) {
      const result = mockDataStore.getProducts(options);
      return {
        products: result.products as unknown as Product[],
        total: result.total,
      };
    }

    const conditions: any[] = [];
    if (options?.isActive !== undefined) {
      conditions.push(eq(schema.products.isActive, options.isActive));
    }
    if (options?.categoryId) {
      conditions.push(eq(schema.products.categoryId, options.categoryId));
    }
    if (options?.search) {
      const q = `%${options.search}%`;
      conditions.push(
        or(
          ilike(schema.products.name, q),
          ilike(schema.products.description, q),
          ilike(schema.products.sku, q)
        )
      );
    }
    if (options?.lowStockOnly) {
      conditions.push(sql`${schema.products.stockQuantity} <= ${schema.products.lowStockThreshold}`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    let orderByClause: any = asc(schema.products.name);
    if (options?.sort === "price-asc") orderByClause = asc(schema.products.priceCents);
    else if (options?.sort === "price-desc") orderByClause = desc(schema.products.priceCents);
    else if (options?.sort === "newest") orderByClause = desc(schema.products.createdAt);

    const query = db.select().from(schema.products);
    if (whereClause) query.where(whereClause);
    query.orderBy(orderByClause);

    if (options?.limit) query.limit(options.limit);
    if (options?.offset) query.offset(options.offset);

    const products = await query;

    const countQuery = db.select({ count: sql<number>`count(*)` }).from(schema.products);
    if (whereClause) countQuery.where(whereClause);
    const countResult = await countQuery;
    const total = Number(countResult[0]?.count || products.length);

    return { products, total };
  }

  async updateStock(productId: string, delta: number, tx?: any): Promise<Product> {
    if (isDatabaseMocked()) {
      return mockDataStore.updateStock(productId, delta) as unknown as Product;
    }

    const client = tx || db;
    const rows = await client
      .update(schema.products)
      .set({
        stockQuantity: sql`${schema.products.stockQuantity} + ${delta}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.products.id, productId),
          sql`${schema.products.stockQuantity} + ${delta} >= 0`
        )
      )
      .returning();

    if (!rows || rows.length === 0) {
      throw new Error(`INSUFFICIENT_STOCK: Could not adjust product ${productId} by delta ${delta}`);
    }

    return rows[0];
  }

  async setAbsoluteStock(productId: string, newStock: number, tx?: any): Promise<Product> {
    if (isDatabaseMocked()) {
      const p = mockDataStore.getProductById(productId);
      if (!p) throw new Error(`Product not found: ${productId}`);
      return mockDataStore.updateProduct(productId, { stockQuantity: newStock }) as unknown as Product;
    }

    const client = tx || db;
    const rows = await client
      .update(schema.products)
      .set({
        stockQuantity: newStock,
        updatedAt: new Date(),
      })
      .where(eq(schema.products.id, productId))
      .returning();

    if (!rows || rows.length === 0) {
      throw new Error(`Product not found: ${productId}`);
    }

    return rows[0];
  }

  async search(query: string, options?: { limit?: number; offset?: number }): Promise<Product[]> {
    if (isDatabaseMocked()) {
      const result = mockDataStore.getProducts({ search: query, limit: options?.limit, offset: options?.offset });
      return result.products as unknown as Product[];
    }

    if (!query || query.trim() === "") {
      const allActive = await this.listActive({ limit: options?.limit, offset: options?.offset });
      return allActive.products;
    }

    const q = `%${query.trim()}%`;
    const rows = await db
      .select()
      .from(schema.products)
      .where(
        and(
          eq(schema.products.isActive, true),
          or(
            ilike(schema.products.name, q),
            ilike(schema.products.description, q),
            ilike(schema.products.sku, q)
          )
        )
      )
      .limit(options?.limit ?? 50)
      .offset(options?.offset ?? 0);

    return rows;
  }

  async filterByCategory(categoryId: string, options?: { limit?: number; offset?: number }): Promise<Product[]> {
    const result = await this.listActive({
      categoryId,
      isActive: true,
      limit: options?.limit,
      offset: options?.offset,
    });
    return result.products;
  }

  async batchFindByIds(productIds: string[], sortAscending = true, tx?: any): Promise<Product[]> {
    if (productIds.length === 0) return [];

    // Deduplicate and sort IDs deterministically to prevent PostgreSQL deadlocks
    const uniqueIds = Array.from(new Set(productIds));
    if (sortAscending) {
      uniqueIds.sort((a, b) => a.localeCompare(b));
    }

    if (isDatabaseMocked()) {
      const products: Product[] = [];
      for (const id of uniqueIds) {
        const p = mockDataStore.getProductById(id);
        if (p) products.push(p as unknown as Product);
      }
      return products;
    }

    const client = tx || db;

    if (tx) {
      // Enforce transaction timeouts before row lock acquisition
      await tx.execute(sql`SET LOCAL lock_timeout = '2s';`);
      await tx.execute(sql`SET LOCAL statement_timeout = '5s';`);
      return await tx
        .select()
        .from(schema.products)
        .where(inArray(schema.products.id, uniqueIds))
        .orderBy(asc(schema.products.id))
        .for("update");
    }

    return await client
      .select()
      .from(schema.products)
      .where(inArray(schema.products.id, uniqueIds))
      .orderBy(asc(schema.products.id));
  }

  async findLowStockProducts(): Promise<Product[]> {
    const result = await this.listActive({ lowStockOnly: true, isActive: true });
    return result.products;
  }

  async create(product: Omit<NewProduct, "id" | "createdAt" | "updatedAt">, tx?: any): Promise<Product> {
    if (isDatabaseMocked()) {
      return mockDataStore.createProduct(product as any) as unknown as Product;
    }

    const client = tx || db;
    const rows = await client.insert(schema.products).values(product).returning();
    return rows[0];
  }

  async update(id: string, data: Partial<NewProduct>, tx?: any): Promise<Product> {
    if (isDatabaseMocked()) {
      return mockDataStore.updateProduct(id, data as any) as unknown as Product;
    }

    const client = tx || db;
    const rows = await client
      .update(schema.products)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.products.id, id))
      .returning();

    if (!rows || rows.length === 0) {
      throw new Error(`Product not found: ${id}`);
    }

    return rows[0];
  }

  async delete(id: string, tx?: any): Promise<boolean> {
    if (isDatabaseMocked()) {
      return mockDataStore.deleteProduct(id);
    }

    const client = tx || db;
    const rows = await client
      .delete(schema.products)
      .where(eq(schema.products.id, id))
      .returning();

    return rows.length > 0;
  }
}

export const productRepo = new ProductRepository();

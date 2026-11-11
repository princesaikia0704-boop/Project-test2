/**
 * Corporate Office Store - Category Repository
 * Manages product hierarchy, tree parent mapping, and display ordering.
 */

import { asc, eq } from "drizzle-orm";
import { db, schema, mockDataStore } from "@/lib/db";
import { Category, NewCategory } from "@/lib/db/schema";
import { isDatabaseMocked } from "@/lib/mock/utils";

export interface ICategoryRepository {
  listCategories(filter?: { isActive?: boolean }): Promise<Category[]>;
  findById(id: string): Promise<Category | null>;
  createCategory(data: Omit<NewCategory, "id" | "createdAt" | "updatedAt">): Promise<Category>;
  updateCategory(id: string, data: Partial<NewCategory>): Promise<Category>;
}

export class CategoryRepository implements ICategoryRepository {
  async listCategories(filter?: { isActive?: boolean }): Promise<Category[]> {
    if (isDatabaseMocked()) {
      return mockDataStore.getCategories(filter) as unknown as Category[];
    }

    const query = db.select().from(schema.categories);
    if (filter?.isActive !== undefined) {
      query.where(eq(schema.categories.isActive, filter.isActive));
    }
    query.orderBy(asc(schema.categories.sortOrder), asc(schema.categories.name));

    return await query;
  }

  async findById(id: string): Promise<Category | null> {
    if (isDatabaseMocked()) {
      return (mockDataStore.getCategoryById(id) as unknown as Category) ?? null;
    }

    const rows = await db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.id, id))
      .limit(1);

    return rows[0] ?? null;
  }

  async createCategory(data: Omit<NewCategory, "id" | "createdAt" | "updatedAt">): Promise<Category> {
    if (isDatabaseMocked()) {
      return mockDataStore.createCategory(data as any) as unknown as Category;
    }

    const [created] = await db.insert(schema.categories).values(data).returning();
    return created;
  }

  async updateCategory(id: string, data: Partial<NewCategory>): Promise<Category> {
    if (isDatabaseMocked()) {
      return mockDataStore.updateCategory(id, data as any) as unknown as Category;
    }

    const [updated] = await db
      .update(schema.categories)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.categories.id, id))
      .returning();

    if (!updated) {
      throw new Error(`Category not found: ${id}`);
    }

    return updated;
  }
}

export const categoryRepo = new CategoryRepository();

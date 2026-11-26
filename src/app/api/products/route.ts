import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiReliability, createErrorResponse } from "@/lib/http/api-handler";
import { productRepo } from "@/repositories/product.repo";
import { categoryRepo } from "@/repositories/category.repo";

const productQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: z
    .string()
    .trim()
    .max(120)
    .regex(/^[a-z0-9-]+$/i, "Invalid category filter")
    .optional(),
  sort: z.enum(["price-asc", "price-desc", "name-asc", "newest"]).optional(),
});

export const GET = withApiReliability(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const parsed = productQuerySchema.safeParse({
    q: searchParams.get("q") || undefined,
    category: searchParams.get("category") || undefined,
    sort: searchParams.get("sort") || undefined,
  });

  if (!parsed.success) {
    return createErrorResponse(
      "ValidationError",
      parsed.error.issues[0]?.message || "Invalid catalog filter parameters",
      400
    );
  }

  const { q: query, category: categorySlug, sort } = parsed.data;
  let targetCategoryId: string | undefined;

  if (categorySlug) {
    const categories = await categoryRepo.listCategories();
    const matchedCat = categories.find(
      (c) => c.slug.toLowerCase() === categorySlug.toLowerCase()
    );

    if (!matchedCat) {
      return NextResponse.json(
        {
          success: true,
          count: 0,
          products: [],
        },
        { status: 200 }
      );
    }

    const childCategories = categories.filter((c) => c.parentId === matchedCat.id);
    if (childCategories.length === 0) {
      targetCategoryId = matchedCat.id;
    } else {
      const allowedIds = [matchedCat.id, ...childCategories.map((c) => c.id)];
      const { products } = await productRepo.listActive({
        isActive: true,
        search: query || undefined,
        sort: sort || undefined,
      });

      const filtered = products.filter((p) => allowedIds.includes(p.categoryId));
      return NextResponse.json(
        {
          success: true,
          count: filtered.length,
          products: filtered,
        },
        { status: 200 }
      );
    }
  }

  const { products } = await productRepo.listActive({
    isActive: true,
    categoryId: targetCategoryId,
    search: query || undefined,
    sort: sort || undefined,
  });

  return NextResponse.json(
    {
      success: true,
      count: products.length,
      products,
    },
    { status: 200 }
  );
});

import { NextRequest, NextResponse } from "next/server";
import { withApiReliability } from "@/lib/http/api-handler";
import { productRepo } from "@/repositories/product.repo";
import { categoryRepo } from "@/repositories/category.repo";

export const GET = withApiReliability(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || undefined;
    const categorySlug = searchParams.get("category") || undefined;
    const sort = searchParams.get("sort") as "price-asc" | "price-desc" | "name-asc" | "newest" | null;

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

      // Check if there are child categories
      const childCategories = categories.filter((c) => c.parentId === matchedCat.id);
      if (childCategories.length === 0) {
        targetCategoryId = matchedCat.id;
      } else {
        // Multi-category search
        const allowedIds = [matchedCat.id, ...childCategories.map((c) => c.id)];
        const { products } = await productRepo.listActive({
          isActive: true,
          search: query?.trim() || undefined,
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
      search: query?.trim() || undefined,
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
  }
);

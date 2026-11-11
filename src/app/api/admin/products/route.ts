import { NextRequest, NextResponse } from "next/server";
import { withApiReliability, createErrorResponse } from "@/lib/http/api-handler";
import { productRepo } from "@/repositories/product.repo";

export const GET = withApiReliability(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || undefined;
    const categoryId = searchParams.get("categoryId") || undefined;
    const lowStockOnly = searchParams.get("lowStockOnly") === "true";

    const { products } = await productRepo.listActive({
      search: q,
      categoryId,
      lowStockOnly,
    });

    return NextResponse.json(
      {
        success: true,
        count: products.length,
        products,
      },
      { status: 200 }
    );
  },
  { allowedRoles: ["ADMIN"] }
);

export const POST = withApiReliability(
  async (req: NextRequest) => {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return createErrorResponse(
        "ValidationError",
        "Request body must be valid JSON",
        422
      );
    }

    if (!body || typeof body !== "object") {
      return createErrorResponse(
        "ValidationError",
        "Product payload is required",
        422
      );
    }

    if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
      return createErrorResponse(
        "ValidationError",
        "Product name is required",
        422
      );
    }

    if (typeof body.priceCents !== "number" || body.priceCents < 0) {
      return createErrorResponse(
        "ValidationError",
        "Price must be non-negative",
        422
      );
    }

    if (
      body.stockQuantity !== undefined &&
      (typeof body.stockQuantity !== "number" || body.stockQuantity < 0)
    ) {
      return createErrorResponse(
        "ValidationError",
        "Stock quantity cannot be negative",
        422
      );
    }

    const createdProduct = await productRepo.create({
      name: body.name.trim(),
      description: body.description ?? "",
      sku: body.sku ?? null,
      priceCents: body.priceCents,
      stockQuantity: body.stockQuantity ?? 0,
      lowStockThreshold: body.lowStockThreshold ?? 5,
      categoryId: body.categoryId || "cat-stationery",
      imageUrl: body.imageUrl ?? null,
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
    });

    return NextResponse.json(
      {
        success: true,
        product: createdProduct,
      },
      { status: 201 }
    );
  },
  { allowedRoles: ["ADMIN"] }
);

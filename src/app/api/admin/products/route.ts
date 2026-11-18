import { NextRequest, NextResponse } from "next/server";
import { withApiReliability, createErrorResponse } from "@/lib/http/api-handler";
import { productRepo } from "@/repositories/product.repo";
import { auditRepo } from "@/repositories/audit.repo";

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
  { allowedRoles: ["ADMIN", "MANAGER"] }
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

    const adminUserId =
      req.headers.get("x-user-id") ||
      req.cookies.get("mock_persona")?.value ||
      "user-dave-adm";

    try {
      await auditRepo.record({
        adminUserId,
        action: "CREATE",
        entityType: "PRODUCT",
        entityId: createdProduct.id,
        oldValue: null,
        newValue: JSON.stringify({
          name: createdProduct.name,
          priceCents: createdProduct.priceCents,
          stockQuantity: createdProduct.stockQuantity,
          categoryId: createdProduct.categoryId,
          sku: createdProduct.sku,
        }),
      });
    } catch (auditErr) {
      console.error("Failed to write audit log for product creation:", auditErr);
    }

    return NextResponse.json(
      {
        success: true,
        product: createdProduct,
      },
      { status: 201 }
    );
  },
  { allowedRoles: ["ADMIN", "MANAGER"] }
);

export const PATCH = withApiReliability(
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

    if (!body.id || typeof body.id !== "string") {
      return createErrorResponse(
        "ValidationError",
        "Product ID is required",
        422
      );
    }

    if (
      body.priceCents !== undefined &&
      (typeof body.priceCents !== "number" || body.priceCents < 0)
    ) {
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

    const updateData: any = {};
    if (body.name !== undefined) updateData.name = String(body.name).trim();
    if (body.description !== undefined) updateData.description = body.description;
    if (body.sku !== undefined) updateData.sku = body.sku;
    if (body.priceCents !== undefined) updateData.priceCents = body.priceCents;
    if (body.categoryId !== undefined) updateData.categoryId = body.categoryId;
    if (body.stockQuantity !== undefined) updateData.stockQuantity = body.stockQuantity;
    if (body.lowStockThreshold !== undefined) updateData.lowStockThreshold = body.lowStockThreshold;
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl;
    if (body.isActive !== undefined) updateData.isActive = Boolean(body.isActive);

    try {
      const existingProduct = await productRepo.findById(body.id);

      const updatedProduct = await productRepo.update(body.id, updateData);

      const adminUserId =
        req.headers.get("x-user-id") ||
        req.cookies.get("mock_persona")?.value ||
        "user-dave-adm";

      try {
        await auditRepo.record({
          adminUserId,
          action: "UPDATE",
          entityType: "PRODUCT",
          entityId: updatedProduct.id,
          oldValue: existingProduct
            ? JSON.stringify({
                name: existingProduct.name,
                priceCents: existingProduct.priceCents,
                stockQuantity: existingProduct.stockQuantity,
                isActive: existingProduct.isActive,
              })
            : null,
          newValue: JSON.stringify({
            name: updatedProduct.name,
            priceCents: updatedProduct.priceCents,
            stockQuantity: updatedProduct.stockQuantity,
            isActive: updatedProduct.isActive,
          }),
        });
      } catch (auditErr) {
        console.error("Failed to write audit log for product update:", auditErr);
      }

      return NextResponse.json(
        {
          success: true,
          product: updatedProduct,
        },
        { status: 200 }
      );
    } catch (err: any) {
      if (err.message && err.message.includes("not found")) {
        return createErrorResponse(
          "ProductNotFound",
          `Product with ID '${body.id}' not found`,
          404
        );
      }
      throw err;
    }
  },
  { allowedRoles: ["ADMIN", "MANAGER"] }
);

export const DELETE = withApiReliability(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    let id = searchParams.get("id");
    if (!id) {
      try {
        const body = await req.json();
        id = body?.id;
      } catch {
        // ignore json parse error
      }
    }

    if (!id || typeof id !== "string") {
      return createErrorResponse(
        "ValidationError",
        "Product ID is required for deletion",
        422
      );
    }

    const existingProduct = await productRepo.findById(id);
    if (!existingProduct) {
      return createErrorResponse(
        "ProductNotFound",
        `Product with ID '${id}' not found`,
        404
      );
    }

    await productRepo.delete(id);

    const adminUserId =
      req.headers.get("x-user-id") ||
      req.cookies.get("mock_persona")?.value ||
      "user-dave-adm";

    try {
      await auditRepo.record({
        adminUserId,
        action: "DELETE",
        entityType: "PRODUCT",
        entityId: id,
        oldValue: JSON.stringify({
          name: existingProduct.name,
          sku: existingProduct.sku,
          priceCents: existingProduct.priceCents,
          stockQuantity: existingProduct.stockQuantity,
        }),
        newValue: null,
      });
    } catch (auditErr) {
      console.error("Failed to write audit log for product deletion:", auditErr);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Product deleted successfully",
      },
      { status: 200 }
    );
  },
  { allowedRoles: ["ADMIN", "MANAGER"] }
);

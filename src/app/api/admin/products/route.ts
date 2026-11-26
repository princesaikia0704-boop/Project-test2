import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiReliability, createErrorResponse, getRequestAuth } from "@/lib/http/api-handler";
import { productRepo } from "@/repositories/product.repo";
import { auditRepo } from "@/repositories/audit.repo";
import { createProductSchema, updateProductSchema } from "@/lib/validators/product.schema";
import { safeIdentifierSchema } from "@/lib/validators/order.schema";

const adminProductsQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  categoryId: safeIdentifierSchema.optional(),
  lowStockOnly: z.boolean().optional(),
});

export const GET = withApiReliability(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const parsed = adminProductsQuerySchema.safeParse({
      q: searchParams.get("q") || undefined,
      categoryId: searchParams.get("categoryId") || undefined,
      lowStockOnly: searchParams.get("lowStockOnly") === "true",
    });

    if (!parsed.success) {
      return createErrorResponse(
        "ValidationError",
        parsed.error.issues[0]?.message || "Invalid query parameters",
        400
      );
    }

    const { products } = await productRepo.listActive({
      search: parsed.data.q,
      categoryId: parsed.data.categoryId,
      lowStockOnly: parsed.data.lowStockOnly,
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
    const authUser = await getRequestAuth(req);
    if (!authUser) {
      return createErrorResponse("Unauthorized", "Authentication required", 401);
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return createErrorResponse(
        "ValidationError",
        "Request body must be valid JSON",
        422
      );
    }

    const parsed = createProductSchema.safeParse(rawBody);
    if (!parsed.success) {
      return createErrorResponse(
        "ValidationError",
        parsed.error.issues[0]?.message || "Invalid product payload",
        422
      );
    }

    const data = parsed.data;
    const createdProduct = await productRepo.create({
      name: data.name,
      description: data.description,
      sku: data.sku ?? null,
      priceCents: data.priceCents,
      stockQuantity: data.stockQuantity,
      lowStockThreshold: data.lowStockThreshold,
      categoryId: data.categoryId,
      imageUrl: data.imageUrl || null,
      isActive: data.isActive,
    });

    try {
      await auditRepo.record({
        adminUserId: authUser.id,
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
      console.error("Failed to write audit log for product creation");
    }

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

export const PATCH = withApiReliability(
  async (req: NextRequest) => {
    const authUser = await getRequestAuth(req);
    if (!authUser) {
      return createErrorResponse("Unauthorized", "Authentication required", 401);
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return createErrorResponse(
        "ValidationError",
        "Request body must be valid JSON",
        422
      );
    }

    const parsed = updateProductSchema.safeParse(rawBody);
    if (!parsed.success) {
      return createErrorResponse(
        "ValidationError",
        parsed.error.issues[0]?.message || "Invalid product update payload",
        422
      );
    }

    const { id, ...fields } = parsed.data;
    const updateData: Record<string, unknown> = {};
    if (fields.name !== undefined) updateData.name = fields.name;
    if (fields.description !== undefined) updateData.description = fields.description;
    if (fields.sku !== undefined) updateData.sku = fields.sku;
    if (fields.priceCents !== undefined) updateData.priceCents = fields.priceCents;
    if (fields.categoryId !== undefined) updateData.categoryId = fields.categoryId;
    if (fields.stockQuantity !== undefined) updateData.stockQuantity = fields.stockQuantity;
    if (fields.lowStockThreshold !== undefined) updateData.lowStockThreshold = fields.lowStockThreshold;
    if (fields.imageUrl !== undefined) updateData.imageUrl = fields.imageUrl || null;
    if (fields.isActive !== undefined) updateData.isActive = fields.isActive;

    try {
      const existingProduct = await productRepo.findById(id);
      if (!existingProduct) {
        return createErrorResponse("ProductNotFound", "Product not found", 404);
      }

      const updatedProduct = await productRepo.update(id, updateData);

      try {
        await auditRepo.record({
          adminUserId: authUser.id,
          action: "UPDATE",
          entityType: "PRODUCT",
          entityId: updatedProduct.id,
          oldValue: JSON.stringify({
            name: existingProduct.name,
            priceCents: existingProduct.priceCents,
            stockQuantity: existingProduct.stockQuantity,
            isActive: existingProduct.isActive,
          }),
          newValue: JSON.stringify({
            name: updatedProduct.name,
            priceCents: updatedProduct.priceCents,
            stockQuantity: updatedProduct.stockQuantity,
            isActive: updatedProduct.isActive,
          }),
        });
      } catch {
        console.error("Failed to write audit log for product update");
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
        return createErrorResponse("ProductNotFound", "Product not found", 404);
      }
      throw err;
    }
  },
  { allowedRoles: ["ADMIN"] }
);

export const DELETE = withApiReliability(
  async (req: NextRequest) => {
    const authUser = await getRequestAuth(req);
    if (!authUser) {
      return createErrorResponse("Unauthorized", "Authentication required", 401);
    }

    const { searchParams } = new URL(req.url);
    let rawId = searchParams.get("id");
    if (!rawId) {
      try {
        const body = await req.json();
        rawId = body?.id;
      } catch {
        // ignore parse error
      }
    }

    const idCheck = safeIdentifierSchema.safeParse(rawId);
    if (!idCheck.success) {
      return createErrorResponse(
        "ValidationError",
        "Valid product ID is required for deletion",
        422
      );
    }
    const id = idCheck.data;

    const existingProduct = await productRepo.findById(id);
    if (!existingProduct) {
      return createErrorResponse("ProductNotFound", "Product not found", 404);
    }

    try {
      await productRepo.delete(id);
    } catch (err: any) {
      // Handle foreign-key references cleanly instead of leaking DB error details
      if (err?.code === "23503" || /foreign key|constraint/i.test(err?.message || "")) {
        return createErrorResponse(
          "ProductInUse",
          "Cannot delete product referenced by existing orders; deactivate it instead.",
          409
        );
      }
      throw err;
    }

    try {
      await auditRepo.record({
        adminUserId: authUser.id,
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
    } catch {
      console.error("Failed to write audit log for product deletion");
    }

    return NextResponse.json(
      {
        success: true,
        message: "Product deleted successfully",
      },
      { status: 200 }
    );
  },
  { allowedRoles: ["ADMIN"] }
);

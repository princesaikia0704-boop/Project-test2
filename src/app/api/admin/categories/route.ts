import { NextRequest, NextResponse } from "next/server";
import { withApiReliability, createErrorResponse, getRequestAuth } from "@/lib/http/api-handler";
import { categoryRepo } from "@/repositories/category.repo";
import { categorySchema, updateCategorySchema } from "@/lib/validators/store-config.schema";
import { auditRepo } from "@/repositories/audit.repo";

export const GET = withApiReliability(
  async () => {
    const categories = await categoryRepo.listCategories();
    return NextResponse.json(
      {
        success: true,
        categories,
      },
      { status: 200 }
    );
  },
  { allowedRoles: ["EMPLOYEE", "MANAGER", "ADMIN"] }
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
        400
      );
    }

    const parsed = categorySchema.safeParse(rawBody);
    if (!parsed.success) {
      return createErrorResponse(
        "ValidationError",
        parsed.error.issues[0]?.message || "Invalid category payload",
        400
      );
    }

    const { name: cleanName, slug: cleanSlug, parentId, isActive, sortOrder } = parsed.data;

    const existingCategories = await categoryRepo.listCategories();
    const slugConflict = existingCategories.some(
      (c) => c.slug.toLowerCase() === cleanSlug.toLowerCase()
    );

    if (slugConflict) {
      return createErrorResponse(
        "SlugConflict",
        `Category slug '${cleanSlug}' already exists`,
        409
      );
    }

    const category = await categoryRepo.createCategory({
      name: cleanName,
      slug: cleanSlug,
      parentId: parentId || null,
      isActive,
      sortOrder,
    });

    try {
      await auditRepo.record({
        adminUserId: authUser.id,
        action: "CREATE",
        entityType: "CATEGORY",
        entityId: category.id,
        oldValue: null,
        newValue: JSON.stringify({ name: category.name, slug: category.slug }),
      });
    } catch {
      // non-fatal
    }

    return NextResponse.json(
      {
        success: true,
        category,
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
        400
      );
    }

    const parsed = updateCategorySchema.safeParse(rawBody);
    if (!parsed.success) {
      return createErrorResponse(
        "ValidationError",
        parsed.error.issues[0]?.message || "Invalid category update payload",
        400
      );
    }

    const { id, name, slug, parentId, isActive, sortOrder } = parsed.data;

    if (parentId && parentId === id) {
      return createErrorResponse(
        "ValidationError",
        "Category cannot be its own parent",
        400
      );
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) {
      const existingCategories = await categoryRepo.listCategories();
      const slugConflict = existingCategories.some(
        (c) => c.id !== id && c.slug.toLowerCase() === slug.toLowerCase()
      );
      if (slugConflict) {
        return createErrorResponse(
          "SlugConflict",
          `Category slug '${slug}' already exists`,
          409
        );
      }
      updateData.slug = slug;
    }
    if (parentId !== undefined) updateData.parentId = parentId;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

    try {
      const updatedCategory = await categoryRepo.updateCategory(id, updateData);
      try {
        await auditRepo.record({
          adminUserId: authUser.id,
          action: "UPDATE",
          entityType: "CATEGORY",
          entityId: id,
          oldValue: null,
          newValue: JSON.stringify(updateData),
        });
      } catch {
        // non-fatal
      }
      return NextResponse.json(
        {
          success: true,
          category: updatedCategory,
        },
        { status: 200 }
      );
    } catch (err: any) {
      if (err.message && err.message.includes("not found")) {
        return createErrorResponse(
          "CategoryNotFound",
          `Category with ID '${id}' not found`,
          404
        );
      }
      throw err;
    }
  },
  { allowedRoles: ["ADMIN"] }
);

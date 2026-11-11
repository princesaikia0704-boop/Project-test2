import { NextRequest, NextResponse } from "next/server";
import { withApiReliability, createErrorResponse } from "@/lib/http/api-handler";
import { categoryRepo } from "@/repositories/category.repo";

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
    let body: any;
    try {
      body = await req.json();
    } catch {
      return createErrorResponse(
        "ValidationError",
        "Request body must be valid JSON",
        400
      );
    }

    if (!body || typeof body !== "object") {
      return createErrorResponse(
        "ValidationError",
        "Category name and slug are required",
        400
      );
    }

    if (!body.name || !body.slug || typeof body.name !== "string" || typeof body.slug !== "string") {
      return createErrorResponse(
        "ValidationError",
        "Category name and slug are required",
        400
      );
    }

    const cleanName = body.name.trim();
    const cleanSlug = body.slug.trim();

    if (!cleanName || !cleanSlug) {
      return createErrorResponse(
        "ValidationError",
        "Category name and slug are required",
        400
      );
    }

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
      parentId: body.parentId || null,
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
    });

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

/**
 * Corporate Office Store - CSV Inventory Import Worker
 * Receives async jobs from Upstash QStash to bulk-import products from a CSV file
 * stored in Cloudflare R2. Processes rows in batches of 200 with upsert semantics.
 */

import { NextRequest, NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { eq } from "drizzle-orm";
import { db, txDb, schema } from "@/lib/db";
import { verifySignatureAppRouter } from "@/lib/queue/qstash";
import { categoryRepo } from "@/repositories/category.repo";
import { fetchWithTimeout } from "@/lib/http/fetch-with-timeout";
import { isDatabaseMocked } from "@/lib/mock/utils";
import { mockDataStore } from "@/lib/db";

// ── Constants ────────────────────────────────────────────────────────────────
const BATCH_SIZE = 200;
const CSV_FETCH_TIMEOUT_MS = 30_000;

const EXPECTED_COLUMNS = [
  "name",
  "description",
  "price",
  "stock_quantity",
  "category_slug",
  "image_url",
] as const;

// ── Types ────────────────────────────────────────────────────────────────────
interface CsvImportPayload {
  fileUrl: string;
  uploadedBy: string;
}

interface CsvRow {
  name: string;
  description: string;
  price: string;
  stock_quantity: string;
  category_slug: string;
  image_url: string;
}

interface ImportResult {
  processed: number;
  failed: number;
  errors: string[];
}

// ── POST Handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Read raw body for signature verification
    const rawBody = await req.text();

    // 2. Verify QStash signature if signing key is configured
    if (process.env.QSTASH_CURRENT_SIGNING_KEY) {
      const { isValid, error } = await verifySignatureAppRouter(req, rawBody);
      if (!isValid) {
        console.error("[csv-import] QStash signature verification failed:", error);
        return NextResponse.json(
          { error: "InvalidSignature", message: error ?? "Signature verification failed" },
          { status: 401 }
        );
      }
    }

    // 3. Parse payload
    const payload: CsvImportPayload = JSON.parse(rawBody);

    if (!payload.fileUrl || typeof payload.fileUrl !== "string") {
      return NextResponse.json(
        { error: "BadRequest", message: "Missing or invalid fileUrl" },
        { status: 400 }
      );
    }

    if (!payload.uploadedBy || typeof payload.uploadedBy !== "string") {
      return NextResponse.json(
        { error: "BadRequest", message: "Missing or invalid uploadedBy" },
        { status: 400 }
      );
    }

    // 4. Fetch CSV file from R2
    const csvResponse = await fetchWithTimeout(payload.fileUrl, {
      timeoutMs: CSV_FETCH_TIMEOUT_MS,
    });

    if (!csvResponse.ok) {
      return NextResponse.json(
        {
          error: "FetchFailed",
          message: `Failed to fetch CSV: HTTP ${csvResponse.status} ${csvResponse.statusText}`,
        },
        { status: 500 }
      );
    }

    const csvText = await csvResponse.text();

    // 5. Parse CSV
    let rows: CsvRow[];
    try {
      rows = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      }) as CsvRow[];
    } catch (parseError: any) {
      return NextResponse.json(
        {
          error: "CsvParseError",
          message: `Failed to parse CSV: ${parseError.message}`,
          processed: 0,
          failed: 0,
          errors: [parseError.message],
        },
        { status: 400 }
      );
    }

    if (rows.length === 0) {
      return NextResponse.json({ processed: 0, failed: 0, errors: [] }, { status: 200 });
    }

    // 6. Validate that required columns exist
    const firstRowKeys = Object.keys(rows[0]).map((k) => k.toLowerCase().trim());
    const missingColumns = EXPECTED_COLUMNS.filter(
      (col) => !firstRowKeys.includes(col)
    );

    if (missingColumns.length > 0) {
      return NextResponse.json(
        {
          error: "CsvSchemaError",
          message: `Missing required columns: ${missingColumns.join(", ")}`,
          processed: 0,
          failed: 0,
          errors: [`Missing columns: ${missingColumns.join(", ")}`],
        },
        { status: 400 }
      );
    }

    // 7. Pre-load category slug → ID map for fast lookups
    const categories = await categoryRepo.listCategories({ isActive: true });
    const categorySlugMap = new Map(
      categories.map((c) => [c.slug.toLowerCase(), c.id])
    );

    // 8. Process rows in batches
    const result: ImportResult = { processed: 0, failed: 0, errors: [] };

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const batchErrors = await processBatch(batch, categorySlugMap, i);

      result.processed += batch.length - batchErrors.length;
      result.failed += batchErrors.length;
      result.errors.push(...batchErrors);
    }

    // Cap errors to prevent massive response payloads
    if (result.errors.length > 100) {
      const totalErrors = result.errors.length;
      result.errors = result.errors.slice(0, 100);
      result.errors.push(`... and ${totalErrors - 100} more errors`);
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("[csv-import] Worker error:", error);
    return NextResponse.json(
      {
        error: "InternalServerError",
        message: error.message ?? "An unexpected error occurred during CSV import",
        processed: 0,
        failed: 0,
        errors: [error.message ?? "Unknown error"],
      },
      { status: 500 }
    );
  }
}

// ── Batch Processor ──────────────────────────────────────────────────────────
async function processBatch(
  batch: CsvRow[],
  categorySlugMap: Map<string, string>,
  startIndex: number
): Promise<string[]> {
  const errors: string[] = [];

  if (isDatabaseMocked()) {
    // Mock mode: process rows individually via the mock data store
    for (let j = 0; j < batch.length; j++) {
      const rowIndex = startIndex + j + 2; // +2 for 1-indexed + header row
      const row = batch[j];
      try {
        const validated = validateRow(row, categorySlugMap, rowIndex);
        if (validated.error) {
          errors.push(validated.error);
          continue;
        }

        // Upsert: check if product with same name exists
        const existing = findMockProductByName(validated.data!.name);
        if (existing) {
          mockDataStore.updateProduct(existing.id, {
            description: validated.data!.description,
            priceCents: validated.data!.priceCents,
            stockQuantity: validated.data!.stockQuantity,
            categoryId: validated.data!.categoryId,
            imageUrl: validated.data!.imageUrl ?? undefined,
          });
        } else {
          mockDataStore.createProduct({
            name: validated.data!.name,
            description: validated.data!.description,
            priceCents: validated.data!.priceCents,
            stockQuantity: validated.data!.stockQuantity,
            categoryId: validated.data!.categoryId,
            imageUrl: validated.data!.imageUrl,
            isActive: true,
          } as any);
        }
      } catch (err: any) {
        errors.push(`Row ${rowIndex}: ${err.message}`);
      }
    }
    return errors;
  }

  // Live database mode: batch upsert within a single transaction
  try {
    await txDb.transaction(async (tx: any) => {
      for (let j = 0; j < batch.length; j++) {
        const rowIndex = startIndex + j + 2;
        const row = batch[j];

        try {
          const validated = validateRow(row, categorySlugMap, rowIndex);
          if (validated.error) {
            errors.push(validated.error);
            continue;
          }

          // Upsert: check if product with matching name exists
          const existingRows = await tx
            .select()
            .from(schema.products)
            .where(eq(schema.products.name, validated.data!.name))
            .limit(1);

          if (existingRows.length > 0) {
            // Update existing product
            await tx
              .update(schema.products)
              .set({
                description: validated.data!.description,
                priceCents: validated.data!.priceCents,
                stockQuantity: validated.data!.stockQuantity,
                categoryId: validated.data!.categoryId,
                imageUrl: validated.data!.imageUrl,
                updatedAt: new Date(),
              })
              .where(eq(schema.products.id, existingRows[0].id));
          } else {
            // Insert new product
            await tx.insert(schema.products).values({
              name: validated.data!.name,
              description: validated.data!.description,
              priceCents: validated.data!.priceCents,
              stockQuantity: validated.data!.stockQuantity,
              categoryId: validated.data!.categoryId,
              imageUrl: validated.data!.imageUrl,
              isActive: true,
            });
          }
        } catch (err: any) {
          errors.push(`Row ${rowIndex}: ${err.message}`);
        }
      }
    });
  } catch (txError: any) {
    // If the entire transaction fails, mark all rows as failed
    errors.push(
      `Batch starting at row ${startIndex + 2} failed: ${txError.message}`
    );
  }

  return errors;
}

// ── Row Validation ───────────────────────────────────────────────────────────
interface ValidatedRow {
  name: string;
  description: string;
  priceCents: number;
  stockQuantity: number;
  categoryId: string;
  imageUrl: string | null;
}

function validateRow(
  row: CsvRow,
  categorySlugMap: Map<string, string>,
  rowIndex: number
): { data?: ValidatedRow; error?: string } {
  // Name is required
  const name = (row.name ?? "").trim();
  if (!name) {
    return { error: `Row ${rowIndex}: Missing required field "name"` };
  }

  // Description (optional, defaults to empty)
  const description = (row.description ?? "").trim();

  // Price: parse as dollars, convert to cents
  const priceStr = (row.price ?? "").trim().replace(/[$,]/g, "");
  const priceFloat = parseFloat(priceStr);
  if (isNaN(priceFloat) || priceFloat < 0) {
    return { error: `Row ${rowIndex}: Invalid price "${row.price}"` };
  }
  const priceCents = Math.round(priceFloat * 100);

  // Stock quantity
  const stockStr = (row.stock_quantity ?? "").trim();
  const stockQuantity = parseInt(stockStr, 10);
  if (isNaN(stockQuantity) || stockQuantity < 0) {
    return {
      error: `Row ${rowIndex}: Invalid stock_quantity "${row.stock_quantity}"`,
    };
  }

  // Category slug → ID lookup
  const categorySlug = (row.category_slug ?? "").trim().toLowerCase();
  if (!categorySlug) {
    return { error: `Row ${rowIndex}: Missing required field "category_slug"` };
  }
  const categoryId = categorySlugMap.get(categorySlug);
  if (!categoryId) {
    return {
      error: `Row ${rowIndex}: Unknown category_slug "${row.category_slug}"`,
    };
  }

  // Image URL (optional)
  const imageUrl = (row.image_url ?? "").trim() || null;

  return {
    data: { name, description, priceCents, stockQuantity, categoryId, imageUrl },
  };
}

// ── Mock Helpers ─────────────────────────────────────────────────────────────
function findMockProductByName(name: string): { id: string } | null {
  try {
    const { products } = mockDataStore.getProducts({ search: name, limit: 100 });
    const match = products.find(
      (p: any) => p.name.toLowerCase() === name.toLowerCase()
    );
    return match ? { id: match.id } : null;
  } catch {
    return null;
  }
}

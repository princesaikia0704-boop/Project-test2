/**
 * Corporate Office Store - CSV Inventory Import Worker
 * Security Hardening:
 * - Unconditional fail-closed QStash HMAC verification
 * - SSRF Guard on payload.fileUrl (HTTPS + allowlisted R2 host + DNS private-IP check + redirect: error)
 * - Bounded download size (10MB cap) and CSV schema/row validation
 * - Safe URL validation on image_url & formula character neutralization
 */

import { NextRequest, NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { txDb, schema, mockDataStore } from "@/lib/db";
import { verifySignatureAppRouter } from "@/lib/queue/qstash";
import { categoryRepo } from "@/repositories/category.repo";
import { fetchWithTimeout } from "@/lib/http/fetch-with-timeout";
import { isDatabaseMocked } from "@/lib/mock/utils";
import { validateExternalStorageUrl } from "@/lib/security/ssrf";
import { sanitizeSafeUrl } from "@/lib/security/url";
import { logSecurityEvent } from "@/lib/security/logger";
import { extractTrustedClientIp } from "@/lib/security/rate-limit";

const BATCH_SIZE = 200;
const CSV_FETCH_TIMEOUT_MS = 30_000;
const MAX_CSV_BYTES = 10 * 1024 * 1024;
const MAX_CSV_ROWS = 10_000;
const PG_MAX_INT = 2_147_483_647;

const EXPECTED_COLUMNS = [
  "name",
  "description",
  "price",
  "stock_quantity",
  "category_slug",
  "image_url",
] as const;

const csvImportPayloadSchema = z.object({
  fileUrl: z.string().trim().min(1, "Missing fileUrl").max(2048),
  uploadedBy: z.string().trim().min(1, "Missing uploadedBy").max(100),
});

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

export async function POST(req: NextRequest): Promise<NextResponse> {
  const clientIp = extractTrustedClientIp(req);

  try {
    const rawBody = await req.text();

    // 1. Unconditional QStash signature verification (fail-closed)
    const { isValid, error } = await verifySignatureAppRouter(req, rawBody);
    if (!isValid) {
      logSecurityEvent({
        event: "AUTH_SESSION_INVALID",
        severity: "HIGH",
        ip: clientIp,
        path: "/api/workers/csv-import",
        method: "POST",
        reason: error ?? "QStash signature verification failed",
      });
      return NextResponse.json(
        { error: "InvalidSignature", message: "Signature verification failed" },
        { status: 401 }
      );
    }

    // 2. Parse & validate payload with Zod
    let rawJson: unknown;
    try {
      rawJson = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: "BadRequest", message: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    const parsedPayload = csvImportPayloadSchema.safeParse(rawJson);
    if (!parsedPayload.success) {
      return NextResponse.json(
        {
          error: "BadRequest",
          message: parsedPayload.error.issues[0]?.message || "Invalid import payload",
        },
        { status: 400 }
      );
    }

    // 3. SSRF Guard: verify URL points strictly to allowlisted HTTPS storage host & public IP
    let validatedUrl: URL;
    try {
      validatedUrl = await validateExternalStorageUrl(parsedPayload.data.fileUrl);
    } catch (ssrfErr: any) {
      logSecurityEvent({
        event: "SSRF_BLOCKED",
        severity: "CRITICAL",
        userId: parsedPayload.data.uploadedBy,
        ip: clientIp,
        path: "/api/workers/csv-import",
        method: "POST",
        reason: ssrfErr?.message || "Blocked external fetch URL",
      });
      return NextResponse.json(
        { error: "InvalidStorageUrl", message: "Provided fileUrl is not permitted" },
        { status: 400 }
      );
    }

    // 4. Fetch CSV from R2 without following HTTP redirects
    const csvResponse = await fetchWithTimeout(validatedUrl.toString(), {
      timeoutMs: CSV_FETCH_TIMEOUT_MS,
      redirect: "error",
    });

    if (!csvResponse.ok) {
      return NextResponse.json(
        { error: "FetchFailed", message: "Failed to retrieve CSV file from storage" },
        { status: 502 }
      );
    }

    const contentLength = Number(csvResponse.headers.get("content-length") || "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_CSV_BYTES) {
      return NextResponse.json(
        { error: "PayloadTooLarge", message: "CSV file exceeds 10MB limit" },
        { status: 400 }
      );
    }

    const contentType = (csvResponse.headers.get("content-type") || "").toLowerCase();
    if (
      contentType &&
      !contentType.includes("text/csv") &&
      !contentType.includes("text/plain") &&
      !contentType.includes("application/csv") &&
      !contentType.includes("application/octet-stream")
    ) {
      return NextResponse.json(
        { error: "DisallowedFileType", message: "Unexpected CSV Content-Type from storage" },
        { status: 400 }
      );
    }

    const buf = Buffer.from(await csvResponse.arrayBuffer());
    if (buf.length > MAX_CSV_BYTES) {
      return NextResponse.json(
        { error: "PayloadTooLarge", message: "CSV file exceeds 10MB limit" },
        { status: 400 }
      );
    }
    const csvText = buf.toString("utf-8");

    // 5. Parse CSV
    let rows: CsvRow[];
    try {
      rows = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      }) as CsvRow[];
    } catch {
      return NextResponse.json(
        {
          error: "CsvParseError",
          message: "Failed to parse CSV file structure",
          processed: 0,
          failed: 0,
          errors: ["Invalid CSV format"],
        },
        { status: 400 }
      );
    }

    if (rows.length === 0) {
      return NextResponse.json({ processed: 0, failed: 0, errors: [] }, { status: 200 });
    }

    if (rows.length > MAX_CSV_ROWS) {
      return NextResponse.json(
        {
          error: "PayloadTooLarge",
          message: `CSV exceeds maximum of ${MAX_CSV_ROWS} rows per job`,
        },
        { status: 400 }
      );
    }

    // 6. Validate required columns exist
    const firstRowKeys = Object.keys(rows[0]).map((k) => k.toLowerCase().trim());
    const missingColumns = EXPECTED_COLUMNS.filter((col) => !firstRowKeys.includes(col));

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

    const categories = await categoryRepo.listCategories({ isActive: true });
    const categorySlugMap = new Map(categories.map((c) => [c.slug.toLowerCase(), c.id]));

    const result: ImportResult = { processed: 0, failed: 0, errors: [] };
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const batchErrors = await processBatch(batch, categorySlugMap, i);

      result.processed += batch.length - batchErrors.length;
      result.failed += batchErrors.length;
      result.errors.push(...batchErrors);
    }

    if (result.errors.length > 100) {
      const totalErrors = result.errors.length;
      result.errors = result.errors.slice(0, 100);
      result.errors.push(`... and ${totalErrors - 100} more errors`);
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    logSecurityEvent({
      event: "UNHANDLED_SERVER_ERROR",
      severity: "HIGH",
      ip: clientIp,
      path: "/api/workers/csv-import",
      method: "POST",
      reason: error?.message ?? "CSV import worker error",
    });
    return NextResponse.json(
      {
        error: "InternalServerError",
        message: "An unexpected error occurred during CSV import",
        processed: 0,
        failed: 0,
        errors: ["CSV import processing failed"],
      },
      { status: 500 }
    );
  }
}

async function processBatch(
  batch: CsvRow[],
  categorySlugMap: Map<string, string>,
  startIndex: number
): Promise<string[]> {
  const errors: string[] = [];

  if (isDatabaseMocked()) {
    for (let j = 0; j < batch.length; j++) {
      const rowIndex = startIndex + j + 2;
      const row = batch[j];
      try {
        const validated = validateRow(row, categorySlugMap, rowIndex);
        if (validated.error) {
          errors.push(validated.error);
          continue;
        }

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
      } catch {
        errors.push(`Row ${rowIndex}: Failed to save row`);
      }
    }
    return errors;
  }

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

          const existingRows = await tx
            .select()
            .from(schema.products)
            .where(eq(schema.products.name, validated.data!.name))
            .limit(1);

          if (existingRows.length > 0) {
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
        } catch {
          errors.push(`Row ${rowIndex}: Failed to persist product row`);
        }
      }
    });
  } catch {
    errors.push(`Batch starting at row ${startIndex + 2} failed`);
  }

  return errors;
}

interface ValidatedRow {
  name: string;
  description: string;
  priceCents: number;
  stockQuantity: number;
  categoryId: string;
  imageUrl: string | null;
}

function stripFormulaLead(val: string): string {
  return val.replace(/^[=+\-@\t\r]+/, "").trim();
}

function validateRow(
  row: CsvRow,
  categorySlugMap: Map<string, string>,
  rowIndex: number
): { data?: ValidatedRow; error?: string } {
  const name = stripFormulaLead(row.name ?? "").slice(0, 255);
  if (!name) {
    return { error: `Row ${rowIndex}: Missing or invalid field "name"` };
  }

  const description = stripFormulaLead(row.description ?? "").slice(0, 2000);

  const priceStr = (row.price ?? "").trim().replace(/[$,]/g, "");
  const priceFloat = parseFloat(priceStr);
  const priceCents = Math.round(priceFloat * 100);
  if (!Number.isFinite(priceFloat) || priceCents < 0 || priceCents > PG_MAX_INT) {
    return { error: `Row ${rowIndex}: Invalid price` };
  }

  const stockStr = (row.stock_quantity ?? "").trim();
  const stockQuantity = parseInt(stockStr, 10);
  if (!Number.isInteger(stockQuantity) || stockQuantity < 0 || stockQuantity > PG_MAX_INT) {
    return { error: `Row ${rowIndex}: Invalid stock_quantity` };
  }

  const categorySlug = (row.category_slug ?? "").trim().toLowerCase();
  if (!categorySlug) {
    return { error: `Row ${rowIndex}: Missing required field "category_slug"` };
  }
  const categoryId = categorySlugMap.get(categorySlug);
  if (!categoryId) {
    return { error: `Row ${rowIndex}: Unknown category_slug` };
  }

  const rawImageUrl = (row.image_url ?? "").trim();
  let imageUrl: string | null = null;
  if (rawImageUrl) {
    imageUrl = sanitizeSafeUrl(rawImageUrl, { allowRelative: true, allowDataImage: false });
    if (!imageUrl) {
      return { error: `Row ${rowIndex}: Invalid or unsafe image_url` };
    }
  }

  return {
    data: { name, description, priceCents, stockQuantity, categoryId, imageUrl },
  };
}

function findMockProductByName(name: string): { id: string } | null {
  try {
    const { products } = mockDataStore.getProducts({ search: name, limit: 100 });
    const match = products.find((p: any) => p.name.toLowerCase() === name.toLowerCase());
    return match ? { id: match.id } : null;
  } catch {
    return null;
  }
}

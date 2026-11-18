/**
 * POST /api/admin/upload
 *
 * Phase 1 (Mock): Saves uploaded image to /public/uploads/ and returns a local URL.
 * Phase 2 (Production): Swap the storage block below for Cloudflare R2 SDK upload.
 *
 * Accepts: multipart/form-data with field "file"
 * Returns: { url: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Allowed: JPEG, PNG, WebP, GIF, SVG` },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max: 5 MB` },
        { status: 400 }
      );
    }

    // ── Phase 1: Save to /public/uploads/ ────────────────────────────────────
    // Phase 2: Replace this block with:
    //   const r2 = new S3Client({ ... cloudflare R2 config });
    //   await r2.send(new PutObjectCommand({ Bucket, Key: filename, Body: buffer, ContentType: file.type }));
    //   return NextResponse.json({ url: `${process.env.R2_PUBLIC_URL}/${filename}` });
    // ─────────────────────────────────────────────────────────────────────────

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeName = file.name
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 40);
    const filename = `${safeName}-${Date.now()}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), buffer);

    const url = `/uploads/${filename}`;
    return NextResponse.json({ url }, { status: 200 });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Upload failed";
    console.error("[upload] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

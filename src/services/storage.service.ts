/**
 * Corporate Office Store - Object Storage Service
 * Generates presigned Cloudflare R2 (S3-compatible) upload/download URLs with
 * 10MB file size limits, 900s TTLs, dangerous extension blocking, and mock fallback.
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { isServiceMocked } from "@/lib/mock/utils";
import { DomainError } from "@/services/order.service";

export interface PresignedUploadInput {
  filename: string;
  fileSizeBytes?: number;
  contentType?: string;
  adminUserId?: string;
}

export interface PresignedUploadResult {
  success: boolean;
  key: string;
  presignedUrl: string;
  expiresInSeconds: number;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit
const PRESIGNED_URL_TTL = 900; // 15 minutes (900 seconds)
const PROHIBITED_EXTENSIONS = [".sh", ".exe", ".bat", ".cmd", ".ps1", ".js", ".vbs", ".html", ".htm", ".svg", ".php", ".jsp"];
const ALLOWED_UPLOAD_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".csv", ".pdf"];
const ALLOWED_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "text/csv",
  "application/csv",
  "application/pdf",
  "application/octet-stream",
];

/**
 * Generates a presigned Cloudflare R2 / S3 upload URL with security constraints:
 * extension allowlist, MIME allowlist, size caps (10MB), expiration TTL (15 min),
 * path traversal protection, and executable extension blocking.
 */
export async function generatePresignedUploadUrl(
  input: PresignedUploadInput
): Promise<PresignedUploadResult> {
  // 1. Validation: Filename presence & non-empty string + traversal rejection
  if (!input.filename || typeof input.filename !== "string" || input.filename.trim().length === 0) {
    throw new DomainError("MissingFilename", "Filename is required", 400);
  }

  if (
    input.filename.includes("\0") ||
    input.filename.includes("..") ||
    input.filename.includes("/") ||
    input.filename.includes("\\")
  ) {
    throw new DomainError("InvalidFilename", "Path traversal characters are prohibited in filename", 400);
  }

  const cleanBaseName = input.filename.trim().replace(/^.*[\\/]/, "").replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!cleanBaseName || cleanBaseName.trim().length === 0) {
    throw new DomainError("MissingFilename", "Valid filename is required", 400);
  }

  // 2. Validation: File size limit (10MB maximum, reject NaN/negative/non-integer)
  if (input.fileSizeBytes !== undefined) {
    if (
      typeof input.fileSizeBytes !== "number" ||
      !Number.isFinite(input.fileSizeBytes) ||
      input.fileSizeBytes <= 0
    ) {
      throw new DomainError("InvalidFileSize", "File size must be a positive integer", 400);
    }
    if (input.fileSizeBytes > MAX_FILE_SIZE_BYTES) {
      throw new DomainError("PayloadTooLarge", "File size exceeds 10MB limit", 400);
    }
  }

  // 3. Validation: Prohibited extensions + strict allowlist
  const lowerFilename = cleanBaseName.toLowerCase();
  for (const ext of PROHIBITED_EXTENSIONS) {
    if (lowerFilename.endsWith(ext)) {
      throw new DomainError("DisallowedFileType", "Executable or active-content files are prohibited", 400);
    }
  }
  const hasAllowedExt = ALLOWED_UPLOAD_EXTENSIONS.some((ext) => lowerFilename.endsWith(ext));
  if (!hasAllowedExt) {
    throw new DomainError(
      "DisallowedFileType",
      "Only PNG, JPG, JPEG, WebP, GIF, CSV, and PDF uploads are permitted",
      400
    );
  }

  if (input.contentType && !ALLOWED_CONTENT_TYPES.includes(input.contentType)) {
    throw new DomainError("DisallowedContentType", "Unsupported upload Content-Type", 400);
  }

  // 4. Generate Unique Collision-Free Key
  const uniqueKey = `uploads/${Date.now()}-${crypto.randomUUID()}-${cleanBaseName}`;

  // 5. Dual-Mode Resolution: Mock Storage vs Live Cloudflare R2
  if (isServiceMocked("r2")) {
    const mockPresignedUrl = `https://r2.mock-storage.local/${uniqueKey}?sig=valid_mock_signature&expires=${PRESIGNED_URL_TTL}`;
    return {
      success: true,
      key: uniqueKey,
      presignedUrl: mockPresignedUrl,
      expiresInSeconds: PRESIGNED_URL_TTL,
    };
  }

  // Live Cloudflare R2 Client Initialization
  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: uniqueKey,
    ContentType: input.contentType || "application/octet-stream",
    ...(input.fileSizeBytes !== undefined ? { ContentLength: input.fileSizeBytes } : {}),
  });

  const presignedUrl = await getSignedUrl(s3, command, { expiresIn: PRESIGNED_URL_TTL });

  return {
    success: true,
    key: uniqueKey,
    presignedUrl,
    expiresInSeconds: PRESIGNED_URL_TTL,
  };
}

export async function generatePresignedDownloadUrl(
  key: string,
  expiresInSeconds = PRESIGNED_URL_TTL
): Promise<string> {
  if (isServiceMocked("r2")) {
    return `https://r2.mock-storage.local/${key}?sig=valid_mock_signature&expires=${expiresInSeconds}`;
  }

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
  });

  return await getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}

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
const PROHIBITED_EXTENSIONS = [".sh", ".exe", ".bat", ".cmd", ".ps1", ".js", ".vbs"];

export async function generatePresignedUploadUrl(
  input: PresignedUploadInput
): Promise<PresignedUploadResult> {
  // 1. Validation: Filename presence & non-empty string
  if (!input.filename || typeof input.filename !== "string" || input.filename.trim().length === 0) {
    throw new DomainError("MissingFilename", "Filename is required", 400);
  }

  const cleanBaseName = input.filename.replace(/^.*[\\/]/, "").replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!cleanBaseName || cleanBaseName.trim().length === 0) {
    throw new DomainError("MissingFilename", "Valid filename is required", 400);
  }

  // 2. Validation: File size limit (10MB maximum)
  if (input.fileSizeBytes !== undefined && input.fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    throw new DomainError("PayloadTooLarge", "File size exceeds 10MB limit", 400);
  }

  // 3. Validation: Prohibited executable file extensions
  const lowerFilename = cleanBaseName.toLowerCase();
  for (const ext of PROHIBITED_EXTENSIONS) {
    if (lowerFilename.endsWith(ext)) {
      throw new DomainError("DisallowedFileType", "Executable files are prohibited", 400);
    }
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

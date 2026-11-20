/**
 * Hook that orchestrates the 3-step CSV upload and import pipeline:
 * 1. Pre-sign — POST /api/admin/uploads/presign
 * 2. Direct R2 upload — PUT to presigned URL
 * 3. Worker trigger — POST /api/admin/inventory/import
 *
 * Separates storage/HTTP business logic from CsvUploader UI.
 */
"use client";

import { useState } from "react";

export type UploadStatus = "idle" | "validating" | "uploading" | "processing" | "success" | "error";

export interface UseCsvUploadOptions {
  onSuccess?: () => void;
  onError?: (err: Error) => void;
}

export interface UseCsvUploadReturn {
  status: UploadStatus;
  progress: number;
  errorMessage: string;
  setStatus: React.Dispatch<React.SetStateAction<UploadStatus>>;
  setProgress: React.Dispatch<React.SetStateAction<number>>;
  setErrorMessage: React.Dispatch<React.SetStateAction<string>>;
  uploadCsv: (file: File) => Promise<boolean>;
  reset: () => void;
}

export function useCsvUpload({ onSuccess, onError }: UseCsvUploadOptions = {}): UseCsvUploadReturn {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  const reset = () => {
    setStatus("idle");
    setProgress(0);
    setErrorMessage("");
  };

  const uploadCsv = async (file: File): Promise<boolean> => {
    try {
      // Step 1: Pre-signed URL
      setStatus("uploading");
      setProgress(10);

      const presignResponse = await fetch("/api/admin/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          fileSizeBytes: file.size,
          contentType: "text/csv",
        }),
      });

      if (!presignResponse.ok) {
        const err = await presignResponse.json().catch(() => ({}));
        throw new Error(err.message ?? `Failed to get upload URL (${presignResponse.status})`);
      }

      const { uploadUrl, fileUrl } = await presignResponse.json();
      setProgress(30);

      // Step 2: Upload file directly to R2
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": "text/csv" },
      });

      if (!uploadResponse.ok) {
        throw new Error(`File upload failed (${uploadResponse.status})`);
      }

      setProgress(70);

      // Step 3: Trigger background CSV import
      setStatus("processing");

      const importResponse = await fetch("/api/admin/inventory/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl }),
      });

      if (!importResponse.ok) {
        const err = await importResponse.json().catch(() => ({}));
        throw new Error(err.message ?? `Import trigger failed (${importResponse.status})`);
      }

      setProgress(100);
      setStatus("success");
      onSuccess?.();
      return true;
    } catch (err: any) {
      const msg = err.message ?? "An unexpected error occurred during upload.";
      setErrorMessage(msg);
      setStatus("error");
      onError?.(err);
      return false;
    }
  };

  return {
    status,
    progress,
    errorMessage,
    setStatus,
    setProgress,
    setErrorMessage,
    uploadCsv,
    reset,
  };
}

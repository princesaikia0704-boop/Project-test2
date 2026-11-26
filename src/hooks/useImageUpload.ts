"use client";

import { useState, useCallback } from "react";
import { sanitizeSafeUrl } from "@/lib/security/url";

export interface UseImageUploadReturn {
  isUploading: boolean;
  uploadError: string | null;
  uploadImage: (file: File) => Promise<string | null>;
  clearError: () => void;
}

const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

export function useImageUpload(): UseImageUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setUploadError(null);
  }, []);

  const uploadImage = useCallback(async (file: File): Promise<string | null> => {
    setUploadError(null);

    if (!ALLOWED_UPLOAD_MIME_TYPES.has(file.type.toLowerCase())) {
      setUploadError("Unsupported file format. Please upload PNG, JPEG, WebP, or GIF.");
      return null;
    }

    if (file.size <= 0 || file.size > MAX_UPLOAD_SIZE_BYTES) {
      setUploadError("File size must be between 1 byte and 5 MB.");
      return null;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUploadError(
          typeof data.message === "string"
            ? data.message
            : typeof data.error === "string"
              ? data.error
              : "Failed to upload image."
        );
        return null;
      }

      const safeUrl = sanitizeSafeUrl(data?.url, { allowRelative: true });
      if (!safeUrl) {
        setUploadError("Upload succeeded but server returned an invalid image URL.");
        return null;
      }

      return safeUrl;
    } catch {
      setUploadError("Network error while uploading image. Please retry.");
      return null;
    } finally {
      setIsUploading(false);
    }
  }, []);

  return { isUploading, uploadError, uploadImage, clearError };
}

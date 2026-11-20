/**
 * Hook for uploading images (e.g. company logo) with automatic client-side
 * base64 Data URL fallback if storage API fails.
 */
"use client";

import { useState } from "react";

export interface UseImageUploadReturn {
  isUploading: boolean;
  uploadError: string | null;
  uploadImage: (file: File) => Promise<string | null>;
  clearError: () => void;
}

export function useImageUpload(): UseImageUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const clearError = () => setUploadError(null);

  const uploadImage = async (file: File): Promise<string | null> => {
    setIsUploading(true);
    setUploadError(null);

    // Helper: read file as base64 Data URL
    const readAsDataUrl = (f: File): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string) || "");
        reader.onerror = () => reject(new Error("Failed to read image file"));
        reader.readAsDataURL(f);
      });

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          setIsUploading(false);
          return data.url;
        }
      }

      // Fallback to client-side data URL
      const dataUrl = await readAsDataUrl(file);
      setIsUploading(false);
      return dataUrl;
    } catch {
      try {
        const dataUrl = await readAsDataUrl(file);
        setIsUploading(false);
        return dataUrl;
      } catch (err: any) {
        const msg = err?.message || "Failed to process image file";
        setUploadError(msg);
        setIsUploading(false);
        return null;
      }
    }
  };

  return { isUploading, uploadError, uploadImage, clearError };
}

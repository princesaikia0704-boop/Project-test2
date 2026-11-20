"use client";

/**
 * Corporate Office Store - CSV Inventory Upload Component
 * Drag-and-drop zone with file picker for bulk importing products via CSV.
 * Handles pre-signed URL generation, direct R2 upload, and background job trigger.
 */

import React, { useState, useRef, useCallback } from "react";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCsvUpload } from "@/hooks/useCsvUpload";

// ── Props ────────────────────────────────────────────────────────────────────
export interface CsvUploaderProps {
  onUploadComplete: () => void;
}

// ── Constants ────────────────────────────────────────────────────────────────
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ACCEPTED_FILE_TYPES = ".csv";
const ACCEPTED_MIME_TYPES = [
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "text/plain",
];

// ── Component ────────────────────────────────────────────────────────────────
export const CsvUploader: React.FC<CsvUploaderProps> = ({ onUploadComplete }) => {
  const {
    status,
    progress,
    errorMessage,
    setStatus,
    setProgress,
    setErrorMessage,
    uploadCsv,
    reset,
  } = useCsvUpload({ onSuccess: onUploadComplete });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File Validation ──────────────────────────────────────────────────────
  const validateFile = useCallback((file: File): string | null => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      return "Invalid file type. Please upload a .csv file.";
    }
    if (!ACCEPTED_MIME_TYPES.includes(file.type) && file.type !== "") {
      // Allow empty type (some browsers don't set it for CSV)
      return "Invalid file type. Please upload a valid CSV file.";
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return `File too large (${sizeMB}MB). Maximum allowed size is 10MB.`;
    }
    if (file.size === 0) {
      return "File is empty. Please upload a CSV with data.";
    }
    return null;
  }, []);

  // ── File Selection Handler ───────────────────────────────────────────────
  const handleFileSelect = useCallback(
    (file: File) => {
      setErrorMessage("");
      setStatus("validating");
      setProgress(0);

      const error = validateFile(file);
      if (error) {
        setErrorMessage(error);
        setStatus("error");
        setSelectedFile(null);
        return;
      }

      setSelectedFile(file);
      setStatus("idle");
    },
    [validateFile]
  );

  // ── Drag & Drop Handlers ─────────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileSelect(files[0]);
      }
    },
    [handleFileSelect]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFileSelect(files[0]);
      }
    },
    [handleFileSelect]
  );

  // ── Upload Flow ──────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!selectedFile) return;
    await uploadCsv(selectedFile);
  };

  // ── Reset Handler ────────────────────────────────────────────────────────
  const handleReset = () => {
    reset();
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };
    setIsDragOver(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div data-testid="csv-uploader" className="w-full space-y-4">
      {/* Drag & Drop Zone */}
      {(status === "idle" || status === "validating" || status === "error") && (
        <div
          data-testid="csv-uploader-dropzone"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "relative flex flex-col items-center justify-center gap-3 px-6 py-10 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200",
            isDragOver
              ? "border-blue-400 bg-blue-50/50"
              : selectedFile
                ? "border-emerald-300 bg-emerald-50/30"
                : "border-slate-300 bg-slate-50/50 hover:border-slate-400 hover:bg-slate-100/50"
          )}
        >
          {selectedFile ? (
            <>
              <FileSpreadsheet className="w-10 h-10 text-emerald-500" />
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-900">{selectedFile.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {(selectedFile.size / 1024).toFixed(1)} KB • Ready to upload
                </p>
              </div>
            </>
          ) : (
            <>
              <Upload
                className={cn(
                  "w-10 h-10 transition-colors",
                  isDragOver ? "text-blue-500" : "text-slate-400"
                )}
              />
              <div className="text-center">
                <p className="text-sm font-medium text-slate-700">
                  <span className="text-blue-600 font-semibold">Click to browse</span> or drag and
                  drop
                </p>
                <p className="text-xs text-slate-500 mt-1">CSV files only, up to 10MB</p>
              </div>
            </>
          )}

          <input
            ref={fileInputRef}
            data-testid="csv-uploader-input"
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            onChange={handleInputChange}
            className="hidden"
            aria-label="Upload CSV file"
          />
        </div>
      )}

      {/* Error Message */}
      {status === "error" && errorMessage && (
        <div
          data-testid="csv-uploader-error"
          className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg"
        >
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">{errorMessage}</p>
          </div>
          <button
            onClick={handleReset}
            className="p-1 rounded text-red-400 hover:text-red-600 transition-colors"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Progress Bar */}
      {(status === "uploading" || status === "processing") && (
        <div data-testid="csv-uploader-progress" className="space-y-3">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
            <span className="text-sm font-medium text-slate-700">
              {status === "uploading" ? "Uploading file..." : "Processing import..."}
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
            <div
              data-testid="csv-uploader-progress-bar"
              className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 text-right">{progress}%</p>
        </div>
      )}

      {/* Success State */}
      {status === "success" && (
        <div
          data-testid="csv-uploader-success"
          className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-800">Upload Complete</p>
            <p className="text-xs text-emerald-600">
              Your CSV has been submitted for background processing. Products will be imported
              shortly.
            </p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        {selectedFile && (status === "idle" || status === "error") && (
          <button
            data-testid="csv-uploader-upload-btn"
            type="button"
            onClick={handleUpload}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 active:scale-95 transition-all"
          >
            <Upload className="w-4 h-4" />
            Upload & Import
          </button>
        )}

        {(selectedFile || status === "success" || status === "error") && (
          <button
            data-testid="csv-uploader-reset-btn"
            type="button"
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors"
          >
            {status === "success" ? "Upload Another" : "Clear"}
          </button>
        )}
      </div>
    </div>
  );
};

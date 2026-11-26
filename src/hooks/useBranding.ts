"use client";

import { useState, useEffect } from "react";
import { sanitizeSafeUrl } from "@/lib/security/url";

export interface BrandingData {
  companyName: string;
  logoUrl: string;
}

function sanitizeCompanyName(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return "Office Store";
  const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 80);
  return cleaned || "Office Store";
}

export function useBranding(): BrandingData {
  const [companyName, setCompanyName] = useState<string>("Office Store");
  const [logoUrl, setLogoUrl] = useState<string>("");

  useEffect(() => {
    const syncFromStorage = () => {
      try {
        const savedName = localStorage.getItem("app_company_name");
        if (savedName) {
          setCompanyName(sanitizeCompanyName(savedName));
        }
        const savedLogo = localStorage.getItem("app_logo_url");
        if (savedLogo) {
          setLogoUrl(sanitizeSafeUrl(savedLogo) || "");
        } else {
          setLogoUrl("");
        }
      } catch {
        // Ignore restricted storage access
      }
    };

    syncFromStorage();

    fetch("/api/admin/store-config")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const conf = data?.config;
        if (!conf) return;

        if (conf.company_name) {
          const cleanName = sanitizeCompanyName(conf.company_name);
          setCompanyName(cleanName);
          try {
            localStorage.setItem("app_company_name", cleanName);
          } catch {}
        }

        if (conf.logo_url !== undefined) {
          const safeLogo = sanitizeSafeUrl(conf.logo_url) || "";
          setLogoUrl(safeLogo);
          try {
            localStorage.setItem("app_logo_url", safeLogo);
          } catch {}
        }
      })
      .catch(() => {
        // Ignore network errors and keep cached/default branding
      });

    window.addEventListener("storage", syncFromStorage);
    return () => window.removeEventListener("storage", syncFromStorage);
  }, []);

  return { companyName, logoUrl };
}

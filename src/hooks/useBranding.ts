/**
 * Hook to fetch and reactively sync branding data (company name, logo URL)
 * from localStorage + the store-config API.
 *
 * Used by StorefrontNavbar and admin layout to show dynamic branding.
 */
"use client";

import { useEffect, useState } from "react";

interface BrandingData {
  companyName: string;
  logoUrl: string;
}

/**
 * Returns the current branding (company name + logo URL).
 * - Reads from localStorage immediately for instant paint.
 * - Fetches /api/admin/store-config in the background and updates state.
 * - Listens for `storage` events so changes in settings propagate live.
 */
export function useBranding(): BrandingData {
  const [companyName, setCompanyName] = useState<string>("Office Store");
  const [logoUrl, setLogoUrl] = useState<string>("");

  useEffect(() => {
    // 1. Instant hydration from localStorage
    const savedName = localStorage.getItem("app_company_name");
    if (savedName) setCompanyName(savedName);
    const savedLogo = localStorage.getItem("app_logo_url");
    if (savedLogo) setLogoUrl(savedLogo);

    // 2. Fetch latest from API
    fetch("/api/admin/store-config")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.config?.company_name) {
          setCompanyName(data.config.company_name);
          localStorage.setItem("app_company_name", data.config.company_name);
        }
        if (data?.config?.logo_url !== undefined) {
          setLogoUrl(data.config.logo_url);
          localStorage.setItem("app_logo_url", data.config.logo_url);
        }
      })
      .catch(() => {
        // Branding is non-critical — fail silently and keep localStorage values
      });

    // 3. Live sync when settings page saves
    const handleStorageUpdate = () => {
      const n = localStorage.getItem("app_company_name");
      if (n) setCompanyName(n);
      const l = localStorage.getItem("app_logo_url");
      if (l !== null) setLogoUrl(l);
    };

    window.addEventListener("storage", handleStorageUpdate);
    return () => window.removeEventListener("storage", handleStorageUpdate);
  }, []);

  return { companyName, logoUrl };
}

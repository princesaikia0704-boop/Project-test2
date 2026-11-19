"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import { CartDrawer } from "@/components/storefront/CartDrawer";
import { ShoppingBag, Briefcase } from "lucide-react";
import { PersonaSwitcher, PERSONAS, type Persona } from "@/components/shared/PersonaSwitcher";

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export const StorefrontNavbar: React.FC = () => {
  const pathname = usePathname();
  const { totalItemCount, isDrawerOpen, openDrawer, closeDrawer } = useCart();
  // kept for potential future use (e.g. showing budget for current persona)
  const [_persona, setPersona] = useState<Persona>(PERSONAS[0]);
  const [companyName, setCompanyName] = useState<string>("Office Store");
  const [logoUrl, setLogoUrl] = useState<string>("");

  useEffect(() => {
    const id = getCookieValue("mock_persona");
    const found = PERSONAS.find((p) => p.id === id);
    if (found) setPersona(found);

    // Load initial branding from localStorage
    const savedName = localStorage.getItem("app_company_name");
    if (savedName) setCompanyName(savedName);
    const savedLogo = localStorage.getItem("app_logo_url");
    if (savedLogo) setLogoUrl(savedLogo);

    // Fetch latest branding from store-config API
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
      .catch(() => {});

    const handleStorageUpdate = () => {
      const n = localStorage.getItem("app_company_name");
      if (n) setCompanyName(n);
      const l = localStorage.getItem("app_logo_url");
      if (l !== null) setLogoUrl(l);
    };

    window.addEventListener("storage", handleStorageUpdate);
    return () => window.removeEventListener("storage", handleStorageUpdate);
  }, [pathname]);

  const navLinks = [
    { href: "/", label: "Catalog" },
    { href: "/cart", label: "Cart" },
    { href: "/orders", label: "My Orders" },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Store Name */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5 font-black text-slate-900 dark:text-white text-lg">
              <div className="w-9 h-9 bg-slate-900 dark:bg-slate-800 border border-transparent dark:border-slate-700 rounded-lg flex items-center justify-center text-white overflow-hidden shrink-0">
                {logoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={logoUrl}
                    alt={companyName}
                    className="w-full h-full object-contain p-1"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  <Briefcase className="w-5 h-5" />
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="leading-tight truncate">{companyName}</span>
                <span className="text-[10px] text-slate-400 font-medium tracking-wide">
                  Corporate Supplies
                </span>
              </div>
            </Link>

            {/* Navigation links */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      isActive
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white"
                        : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Header Elements */}
          <div className="flex items-center gap-3">
            {/* Unified persona switcher */}
            <PersonaSwitcher variant="light" />

            {/* Cart Button */}
            <button
              type="button"
              data-testid="cart-trigger-btn"
              onClick={openDrawer}
              className="relative p-2 rounded-lg bg-slate-900 dark:bg-indigo-600 text-white hover:bg-slate-800 dark:hover:bg-indigo-500 transition shadow-sm"
              aria-label="Open Cart"
            >
              <ShoppingBag className="w-5 h-5" />
              {totalItemCount > 0 && (
                <span
                  data-testid="cart-badge-count"
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-indigo-600 text-white rounded-full text-[11px] font-bold flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-sm"
                >
                  {totalItemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Cart Drawer */}
      <CartDrawer isOpen={isDrawerOpen} onClose={closeDrawer} />
    </>
  );
};

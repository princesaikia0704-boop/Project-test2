"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import { CartDrawer } from "@/components/storefront/CartDrawer";
import { ShoppingBag, Briefcase } from "lucide-react";
import { PersonaSwitcher } from "@/components/shared/PersonaSwitcher";
import { useBranding } from "@/hooks/useBranding";

export const StorefrontNavbar: React.FC = () => {
  const pathname = usePathname();
  const { totalItemCount, isDrawerOpen, openDrawer, closeDrawer } = useCart();
  const { companyName, logoUrl } = useBranding();
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setLogoError(false);
  }, [logoUrl]);

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
                {logoUrl && !logoError ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={logoUrl}
                    alt={companyName}
                    className="w-full h-full object-contain p-1"
                    onError={() => setLogoError(true)}
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

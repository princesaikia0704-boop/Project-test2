"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import { CartDrawer } from "@/components/storefront/CartDrawer";
import { ShoppingBag, Briefcase, User, Clock, Layers } from "lucide-react";

export const StorefrontNavbar: React.FC = () => {
  const pathname = usePathname();
  const { totalItemCount, isDrawerOpen, openDrawer, closeDrawer } = useCart();

  const navLinks = [
    { href: "/", label: "Catalog" },
    { href: "/cart", label: "Cart" },
    { href: "/orders", label: "My Orders" },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Store Name */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5 font-black text-slate-900 text-lg">
              <div className="w-9 h-9 bg-slate-900 rounded-lg flex items-center justify-center text-white">
                <Briefcase className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="leading-tight">Office Store</span>
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
                        ? "bg-slate-100 text-slate-900"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
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
            {/* Persona Indicator & Switcher */}
            <Link
              href="/login"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
              title="Switch Persona / Login"
            >
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Alice Engineer</span>
              <span className="text-[10px] font-bold uppercase bg-slate-200 px-1.5 py-0.2 rounded text-slate-600">
                EMP
              </span>
            </Link>

            {/* Cart Button */}
            <button
              type="button"
              data-testid="cart-trigger-btn"
              onClick={openDrawer}
              className="relative p-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition"
              aria-label="Open Cart"
            >
              <ShoppingBag className="w-5 h-5" />
              {totalItemCount > 0 && (
                <span
                  data-testid="cart-badge-count"
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-indigo-600 text-white rounded-full text-[11px] font-bold flex items-center justify-center border-2 border-white shadow-sm"
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

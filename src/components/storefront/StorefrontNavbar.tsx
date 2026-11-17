"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import { CartDrawer } from "@/components/storefront/CartDrawer";
import { ShoppingBag, Briefcase, User, LayoutDashboard } from "lucide-react";

type PersonaInfo = { name: string; badge: string; badgeColor: string; adminPath?: string };

const PERSONA_MAP: Record<string, PersonaInfo> = {
  "user-alice-emp": { name: "Alice Engineer", badge: "EMP", badgeColor: "bg-slate-200 text-slate-600" },
  "user-carol-mgr": { name: "Carol Manager",  badge: "MGR", badgeColor: "bg-amber-200 text-amber-700",  adminPath: "/admin/approvals" },
  "user-dave-adm":  { name: "Dave Admin",     badge: "ADM", badgeColor: "bg-purple-200 text-purple-700", adminPath: "/admin" },
};

const DEFAULT_PERSONA: PersonaInfo = PERSONA_MAP["user-alice-emp"];

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export const StorefrontNavbar: React.FC = () => {
  const pathname = usePathname();
  const { totalItemCount, isDrawerOpen, openDrawer, closeDrawer } = useCart();
  const [persona, setPersona] = useState<PersonaInfo>(DEFAULT_PERSONA);

  // Re-read cookie whenever pathname changes (i.e. after login redirect)
  useEffect(() => {
    const id = getCookieValue("mock_persona");
    setPersona(id && PERSONA_MAP[id] ? PERSONA_MAP[id] : DEFAULT_PERSONA);
  }, [pathname]);

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
            {/* Department Budget Pill commented out for now:
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Engineering: $1,000.00 left</span>
            </div>
            */}

            {/* Admin Panel shortcut — only shown for MGR / ADM */}
            {persona.adminPath && (
              <a
                href={persona.adminPath}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition"
                title="Go to Admin Panel"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Admin Panel →</span>
              </a>
            )}

            {/* Persona Indicator & Switcher */}
            <Link
              href="/login"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
              title="Switch Persona / Login"
            >
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">{persona.name}</span>
              <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${persona.badgeColor}`}>
                {persona.badge}
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

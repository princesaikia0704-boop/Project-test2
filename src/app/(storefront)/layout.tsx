import React from "react";
import { CartProvider } from "@/lib/cart-context";
import { StorefrontNavbar } from "@/components/storefront/StorefrontNavbar";

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <StorefrontNavbar />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
        <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
          <p>© 2026 Office Store — Corporate Supply Management System</p>
        </footer>
      </div>
    </CartProvider>
  );
}

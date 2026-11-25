"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { Product } from "@/lib/db/schema";

export interface CartItem {
  product: Product;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  cartTotalCents: number;
  totalItemCount: number;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load from localStorage on client mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("office_store_cart");
      if (stored) {
        setItems(JSON.parse(stored));
      }
    } catch {
      // fallback
    }
    setIsInitialized(true);
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem("office_store_cart", JSON.stringify(items));
    } catch {
      // fallback
    }
  }, [items, isInitialized]);

  const addToCart = (product: Product, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        const nextQty = Math.min(
          existing.quantity + quantity,
          product.stockQuantity
        );
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: nextQty } : item
        );
      }
      return [
        ...prev,
        { product, quantity: Math.min(quantity, Math.max(1, product.stockQuantity)) },
      ];
    });
    setIsDrawerOpen(true);
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setItems((prev) =>
      prev.map((item) => {
        if (item.product.id !== productId) return item;
        const boundedQty = Math.min(quantity, item.product.stockQuantity);
        return { ...item, quantity: boundedQty };
      })
    );
  };

  const removeFromCart = (productId: string) => {
    setItems((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setItems([]);
  };

  const cartTotalCents = useMemo(
    () => items.reduce((sum, item) => sum + item.product.priceCents * item.quantity, 0),
    [items]
  );

  const totalItemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        cartTotalCents,
        totalItemCount,
        isDrawerOpen,
        openDrawer: () => setIsDrawerOpen(true),
        closeDrawer: () => setIsDrawerOpen(false),
        toggleDrawer: () => setIsDrawerOpen((prev) => !prev),
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}

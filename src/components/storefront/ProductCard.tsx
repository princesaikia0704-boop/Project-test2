"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Product } from "@/lib/db/schema";
import { ShoppingCart, Plus, Minus, PackageCheck, AlertCircle, XCircle } from "lucide-react";

export interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product, quantity: number) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart }) => {
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [imageError, setImageError] = useState(false);

  const isOutOfStock = product.stockQuantity <= 0;
  const isLowStock =
    product.stockQuantity > 0 &&
    product.stockQuantity <= (product.lowStockThreshold ?? 5);

  const handleIncrement = () => {
    if (quantity < product.stockQuantity) {
      setQuantity((q) => q + 1);
    }
  };

  const handleDecrement = () => {
    if (quantity > 1) {
      setQuantity((q) => q - 1);
    }
  };

  const handleAdd = () => {
    if (isOutOfStock || !product.isActive) return;
    setIsAdding(true);
    onAddToCart(product, quantity);
    setTimeout(() => {
      setIsAdding(false);
      setQuantity(1);
    }, 400);
  };

  return (
    <div
      data-testid={`product-card-${product.id}`}
      className="group relative flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-all duration-200"
    >
      {/* Product Image & Stock Badge Overlay */}
      <div className="relative aspect-square w-full mb-3 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center">
        {product.imageUrl && !imageError ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-400 p-4">
            <PackageCheck className="w-12 h-12 mb-1 text-slate-300" />
            <span className="text-xs font-medium">Product Image</span>
          </div>
        )}

        {/* Stock Status Badge */}
        <div className="absolute top-2 right-2">
          {isOutOfStock ? (
            <span
              data-testid="badge-out-of-stock"
              className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800 border border-red-200"
            >
              <XCircle className="w-3.5 h-3.5" />
              Out of Stock
            </span>
          ) : isLowStock ? (
            <span
              data-testid="badge-low-stock"
              className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              Low Stock: {product.stockQuantity} left
            </span>
          ) : (
            <span
              data-testid="badge-in-stock"
              className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200"
            >
              <PackageCheck className="w-3.5 h-3.5" />
              In Stock
            </span>
          )}
        </div>
      </div>

      {/* Product Details */}
      <div className="flex flex-col flex-1 justify-between">
        <div>
          {product.sku && (
            <span className="text-xs uppercase font-mono tracking-wider text-slate-400 mb-0.5 block">
              SKU: {product.sku}
            </span>
          )}
          <h3 className="font-semibold text-slate-900 text-sm line-clamp-2 mb-1" title={product.name}>
            {product.name}
          </h3>
          {product.description && (
            <p className="text-xs text-slate-500 line-clamp-2 mb-3">
              {product.description}
            </p>
          )}
        </div>

        {/* Add to Cart Controls */}
        <div className="pt-3 border-t border-slate-100 mt-2">
          <div className="flex items-center gap-2">
            {/* Quantity Stepper */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={handleDecrement}
                disabled={isOutOfStock || quantity <= 1}
                className="w-7 h-7 flex items-center justify-center rounded text-slate-600 hover:bg-white disabled:opacity-40 transition-colors"
                aria-label="Decrease quantity"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span
                data-testid="product-quantity-display"
                className="w-8 text-center text-xs font-semibold text-slate-800"
              >
                {quantity}
              </span>
              <button
                type="button"
                onClick={handleIncrement}
                disabled={isOutOfStock || quantity >= product.stockQuantity}
                className="w-7 h-7 flex items-center justify-center rounded text-slate-600 hover:bg-white disabled:opacity-40 transition-colors"
                aria-label="Increase quantity"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Add to Cart Button */}
            <button
              type="button"
              data-testid="add-to-cart-btn"
              onClick={handleAdd}
              disabled={isOutOfStock || !product.isActive || isAdding}
              className={`flex-1 flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-white transition-all ${isOutOfStock
                  ? "bg-slate-300 cursor-not-allowed"
                  : isAdding
                    ? "bg-emerald-600"
                    : "bg-slate-900 hover:bg-slate-800 active:scale-95"
                }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>{isOutOfStock ? "Unavailable" : isAdding ? "Added!" : "Add to Cart"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

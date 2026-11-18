"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { formatCurrency } from "@/lib/utils";
import { Product, Category } from "@/lib/db/schema";
import {
  Search,
  Plus,
  Pencil,
  ToggleLeft,
  ToggleRight,
  Package as PackageIcon,
  Layers,
  X,
  Loader2,
  PackageX,
  ChevronDown,
  ArrowUpDown,
  Save,
  Trash2,
  AlertTriangle,
  UploadCloud,
  ImageIcon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Tab = "products" | "categories";

interface ProductFormData {
  name: string;
  description: string;
  priceCents: number;
  categoryId: string;
  stockQuantity: number;
  imageUrl: string;
  isActive: boolean;
}

interface CategoryFormData {
  name: string;
  slug: string;
  isActive: boolean;
}

interface StockAdjustment {
  mode: "absolute" | "delta";
  value: number;
  reason: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function CatalogPage() {
  const [activeTab, setActiveTab] = useState<Tab>("products");

  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");

  // Modals
  const [showProductModal, setShowProductModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);

  // Forms
  const defaultProductForm: ProductFormData = {
    name: "",
    description: "",
    priceCents: 0,
    categoryId: "",
    stockQuantity: 0,
    imageUrl: "",
    isActive: true,
  };
  const [productForm, setProductForm] = useState<ProductFormData>(defaultProductForm);

  const defaultCategoryForm: CategoryFormData = { name: "", slug: "", isActive: true };
  const [categoryForm, setCategoryForm] = useState<CategoryFormData>(defaultCategoryForm);

  const defaultStockAdj: StockAdjustment = { mode: "absolute", value: 0, reason: "" };
  const [stockAdj, setStockAdj] = useState<StockAdjustment>(defaultStockAdj);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Image upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // 300ms debounce
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  const fetchProducts = useCallback(async () => {
    setIsLoadingProducts(true);
    try {
      const params = new URLSearchParams();
      if (debouncedQuery) params.set("q", debouncedQuery);
      if (filterCategory !== "all") params.set("categoryId", filterCategory);
      const res = await fetch(`/api/admin/products?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } catch (err) {
      console.error("Failed to load products", err);
    } finally {
      setIsLoadingProducts(false);
    }
  }, [debouncedQuery, filterCategory]);

  const fetchCategories = useCallback(async () => {
    setIsLoadingCategories(true);
    try {
      const res = await fetch("/api/admin/categories");
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
      }
    } catch (err) {
      console.error("Failed to load categories", err);
    } finally {
      setIsLoadingCategories(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Clear feedback after 4s
  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  // ---------------------------------------------------------------------------
  // Product handlers
  // ---------------------------------------------------------------------------
  const openAddProduct = () => {
    setEditingProduct(null);
    setProductForm({
      ...defaultProductForm,
      categoryId: categories[0]?.id || "",
    });
    setUploadError(null);
    setShowProductModal(true);
  };

  const openEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      description: product.description || "",
      priceCents: product.priceCents,
      categoryId: product.categoryId,
      stockQuantity: product.stockQuantity,
      imageUrl: product.imageUrl || "",
      isActive: product.isActive,
    });
    setUploadError(null);
    setShowProductModal(true);
  };

  const handleProductSubmit = async () => {
    if (!productForm.name.trim()) return;
    setIsSubmitting(true);
    try {
      const body = {
        name: productForm.name.trim(),
        description: productForm.description.trim(),
        priceCents: productForm.priceCents,
        categoryId: productForm.categoryId,
        stockQuantity: productForm.stockQuantity,
        imageUrl: productForm.imageUrl.trim() || null,
        isActive: productForm.isActive,
      };

      let res: Response;
      if (editingProduct) {
        res = await fetch("/api/admin/products", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingProduct.id, ...body }),
        });
      } else {
        res = await fetch("/api/admin/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to save product");
      }

      setFeedback({ type: "success", message: editingProduct ? "Product updated!" : "Product created!" });
      setShowProductModal(false);
      fetchProducts();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to save product" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleProductActive = async (product: Product) => {
    try {
      const res = await fetch("/api/admin/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: product.id, isActive: !product.isActive }),
      });
      if (!res.ok) throw new Error("Failed to toggle product");
      // Optimistic update
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, isActive: !p.isActive } : p))
      );
      setFeedback({
        type: "success",
        message: `${product.name} ${product.isActive ? "deactivated" : "activated"}`,
      });
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    }
  };

  // Stock adjustment
  const openStockModal = (product: Product) => {
    setStockProduct(product);
    setStockAdj({ mode: "absolute", value: product.stockQuantity, reason: "" });
    setShowStockModal(true);
  };

  const handleStockSubmit = async () => {
    if (!stockProduct || !stockAdj.reason.trim()) return;
    setIsSubmitting(true);
    try {
      const body: Record<string, unknown> = { reason: stockAdj.reason.trim() };
      if (stockAdj.mode === "absolute") {
        body.newQuantity = stockAdj.value;
      } else {
        body.delta = stockAdj.value;
      }

      const res = await fetch(`/api/admin/products/${stockProduct.id}/stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to adjust stock");
      }

      const result = await res.json();
      setFeedback({
        type: "success",
        message: `Stock updated: ${result.oldStock} → ${result.newStock}`,
      });
      setShowStockModal(false);
      fetchProducts();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Category handlers
  // ---------------------------------------------------------------------------
  const openAddCategory = () => {
    setEditingCategory(null);
    setCategoryForm(defaultCategoryForm);
    setShowCategoryModal(true);
  };

  const openEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryForm({ name: category.name, slug: category.slug, isActive: category.isActive });
    setShowCategoryModal(true);
  };

  const handleCategorySubmit = async () => {
    if (!categoryForm.name.trim() || !categoryForm.slug.trim()) return;
    setIsSubmitting(true);
    try {
      const body = {
        name: categoryForm.name.trim(),
        slug: categoryForm.slug.trim(),
        isActive: categoryForm.isActive,
      };

      let res: Response;
      if (editingCategory) {
        res = await fetch("/api/admin/categories", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingCategory.id, ...body }),
        });
      } else {
        res = await fetch("/api/admin/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to save category");
      }

      setFeedback({ type: "success", message: editingCategory ? "Category updated!" : "Category created!" });
      setShowCategoryModal(false);
      fetchCategories();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-slug generator
  const autoSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  // Image upload handler
  const handleImageUpload = async (file: File) => {
    setUploadError(null);
    setIsUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setProductForm((prev) => ({ ...prev, imageUrl: data.url }));
    } catch (err: any) {
      setUploadError(err.message || "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const getCategoryName = (categoryId: string) => {
    return categories.find((c) => c.id === categoryId)?.name || "—";
  };

  const getProductCountForCategory = (categoryId: string) => {
    return products.filter((p) => p.categoryId === categoryId).length;
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-black text-slate-900">Catalog Management</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Manage products, categories, pricing and stock levels.
        </p>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          data-testid="catalog-feedback"
          className={`p-3 rounded-lg text-xs font-medium border ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        <button
          type="button"
          data-testid="tab-products"
          onClick={() => setActiveTab("products")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition ${
            activeTab === "products"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <PackageIcon className="w-4 h-4" />
          Products
        </button>
        <button
          type="button"
          data-testid="tab-categories"
          onClick={() => setActiveTab("categories")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition ${
            activeTab === "categories"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <Layers className="w-4 h-4" />
          Categories
        </button>
      </div>

      {/* ======== PRODUCTS TAB ======== */}
      {activeTab === "products" && (
        <div className="space-y-4">
          {/* Toolbar: Search + Filter + Add */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                data-testid="product-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
              />
            </div>
            <select
              data-testid="product-category-filter"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="py-2 px-3 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 min-w-[180px]"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              data-testid="add-product-btn"
              onClick={openAddProduct}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition shrink-0"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </button>
          </div>

          {/* Products Table */}
          {isLoadingProducts ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 rounded-lg bg-slate-200 animate-pulse" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
              <PackageX className="w-16 h-16 mx-auto mb-3 text-slate-300" />
              <h3 className="text-base font-semibold text-slate-700 mb-1">No products found</h3>
              <p className="text-xs text-slate-400">
                {debouncedQuery || filterCategory !== "all"
                  ? "Try adjusting your search or filters."
                  : "Add your first product to get started."}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="products-table">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-left">
                      <th className="px-4 py-3 text-xs font-semibold text-slate-600">Product</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-600">Category</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-600">Price</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-600">Stock</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-600">Status</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-600 text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {products.map((product) => (
                      <tr
                        key={product.id}
                        data-testid={`product-row-${product.id}`}
                        className="hover:bg-slate-50 transition"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-10 h-10 rounded-lg object-cover bg-slate-100"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                                <PackageIcon className="w-4 h-4" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <span className="font-semibold text-slate-900 block truncate max-w-[200px]">
                                {product.name}
                              </span>
                              {product.sku && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  SKU: {product.sku}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {getCategoryName(product.categoryId)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {formatCurrency(product.priceCents)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-semibold ${
                              product.stockQuantity <= (product.lowStockThreshold ?? 5)
                                ? "text-red-600"
                                : "text-slate-700"
                            }`}
                          >
                            {product.stockQuantity <= (product.lowStockThreshold ?? 5) && (
                              <AlertTriangle className="w-3 h-3" />
                            )}
                            {product.stockQuantity}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              product.isActive
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {product.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              data-testid={`edit-product-${product.id}`}
                              onClick={() => openEditProduct(product)}
                              title="Edit Product"
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              data-testid={`toggle-product-${product.id}`}
                              onClick={() => toggleProductActive(product)}
                              title={product.isActive ? "Deactivate" : "Activate"}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition"
                            >
                              {product.isActive ? (
                                <ToggleRight className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <ToggleLeft className="w-4 h-4 text-slate-400" />
                              )}
                            </button>
                            <button
                              type="button"
                              data-testid={`stock-adjust-${product.id}`}
                              onClick={() => openStockModal(product)}
                              title="Adjust Stock"
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition"
                            >
                              <ArrowUpDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======== CATEGORIES TAB ======== */}
      {activeTab === "categories" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              data-testid="add-category-btn"
              onClick={openAddCategory}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition"
            >
              <Plus className="w-4 h-4" />
              Add Category
            </button>
          </div>

          {isLoadingCategories ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 rounded-lg bg-slate-200 animate-pulse" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
              <Layers className="w-16 h-16 mx-auto mb-3 text-slate-300" />
              <h3 className="text-base font-semibold text-slate-700 mb-1">No categories</h3>
              <p className="text-xs">Create your first category to organize products.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm" data-testid="categories-table">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-left">
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600">Name</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600">Slug</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600">Products</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {categories.map((cat) => (
                    <tr
                      key={cat.id}
                      data-testid={`category-row-${cat.id}`}
                      className="hover:bg-slate-50 transition"
                    >
                      <td className="px-4 py-3 font-semibold text-slate-900">{cat.name}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 font-mono">{cat.slug}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {getProductCountForCategory(cat.id)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            cat.isActive
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {cat.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          data-testid={`edit-category-${cat.id}`}
                          onClick={() => openEditCategory(cat)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ======== PRODUCT MODAL ======== */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            data-testid="product-modal"
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">
                {editingProduct ? "Edit Product" : "Add New Product"}
              </h2>
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  data-testid="product-name-input"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  placeholder="e.g. Ballpoint Pen Pack"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  data-testid="product-description-input"
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  rows={3}
                  placeholder="Product description..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              {/* Price & Category */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Price ($) *
                  </label>
                  <input
                    type="number"
                    data-testid="product-price-input"
                    value={(productForm.priceCents / 100).toFixed(2)}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        priceCents: Math.round(parseFloat(e.target.value || "0") * 100),
                      })
                    }
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category *
                  </label>
                  <select
                    data-testid="product-category-select"
                    value={productForm.categoryId}
                    onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="">Select category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {/* Stock Quantity */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Stock Quantity
                </label>
                <input
                  type="number"
                  data-testid="product-stock-input"
                  value={productForm.stockQuantity}
                  onChange={(e) =>
                    setProductForm({
                      ...productForm,
                      stockQuantity: parseInt(e.target.value || "0", 10),
                    })
                  }
                  min="0"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              {/* Image Upload Zone */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product Image
                </label>

                {/* Preview strip — shown when an image URL exists */}
                {productForm.imageUrl && (
                  <div className="flex items-center gap-3 mb-2 p-2 rounded-lg bg-slate-50 border border-slate-200">
                    <img
                      src={productForm.imageUrl}
                      alt="Preview"
                      className="w-14 h-14 rounded-lg object-cover bg-slate-200 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">{productForm.imageUrl}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Current image</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setProductForm((p) => ({ ...p, imageUrl: "" }))}
                      className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-red-500 transition shrink-0"
                      title="Remove image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    const file = e.dataTransfer.files[0];
                    if (file) handleImageUpload(file);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative flex flex-col items-center justify-center gap-2 py-5 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                    isDragOver
                      ? "border-indigo-400 bg-indigo-50"
                      : "border-slate-200 bg-slate-50 hover:border-slate-400 hover:bg-slate-100"
                  }`}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                      <p className="text-xs text-slate-500">Uploading…</p>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-6 h-6 text-slate-400" />
                      <p className="text-xs font-medium text-slate-600">
                        Drop image here or <span className="text-indigo-600 underline">browse</span>
                      </p>
                      <p className="text-[10px] text-slate-400">JPEG, PNG, WebP, GIF · Max 5 MB</p>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file);
                      e.target.value = "";
                    }}
                  />
                </div>

                {uploadError && (
                  <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    {uploadError}
                  </p>
                )}

                {/* Fallback: manual URL entry */}
                <div className="mt-2">
                  <input
                    type="text"
                    data-testid="product-image-input"
                    value={productForm.imageUrl}
                    onChange={(e) => setProductForm({ ...productForm, imageUrl: e.target.value })}
                    placeholder="Or paste an image URL / /uploads/filename.jpg"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="product-submit-btn"
                onClick={handleProductSubmit}
                disabled={isSubmitting || !productForm.name.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingProduct ? "Save Changes" : "Create Product"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======== STOCK ADJUSTMENT MODAL ======== */}
      {showStockModal && stockProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            data-testid="stock-modal"
            className="bg-white rounded-xl shadow-2xl w-full max-w-md"
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Adjust Stock</h2>
              <button
                type="button"
                onClick={() => setShowStockModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-xs text-slate-500 block">Product</span>
                <span className="font-semibold text-sm text-slate-900">{stockProduct.name}</span>
                <span className="text-xs text-slate-400 block">
                  Current stock: {stockProduct.stockQuantity}
                </span>
              </div>

              {/* Mode Toggle */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setStockAdj({ ...stockAdj, mode: "absolute", value: stockProduct.stockQuantity })
                  }
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition ${
                    stockAdj.mode === "absolute"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  Set Absolute
                </button>
                <button
                  type="button"
                  onClick={() => setStockAdj({ ...stockAdj, mode: "delta", value: 0 })}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition ${
                    stockAdj.mode === "delta"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  +/- Delta
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {stockAdj.mode === "absolute" ? "New Quantity" : "Delta (+/-)"}
                </label>
                <input
                  type="number"
                  data-testid="stock-value-input"
                  value={stockAdj.value}
                  onChange={(e) =>
                    setStockAdj({ ...stockAdj, value: parseInt(e.target.value || "0", 10) })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason *
                </label>
                <input
                  type="text"
                  data-testid="stock-reason-input"
                  value={stockAdj.reason}
                  onChange={(e) => setStockAdj({ ...stockAdj, reason: e.target.value })}
                  placeholder="e.g. Restock delivery, Inventory correction"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowStockModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="stock-submit-btn"
                onClick={handleStockSubmit}
                disabled={isSubmitting || !stockAdj.reason.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowUpDown className="w-4 h-4" />
                )}
                Update Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======== CATEGORY MODAL ======== */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            data-testid="category-modal"
            className="bg-white rounded-xl shadow-2xl w-full max-w-md"
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">
                {editingCategory ? "Edit Category" : "Add New Category"}
              </h2>
              <button
                type="button"
                onClick={() => setShowCategoryModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  data-testid="category-name-input"
                  value={categoryForm.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setCategoryForm({
                      ...categoryForm,
                      name,
                      slug: editingCategory ? categoryForm.slug : autoSlug(name),
                    });
                  }}
                  placeholder="e.g. Office Furniture"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Slug *</label>
                <input
                  type="text"
                  data-testid="category-slug-input"
                  value={categoryForm.slug}
                  onChange={(e) => setCategoryForm({ ...categoryForm, slug: e.target.value })}
                  placeholder="office-furniture"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="cat-active"
                  data-testid="category-active-checkbox"
                  checked={categoryForm.isActive}
                  onChange={(e) => setCategoryForm({ ...categoryForm, isActive: e.target.checked })}
                  className="rounded border-slate-300"
                />
                <label htmlFor="cat-active" className="text-xs font-medium text-slate-700">
                  Active
                </label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowCategoryModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="category-submit-btn"
                onClick={handleCategorySubmit}
                disabled={isSubmitting || !categoryForm.name.trim() || !categoryForm.slug.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingCategory ? "Save Changes" : "Create Category"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

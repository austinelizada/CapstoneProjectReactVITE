import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Package,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  ChevronDown,
} from "lucide-react";
import * as catalogApi from '@/api/catalog';
import { API_BASE } from "@/api/client";

import Sidebar from "../../components/layout/Sidebar";
import Navbar from "../../components/layout/Navbar";
import AdminPageHeader from "../../components/layout/AdminPageHeader";
import { calculateEstimate } from "../../lib/estimator";
import { useAuth } from "@/contexts/AuthContext";
import {
  getProducts,
  createProduct as createProductApi,
  updateProduct as updateProductApi,
  deleteProduct as deleteProductApi,
} from "@/api/products";
import { recordActivity } from "@/lib/activityLog";

const PRODUCT_IMAGE_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='400' viewBox='0 0 600 400'%3E%3Crect width='600' height='400' fill='%23e2e8f0'/%3E%3Cpath d='M248 148h104a28 28 0 0 1 28 28v48a28 28 0 0 1-28 28H248a28 28 0 0 1-28-28v-48a28 28 0 0 1 28-28Zm0 20a8 8 0 0 0-8 8v48a8 8 0 0 0 8 8h104a8 8 0 0 0 8-8v-48a8 8 0 0 0-8-8H248Zm18 22a16 16 0 1 1 0 32 16 16 0 0 1 0-32Zm50 35 17-21 31 40H244l34-42 25 30 13-7Z' fill='%2394a3b8'/%3E%3Ctext x='300' y='292' text-anchor='middle' font-family='Arial, sans-serif' font-size='24' font-weight='700' fill='%23475569'%3EProduct image%3C/text%3E%3C/svg%3E";

const MEASUREMENT_UNITS = [
  ["in", "Inches (in)"],
  ["cm", "Centimeters (cm)"],
  ["m", "Meters (m)"],
];

function CatalogPicker({ label, value, options, onChange, onAdd, placeholder, disabled = false }) {
  const actionLabel = label.replace(/\s*\*+\s*$/, "");
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newOption, setNewOption] = useState("");
  const [savingOption, setSavingOption] = useState(false);
  const [error, setError] = useState("");
  const [menuPosition, setMenuPosition] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const updateMenuPosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 16;
    const spaceAbove = rect.top - 16;
    const openAbove = spaceBelow < 260 && spaceAbove > spaceBelow;
    const availableSpace = openAbove ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(100, Math.min(320, availableSpace - 8));
    const top = openAbove
      ? Math.max(8, rect.top - maxHeight - 8)
      : Math.min(rect.bottom + 8, window.innerHeight - maxHeight - 8);

    setMenuPosition({
      position: "fixed",
      top,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
      width: rect.width,
      maxHeight,
    });
  };

  useEffect(() => {
    if (!isOpen) return undefined;

    updateMenuPosition();
    const closeOnOutsideClick = (event) => {
      if (triggerRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      setIsOpen(false);
      setIsAdding(false);
    };
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      setIsAdding(false);
    };

    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  const saveOption = async (event) => {
    event.preventDefault();
    const trimmedOption = newOption.trim();
    if (!trimmedOption) return;

    setSavingOption(true);
    setError("");
    try {
      const savedOption = await onAdd(trimmedOption);
      onChange(savedOption || trimmedOption);
      setNewOption("");
      setIsAdding(false);
      setIsOpen(false);
    } catch (saveError) {
      setError(saveError?.data?.message || saveError?.message || `Unable to add ${actionLabel.toLowerCase()}.`);
    } finally {
      setSavingOption(false);
    }
  };

  return (
    <div className="relative">
      <label className="mb-2 block text-sm font-semibold text-slate-700">{label}</label>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => {
          if (!isOpen) updateMenuPosition();
          setIsOpen((open) => !open);
        }}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-rose-200 bg-[#fffafa] px-4 py-3 text-left text-sm text-slate-900 outline-none transition hover:border-rose-300 focus:border-red-700 focus:ring-2 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={value ? "truncate" : "truncate text-slate-400"}>{value || placeholder}</span>
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && !disabled && menuPosition && createPortal(
        <div ref={menuRef} style={menuPosition} className="z-[100] overflow-y-auto rounded-xl border border-red-700 bg-white shadow-xl">
          <div className="max-h-56 overflow-y-auto py-1" role="listbox" aria-label={label}>
            {options.map((option) => (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={value === option}
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                  setIsAdding(false);
                }}
                className={`w-full px-4 py-3 text-left text-sm transition hover:bg-rose-50 ${value === option ? "bg-rose-100 font-semibold text-red-900" : "text-slate-800"}`}
              >
                {value === option && <span className="mr-2 text-red-800" aria-hidden="true">✓</span>}
                {option}
              </button>
            ))}
            {options.length === 0 && <p className="px-4 py-3 text-sm text-slate-500">No options yet.</p>}
          </div>

          <div className="border-t border-rose-100 p-2">
            {isAdding ? (
              <form onSubmit={saveOption} className="space-y-2">
                <input
                  autoFocus
                  value={newOption}
                  onChange={(event) => setNewOption(event.target.value)}
                  placeholder={`New ${actionLabel.toLowerCase()}`}
                  className="w-full rounded-lg border border-rose-200 px-3 py-2 text-sm outline-none focus:border-red-600"
                />
                {error && <p className="text-xs text-red-600">{error}</p>}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setIsAdding(false)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
                  <button type="submit" disabled={savingOption || !newOption.trim()} className="rounded-lg bg-red-800 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                    {savingOption ? "Adding..." : "Add"}
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setIsAdding(true)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold text-red-900 hover:bg-rose-50"
              >
                <Plus size={16} aria-hidden="true" />
                Add new {actionLabel.toLowerCase()}...
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function ProductFormModal({
  editingProduct,
  newProduct,
  setNewProduct,
  productTypeOptions,
  categoryOptions,
  variantOptions,
  pricingMethodByName,
  uploaderSections,
  uploadProgress,
  uploading,
  modalError,
  saveProduct,
  closeModal,
  cancelUpload,
  saveCatalogOption,
}) {
  const updateField = (field, value) => setNewProduct((product) => ({ ...product, [field]: value }));
  const mainImage = uploaderSections.find(([key]) => key === "main");
  const angleImages = uploaderSections.filter(([key]) => key !== "main");
  const imageName = (key) => newProduct.imageFiles?.[key]?.name || newProduct.images?.[key]?.split("/").pop() || "";

  const setImageFile = (key, file) => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setNewProduct((product) => ({
      ...product,
      images: { ...product.images, [key]: previewUrl },
      imageFiles: { ...product.imageFiles, [key]: file },
    }));
  };

  const removeImage = (key) => setNewProduct((product) => ({
    ...product,
    images: { ...product.images, [key]: undefined },
    imageFiles: { ...product.imageFiles, [key]: undefined },
  }));

  const renderImageDropzone = ([key, label], isMain = false) => (
    <div key={key}>
      <p className="mb-2 text-sm font-semibold text-slate-700">{label}</p>
      <label
        className={`group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-rose-200 bg-[#fffafa] text-center transition hover:border-red-500 hover:bg-rose-50 ${isMain ? "min-h-36 px-5 py-6" : "aspect-square min-h-24 px-2 py-3"}`}
        onDrop={(event) => {
          event.preventDefault();
          setImageFile(key, event.dataTransfer.files?.[0]);
        }}
        onDragOver={(event) => event.preventDefault()}
      >
        <input
          type="file"
          accept="image/*"
          onChange={(event) => {
            setImageFile(key, event.target.files?.[0]);
            event.target.value = "";
          }}
          className="sr-only"
        />
        {newProduct.images?.[key] ? (
          <img src={newProduct.images[key]} alt={`${label} preview`} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <>
            <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-rose-100 text-red-900" aria-hidden="true">
              <Plus size={18} />
            </span>
            <span className="text-xs font-semibold text-slate-700">{label}</span>
            {isMain && <span className="mt-1 text-xs text-slate-400">Drag and drop or browse</span>}
          </>
        )}
        {uploading && uploadProgress[key] !== undefined && (
          <span className="absolute inset-0 flex items-center justify-center bg-slate-950/60 text-sm font-semibold text-white">
            Uploading {uploadProgress[key]}%
          </span>
        )}
      </label>
      <div className="mt-1 flex min-h-5 items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs text-slate-500" title={imageName(key)}>{imageName(key) || ""}</span>
        {newProduct.images?.[key] && (
          <button type="button" onClick={() => removeImage(key)} className="shrink-0 text-xs font-semibold text-red-700 hover:text-red-900">
            Remove
          </button>
        )}
      </div>
    </div>
  );

  const sectionHeading = (title) => (
    <div className="mb-5 flex items-center gap-3">
      <h3 className="shrink-0 text-xs font-bold uppercase tracking-[0.14em] text-slate-700">{title}</h3>
      <div className="h-px flex-1 bg-slate-200" />
    </div>
  );

  const fieldClass = "min-h-12 w-full rounded-xl border border-rose-200 bg-[#fffafa] px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-700 focus:ring-2 focus:ring-red-100";
  const labelClass = "mb-2 block text-sm font-semibold text-slate-700";
  const displayedEstimatedPrice = Number(newProduct.estimated_price_override) > 0
    ? Number(newProduct.estimated_price_override)
    : Number(newProduct.estimated_price || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-2 backdrop-blur-sm sm:p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-form-title"
        className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-rose-100 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)]"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-rose-100 bg-[#fff8f7] px-5 py-4 sm:px-7">
          <div>
            <h2 id="product-form-title" className="text-xl font-bold text-slate-950">
              {editingProduct ? "Edit Product" : "Add New Product"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {editingProduct ? "Update the product details and availability." : "Fill in the details to create a new product."}
            </p>
          </div>
          <button
            type="button"
            onClick={closeModal}
            aria-label="Close product form"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-100 bg-white text-slate-500 transition hover:bg-rose-50 hover:text-slate-900"
          >
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          {modalError && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
              {modalError}
            </div>
          )}

          <section>
            {sectionHeading("Product Information")}
            <div className="grid gap-5 md:grid-cols-2">
              <CatalogPicker
                label="Product Type *"
                value={newProduct.product_type}
                options={productTypeOptions}
                placeholder="Select product type"
                onChange={(value) => setNewProduct((product) => ({ ...product, product_type: value, product_name: "", pricing_method: "", variant: "" }))}
                onAdd={(name) => saveCatalogOption("types", name)}
              />
              <CatalogPicker
                label="Category *"
                value={newProduct.category}
                options={categoryOptions}
                placeholder="Select category"
                onChange={(value) => updateField("category", value)}
                onAdd={(name) => saveCatalogOption("categories", name)}
              />
              <div className="md:col-span-2">
                <label htmlFor="product-name-input" className={labelClass}>Product Name *</label>
                <input
                  id="product-name-input"
                  type="text"
                  value={newProduct.product_name}
                  disabled={!newProduct.product_type}
                  onChange={(event) => {
                    const value = event.target.value;
                    setNewProduct((product) => ({
                      ...product,
                      product_name: value,
                      pricing_method: pricingMethodByName[value] || "",
                      variant: "",
                    }));
                  }}
                  placeholder="Type product name"
                  className={fieldClass}
                />
              </div>
              <div className="md:col-span-2">
                <CatalogPicker
                  label="Variant"
                  value={newProduct.variant}
                  options={variantOptions}
                  placeholder="Select variant"
                  disabled={!newProduct.product_name}
                  onChange={(value) => updateField("variant", value)}
                  onAdd={(name) => saveCatalogOption("variants", name)}
                />
                <p className="mt-2 text-xs text-slate-400">Variants are scoped to the selected product name.</p>
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Description</label>
                <textarea
                  rows={3}
                  value={newProduct.description}
                  onChange={(event) => updateField("description", event.target.value)}
                  placeholder="Describe the product, materials, use case, and special features..."
                  className={`${fieldClass} resize-y`}
                />
              </div>
            </div>
          </section>

          <section>
            {sectionHeading("Measurements & Pricing")}
            <div className="grid gap-5 md:grid-cols-3">
              <>
                  <div>
                    <label className={labelClass}>Width *</label>
                    <input type="number" min="0" value={newProduct.width} onChange={(event) => updateField("width", event.target.value)} placeholder="0" className={fieldClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Height *</label>
                    <input type="number" min="0" value={newProduct.height} onChange={(event) => updateField("height", event.target.value)} placeholder="0" className={fieldClass} />
                  </div>
                  <div>
                    <label htmlFor="product-measurement-unit" className={labelClass}>Unit</label>
                    <select id="product-measurement-unit" value={newProduct.unit || "in"} onChange={(event) => updateField("unit", event.target.value)} className={fieldClass}>
                      {MEASUREMENT_UNITS.map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <label className={labelClass}>Price Per Square Foot (PHP) *</label>
                    <input type="number" min="0" value={newProduct.price_per_sqft} onChange={(event) => updateField("price_per_sqft", event.target.value)} placeholder="0.00" className={fieldClass} />
                  </div>
              </>

              {newProduct.pricing_method === "blade" && (
                <>
                  <div>
                    <label className={labelClass}>Blade Count *</label>
                    <input type="number" min="1" value={newProduct.blade_count} onChange={(event) => updateField("blade_count", event.target.value)} placeholder="0" className={fieldClass} />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Price Per Blade (PHP) *</label>
                    <input type="number" min="0" value={newProduct.price_per_blade} onChange={(event) => updateField("price_per_blade", event.target.value)} placeholder="0.00" className={fieldClass} />
                  </div>
                </>
              )}

              {newProduct.pricing_method === "fixed" && (
                <>
                  <div>
                    <label className={labelClass}>Standard Size</label>
                    <input type="text" value={newProduct.standard_size || ""} onChange={(event) => updateField("standard_size", event.target.value)} placeholder="e.g. 900 x 2100 mm" className={fieldClass} />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Base Price (PHP) *</label>
                    <input type="number" min="0" value={newProduct.base_price} onChange={(event) => updateField("base_price", event.target.value)} placeholder="0.00" className={fieldClass} />
                  </div>
                </>
              )}

              <div className="md:col-span-3 rounded-xl border border-rose-200 bg-rose-50/80 px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-red-950">Estimated Cost</p>
                    <p className="mt-1 text-xs text-red-800/70">Auto-calculated from dimensions and pricing</p>
                    <p className="mt-1 text-xs text-red-800/70">Estimated area: {Number(newProduct.estimated_area || 0).toFixed(2)} sq ft</p>
                  </div>
                  <p className="shrink-0 text-2xl font-black text-red-950">₱{displayedEstimatedPrice.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>

              <div className="md:col-span-3">
                <label className={labelClass}>Override Estimated Cost (PHP)</label>
                <input type="number" min="0" value={newProduct.estimated_price_override || ""} onChange={(event) => updateField("estimated_price_override", event.target.value)} placeholder="Leave blank to use auto-calculated cost" className={fieldClass} />
              </div>
            </div>
          </section>

          <section>
            {sectionHeading("Product Images")}
            {mainImage && renderImageDropzone(mainImage, true)}
            <div className="mt-5">
              <p className="mb-3 text-sm font-semibold text-slate-700">Viewing Angles</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {angleImages.map((section) => renderImageDropzone(section))}
              </div>
            </div>
            {uploading && (
              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 sm:flex-row sm:items-center sm:justify-between">
                <span>Uploading images...</span>
                <button type="button" onClick={cancelUpload} className="self-start rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 sm:self-auto">
                  Cancel upload
                </button>
              </div>
            )}
          </section>

          <section>
            {sectionHeading("Status")}
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(newProduct.is_active)}
              onClick={() => updateField("is_active", !newProduct.is_active)}
              className="flex w-full items-center justify-between gap-4 rounded-xl border border-rose-100 bg-[#fffafa] p-4 text-left transition hover:border-rose-200"
            >
              <span>
                <span className="block text-sm font-semibold text-slate-800">Active Product</span>
                <span className="mt-1 block text-xs text-slate-500">{newProduct.is_active ? "This product is live and visible." : "This product is hidden from customers."}</span>
              </span>
              <span className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${newProduct.is_active ? "bg-emerald-500" : "bg-slate-300"}`}>
                <span className={`h-5 w-5 rounded-full bg-white shadow transition ${newProduct.is_active ? "translate-x-5" : "translate-x-0.5"}`} />
              </span>
            </button>
          </section>
        </div>

        <footer className="flex shrink-0 justify-end gap-3 border-t border-rose-100 bg-[#fff8f7] px-5 py-3 sm:px-7">
          <button type="button" onClick={closeModal} className="rounded-xl border border-rose-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-rose-50">
            Cancel
          </button>
          <button type="button" onClick={saveProduct} disabled={uploading} className="inline-flex items-center gap-2 rounded-xl bg-red-900 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60">
            <span aria-hidden="true">✓</span>
            {editingProduct ? "Update Product" : "Create Product"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function Products() {
  const API_HOST = (function getApiHost() {
    try {
      return (API_BASE || "").replace(/\/api$/, "");
    } catch (e) {
      return "";
    }
  })();

  const isLocalBlobOrFile = (url) => typeof url === "string" && (url.startsWith("blob:") || url.startsWith("file:"));

  const ensureAbsoluteUrl = (url) => {
    if (!url) return PRODUCT_IMAGE_PLACEHOLDER;
    if (isLocalBlobOrFile(url)) return PRODUCT_IMAGE_PLACEHOLDER;
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith("/")) return API_HOST ? `${API_HOST}${url}` : url;
    if (url.startsWith("uploads/")) return API_HOST ? `${API_HOST}/${url}` : `/${url}`;
    return API_HOST ? `${API_HOST}/${url}` : url;
  };

  const resolveProductImage = (product) => {
    if (!product) return PRODUCT_IMAGE_PLACEHOLDER;
    if (product.image && !isLocalBlobOrFile(product.image)) return ensureAbsoluteUrl(product.image);
    if (product.image_url && !isLocalBlobOrFile(product.image_url)) return ensureAbsoluteUrl(product.image_url);
    const imgs = product.images;
    if (!imgs) return PRODUCT_IMAGE_PLACEHOLDER;
    if (typeof imgs === "string") return ensureAbsoluteUrl(imgs);
    if (Array.isArray(imgs) && imgs.length > 0) {
      const first = imgs[0];
      if (typeof first === "string") return ensureAbsoluteUrl(first);
      if (first && typeof first === "object" && first.url) return ensureAbsoluteUrl(first.url);
    }
    if (typeof imgs === "object") {
      if (imgs.main && !isLocalBlobOrFile(imgs.main)) return ensureAbsoluteUrl(imgs.main);
      const keys = Object.keys(imgs);
      for (let k of keys) {
        const val = imgs[k];
        if (!val) continue;
        if (typeof val === "string" && !isLocalBlobOrFile(val)) return ensureAbsoluteUrl(val);
        if (Array.isArray(val) && val.length > 0) {
          const f = val[0];
          if (typeof f === "string") return ensureAbsoluteUrl(f);
          if (f && f.url) return ensureAbsoluteUrl(f.url);
        }
        if (val && val.url && !isLocalBlobOrFile(val.url)) return ensureAbsoluteUrl(val.url);
      }
    }
    return PRODUCT_IMAGE_PLACEHOLDER;
  };

  const getProductPriceLabel = (product) => {
    const pricingMethod = product.pricing_method || PRICING_METHOD[product.product_name] || "";
    const sqftPrice = Number(product.price_per_sqft || 0);
    const bladePrice = Number(product.price_per_blade || 0);
    const unitPrice = Number(product.unit_price || 0);

    if (pricingMethod === "blade") {
      if (bladePrice > 0) return `₱${bladePrice.toLocaleString()} / blade`;
      if (unitPrice > 0) return `₱${unitPrice.toLocaleString()} / blade`;
      return "Contact us / blade";
    }

    if (pricingMethod === "sqft") {
      if (sqftPrice > 0) return `₱${sqftPrice.toLocaleString()} / sq ft`;
      if (unitPrice > 0) return `₱${unitPrice.toLocaleString()} / sq ft`;
      return "Contact us / sq ft";
    }

    if (pricingMethod === "fixed") {
      if (unitPrice > 0) return `₱${unitPrice.toLocaleString()}`;
      if (bladePrice > 0) return `₱${bladePrice.toLocaleString()} / blade`;
      return "Contact us";
    }

    if (unitPrice > 0) {
      return `₱${unitPrice.toLocaleString()}`;
    }

    return "Contact us";
  };

  const [isSidebarOpen, setIsSidebarOpen] =
    useState(() => {
      if (typeof window === "undefined") return true;
      const stored = localStorage.getItem("sidebarOpen");
      return stored !== null ? JSON.parse(stored) : true;
    });

  const [search, setSearch] = useState("");

  const [categoryFilter, setCategoryFilter] =
    useState("All");
  const [typeFilter, setTypeFilter] =
    useState("All");
  const [statusFilter, setStatusFilter] =
    useState("All");

  const [currentPage, setCurrentPage] =
    useState(1);

  const [showModal, setShowModal] =
    useState(false);

  const [products, setProducts] = useState([]);

  // --- Dynamic product configuration mappings ---
  const PRODUCT_TYPES = ["Glass", "Aluminum", "Mixed System"];

  const PRODUCT_NAMES = {
    Glass: ["Sliding Window", "Glass Door", "Jalousie Window"],
    Aluminum: ["Aluminum Door", "Aluminum Window"],
    "Mixed System": ["Sink Cabinet", "Hanging Cabinet"],
  };

  const PRICING_METHOD = {
    "Sliding Window": "sqft",
    "Aluminum Window": "sqft",
    "Sink Cabinet": "sqft",
    "Hanging Cabinet": "sqft",
    "Glass Door": "fixed",
    "Aluminum Door": "fixed",
    "Jalousie Window": "blade",
  };

  const VARIANTS = {
    "Sliding Window": ["Clear to RB", "Blue", "Reflective Blue to RG"],
    "Aluminum Window": ["Sliding", "Owning", "Swing", "Slide Up"],
    "Sink Cabinet": ["Modular", "Regular"],
    "Hanging Cabinet": ["Modular", "Regular"],
    "Jalousie Window": ["Clear to Bronze", "Smoke / Reflective Bronze to Blue", "Reflective Blue to RG"],
    "Glass Door": ["Clear", "Tinted"],
    "Aluminum Door": ["Standard", "Heavy Duty"],
  };

  const CATEGORY_OPTIONS = [
    "Windows",
    "Doors",
    "Cabinets",
    "Shower Enclosures",
    "Aluminum",
    "Glass",
    "Accessories",
  ];

  const DEFAULT_CATEGORY = "Windows";

  const getCatalogPayload = (value) => value?.items || value?.data || value || [];

  const getCatalogText = (value, fallback = "") => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === "string" || typeof value === "number") return String(value);
    if (typeof value === "object") {
      return String(
        value.name ||
        value.type ||
        value.variant ||
        value.product_name ||
        value.product_type ||
        value.title ||
        fallback
      );
    }
    return fallback;
  };

  const normalizeOptionValues = (value) => {
    const payload = getCatalogPayload(value);
    if (!Array.isArray(payload)) return [];

    const seen = new Set();
    return payload
      .map((item) => getCatalogText(item).trim())
      .filter((label) => {
        if (!label || seen.has(label)) return false;
        seen.add(label);
        return true;
      });
  };

  const mergeOptionValues = (...groups) => {
    const seen = new Set();
    return groups
      .flat()
      .map((item) => getCatalogText(item).trim())
      .filter((label) => {
        if (!label || seen.has(label)) return false;
        seen.add(label);
        return true;
      });
  };

  const mergeGroupedOptionValues = (...groups) => {
    const merged = {};
    groups.forEach((group) => {
      if (!group || typeof group !== "object") return;
      Object.entries(group).forEach(([key, values]) => {
        const groupName = getCatalogText(key).trim();
        if (!groupName) return;
        merged[groupName] = mergeOptionValues(merged[groupName] || [], Array.isArray(values) ? values : []);
      });
    });
    return merged;
  };

  const withSelectedOption = (options, selected) => mergeOptionValues(options, selected ? [selected] : []);

  const normalizeGroupedOptionValues = (value, groupKey) => {
    const payload = getCatalogPayload(value);
    const grouped = {};

    const addOption = (group, option) => {
      const groupLabel = getCatalogText(group).trim();
      const optionLabel = getCatalogText(option).trim();
      if (!groupLabel || !optionLabel) return;
      grouped[groupLabel] = grouped[groupLabel] || [];
      if (!grouped[groupLabel].includes(optionLabel)) {
        grouped[groupLabel].push(optionLabel);
      }
    };

    if (Array.isArray(payload)) {
      payload.forEach((item) => addOption(item?.[groupKey], item));
      return grouped;
    }

    if (payload && typeof payload === "object") {
      Object.entries(payload).forEach(([group, options]) => {
        (Array.isArray(options) ? options : []).forEach((option) => addOption(group, option));
      });
    }

    return grouped;
  };

  const normalizeProductForState = (product, fallback = {}) => {
    const category = getCatalogText(product.category, fallback.category || DEFAULT_CATEGORY);
    const productType = getCatalogText(product.product_type || product.type, fallback.product_type || fallback.type || "");
    const productName = getCatalogText(product.product_name || product.name, fallback.product_name || fallback.name || "");
    const variant = getCatalogText(product.variant, fallback.variant || "");
    const type = productType ||
      (category.toLowerCase() === "glass"
        ? "Glass"
        : category.toLowerCase() === "aluminum"
        ? "Aluminum"
        : "Mixed System");

    return {
      ...product,
      id: product._id || product.id || fallback.id,
      name: productName,
      product_type: productType,
      product_name: productName,
      category,
      variant,
      type,
      price:
        product.price ||
        `₱${(product.unit_price || fallback.unit_price || 0).toLocaleString()}`,
      image: resolveProductImage(product),
    };
  };

  const [productTypesList, setProductTypesList] = useState(PRODUCT_TYPES);
  const [productNamesList, setProductNamesList] = useState(PRODUCT_NAMES);
  const [categoryOptionsList, setCategoryOptionsList] = useState(CATEGORY_OPTIONS);
  const [variantsList, setVariantsList] = useState(VARIANTS);

  const reloadCatalogLists = async () => {
    const [types, names, categories, vars] = await Promise.allSettled([
      catalogApi.getTypes(),
      catalogApi.getNames(),
      catalogApi.getCategories(),
      catalogApi.getVariants(),
    ]);

    if (types.status === "fulfilled") {
      setProductTypesList(mergeOptionValues(PRODUCT_TYPES, normalizeOptionValues(types.value)));
    } else {
      console.error("Failed to load product types", types.reason);
    }

    if (names.status === "fulfilled") {
      setProductNamesList(mergeGroupedOptionValues(PRODUCT_NAMES, normalizeGroupedOptionValues(names.value, "product_type")));
    } else {
      console.error("Failed to load product names", names.reason);
    }

    if (categories.status === "fulfilled") {
      setCategoryOptionsList(mergeOptionValues(CATEGORY_OPTIONS, normalizeOptionValues(categories.value)));
    } else {
      console.error("Failed to load categories", categories.reason);
    }

    if (vars.status === "fulfilled") {
      setVariantsList(mergeGroupedOptionValues(VARIANTS, normalizeGroupedOptionValues(vars.value, "product_name")));
    } else {
      console.error("Failed to load variants", vars.reason);
    }
  };

  const saveCatalogOption = async (kind, name) => {
    if (kind === "types") await catalogApi.createType({ name });
    if (kind === "names") await catalogApi.createName({ name, product_type: newProduct.product_type });
    if (kind === "categories") await catalogApi.createCategory({ name });
    if (kind === "variants") {
      const productName = newProduct.product_name.trim();
      if (!productName) throw new Error("Enter a Product Name before adding a variant.");
      await catalogApi.createVariant({ name, product_name: productName });
    }

    if (kind === "types") {
      setProductTypesList((current) => mergeOptionValues(current, [name]));
    }
    if (kind === "categories") {
      setCategoryOptionsList((current) => mergeOptionValues(current, [name]));
    }
    if (kind === "variants") {
      const productName = newProduct.product_name.trim();
      setVariantsList((current) => ({
        ...current,
        [productName]: mergeOptionValues(current[productName] || [], [name]),
      }));
    }

    await reloadCatalogLists();
    return name;
  };

  useEffect(() => {
    reloadCatalogLists();
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebarOpen", JSON.stringify(isSidebarOpen));
  }, [isSidebarOpen]);

  const INITIAL_NEW_PRODUCT = {
    name: "",
    product_type: "",
    product_name: "",
    pricing_method: "",
    category: DEFAULT_CATEGORY,
    variant: "",
    base_price: "",
    price_per_sqft: "",
    price_per_blade: "",
    customization: false,
    customization_fee: 700,
    standard_size: "",
    width: "",
    height: "",
    unit: "in",
    blade_count: "",
    estimated_area: 0,
    estimated_price: 0,
    estimated_price_override: "",
    images: {},
    description: "",
    is_active: true,
  };

  const [newProduct, setNewProduct] = useState(INITIAL_NEW_PRODUCT);

  const [editingProduct, setEditingProduct] =
    useState(null);

  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [modalError, setModalError] =
    useState("");

  const [uploadProgress, setUploadProgress] = useState({});
  const [uploading, setUploading] = useState(false);
  const [uploadCanceled, setUploadCanceled] = useState(false);
  const uploadRequestRef = useRef(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    const width = parseFloat(newProduct.width) || 0;
    const height = parseFloat(newProduct.height) || 0;
    const sqftPrice = parseFloat(newProduct.price_per_sqft) || 0;
    const bladeCount = parseInt(newProduct.blade_count, 10) || 0;
    const bladePrice = parseFloat(newProduct.price_per_blade) || 0;
    const basePrice = parseFloat(newProduct.base_price) || 0;

    const result = calculateEstimate({
      productName: newProduct.product_name || newProduct.name,
      categoryKey: newProduct.product_type || newProduct.category,
      variantName: newProduct.variant,
      width,
      height,
      quantity: 1,
      measurementUnit: newProduct.unit,
      blade_count: bladeCount,
      base_price: basePrice,
      overrideRate: sqftPrice > 0
        ? sqftPrice
        : (newProduct.pricing_method === 'blade' ? bladePrice : undefined),
    });

    setNewProduct((prev) => {
      if (prev.estimated_area === result.estimated_area && prev.estimated_price === result.estimated_price) {
        return prev;
      }
      return {
        ...prev,
        estimated_area: result.estimated_area,
        estimated_price: result.estimated_price,
      };
    });
  }, [
    newProduct.pricing_method,
    newProduct.width,
    newProduct.height,
    newProduct.price_per_sqft,
    newProduct.blade_count,
    newProduct.price_per_blade,
    newProduct.unit,
    newProduct.base_price,
    newProduct.product_name,
    newProduct.product_type,
    newProduct.variant,
  ]);

  const uploaderSections = [
    ["main", "Main Photo"],
    ["left", "Left Angle"],
    ["right", "Right Angle"],
    ["top", "Top Angle"],
    ["bottom", "Back Angle"],
  ];

  const rowsPerPage = 5;

  const filteredProducts = products.filter((product) => {
    const normalizedSearch = search.toLowerCase();
    const matchSearch =
      String(product.name || product.product_name || "").toLowerCase().includes(normalizedSearch) ||
      String(product.description || "").toLowerCase().includes(normalizedSearch) ||
      String(product.category || "").toLowerCase().includes(normalizedSearch) ||
      String(product.variant || "").toLowerCase().includes(normalizedSearch);

    const matchCategory =
      categoryFilter === "All"
        ? true
        : String(product.category || "").toLowerCase() === categoryFilter.toLowerCase();

    const productType =
      product.type ||
      (String(product.category || "").toLowerCase() === "glass"
        ? "Glass"
        : String(product.category || "").toLowerCase() === "aluminum"
        ? "Aluminum"
        : "Mixed System");

    const matchType =
      typeFilter === "All"
        ? true
        : productType.toLowerCase() === typeFilter.toLowerCase();

    const matchStatus =
      statusFilter === "All"
        ? true
        : statusFilter === "Active"
        ? product.is_active === true
        : product.is_active === false;

    return matchSearch && matchCategory && matchType && matchStatus;
  });

  const lastIndex =
    currentPage * rowsPerPage;

  const firstIndex =
    lastIndex - rowsPerPage;

  const currentProducts =
    filteredProducts.slice(
      firstIndex,
      lastIndex
    );

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / rowsPerPage));
  const firstShown = filteredProducts.length === 0 ? 0 : firstIndex + 1;
  const lastShown = Math.min(lastIndex, filteredProducts.length);

  const toggleProductStatus = async (product) => {
    try {
      const updated = await updateProductApi(product.id, {
        is_active: !product.is_active,
      });
      const payload = updated.product || updated;
      recordActivity(
        user,
        `${payload.is_active ? "Activated" : "Deactivated"} product ${product.id}.`,
        "Products",
      );
      setProducts((current) =>
        current.map((item) =>
          item.id === product.id || item._id === product.id
            ? normalizeProductForState({ ...item, ...payload }, item)
            : item
        )
      );
    } catch (error) {
      console.error("Failed to update product status", error);
    }
  };

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const data = await getProducts();
        const loadedProducts = (data.products || []).map((product) => normalizeProductForState(product));
        setProducts(loadedProducts);
      } catch (error) {
        console.error("Failed to load products", error);
      }
    };

    loadProducts();
  }, []);

    const openModal = (product = null) => {
      setModalError("");
      if (!isAdmin) {
        setModalError("Only administrators can manage products.");
        return;
      }
      if (product) {
        const safeProduct = normalizeProductForState(product);
        setEditingProduct(product);
        setNewProduct({
          name: safeProduct.name || "",
          product_type: safeProduct.product_type || safeProduct.type || "",
          product_name: safeProduct.product_name || safeProduct.name || "",
          pricing_method: product.pricing_method || PRICING_METHOD[safeProduct.product_name || safeProduct.name] || "",
          category: safeProduct.category || DEFAULT_CATEGORY,
          variant: safeProduct.variant || "",
          base_price: product.base_price || product.unit_price || "",
          price_per_sqft: product.price_per_sqft || "",
          price_per_blade: product.price_per_blade || "",
          customization: product.customization || false,
          customization_fee: product.customization_fee || 700,
          standard_size: product.standard_size || "",
          width: product.width || "",
          height: product.height || "",
          unit: product.measurement_unit || "in",
          blade_count: product.blade_count || "",
          estimated_area: product.estimated_area || 0,
          estimated_price: product.estimated_price || 0,
          estimated_price_override: product.estimated_price_override || "",
          images: product.images || {},
          imageFiles: {},
          description: product.description || "",
          is_active: product.is_active !== undefined ? product.is_active : true,
        });
      } else {
        setEditingProduct(null);
        setNewProduct({ ...INITIAL_NEW_PRODUCT, imageFiles: {} });
      }
      setShowModal(true);
    };

  const closeModal = () => {
    setShowModal(false);
    setEditingProduct(null);
    setModalError("");
  };

  const handleCreateNewProduct = () => {
    // Reuse openModal logic for consistent admin check and modal behavior
    openModal(null);
  };

  // Upload image files using multipart/form-data and real XHR progress tracking
  const uploadImages = async () => {
    if (!newProduct.imageFiles) return { success: true, files: [] };

    const fileKeys = Object.keys(newProduct.imageFiles).filter((key) => newProduct.imageFiles[key]);
    if (fileKeys.length === 0) return { success: true, files: [] };

    setUploadCanceled(false);
    setUploading(true);
    const progressInitial = fileKeys.reduce((acc, key) => ({ ...acc, [key]: 0 }), {});
    setUploadProgress(progressInitial);

    const formData = new FormData();
    fileKeys.forEach((key) => {
      const file = newProduct.imageFiles[key];
      formData.append(key, file, file.name);
    });

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      uploadRequestRef.current = xhr;

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
        setUploadProgress((prev) => {
          const next = { ...prev };
          fileKeys.forEach((key) => (next[key] = percent));
          return next;
        });
      };

      xhr.onload = () => {
        setUploading(false);
        uploadRequestRef.current = null;
        try {
          const json = JSON.parse(xhr.responseText || "{}");
          if (xhr.status >= 200 && xhr.status < 300 && json.success) {
            setUploadProgress((prev) => {
              const next = { ...prev };
              fileKeys.forEach((key) => (next[key] = 100));
              return next;
            });
            setTimeout(() => setUploadProgress({}), 700);
            resolve(json);
          } else {
            reject(json);
          }
        } catch (err) {
          reject(err);
        }
      };

      xhr.onerror = () => {
        setUploading(false);
        uploadRequestRef.current = null;
        reject(new Error("Upload failed"));
      };

      xhr.onabort = () => {
        setUploading(false);
        uploadRequestRef.current = null;
        setUploadCanceled(true);
        resolve({ aborted: true });
      };

      xhr.open("POST", "/api/uploads", true);
      xhr.send(formData);
    });
  };

  const cancelUpload = () => {
    if (uploadRequestRef.current) {
      uploadRequestRef.current.abort();
    }
  };

  const saveProduct = async () => {
    if (!isAdmin) {
      setModalError("Only administrators can save products.");
      return;
    }

    const productName = newProduct.product_name.trim() || "Unnamed Product";
    const variant = newProduct.variant.trim();
    const pricingMethod = newProduct.pricing_method || (
      Number(newProduct.price_per_sqft) > 0
        ? "sqft"
        : Number(newProduct.price_per_blade) > 0
        ? "blade"
        : Number(newProduct.base_price) > 0
        ? "fixed"
        : ""
    );

    if (pricingMethod === "sqft") {
      const w = parseFloat(newProduct.width);
      const h = parseFloat(newProduct.height);
      if (!w || !h || w <= 0 || h <= 0) {
        setModalError("Width and height must be greater than 0.");
        return;
      }
      if (!newProduct.price_per_sqft) {
        setModalError("Price per sq ft is required.");
        return;
      }
    }

    if (pricingMethod === "blade") {
      const b = parseInt(newProduct.blade_count || 0, 10);
      if (!b || b <= 0) {
        setModalError("Blade count must be greater than 0.");
        return;
      }
      if (!newProduct.price_per_blade) {
        setModalError("Price per blade is required.");
        return;
      }
    }

    if (pricingMethod === "fixed") {
      if (!newProduct.base_price) {
        setModalError("Base price is required for fixed price products.");
        return;
      }
    }

    try {
      // If there are local files, upload them and replace previews with server URLs
      let finalImages = newProduct.images;
      if (newProduct.imageFiles && Object.keys(newProduct.imageFiles).length > 0) {
        const uploaded = await uploadImages();
        if (uploaded && uploaded.aborted) {
          setModalError("Upload canceled.");
          return;
        }
        if (uploaded && uploaded.files) {
          const mapping = {};
          uploaded.files.forEach((f) => { mapping[f.key] = f.url; });
          finalImages = { ...newProduct.images, ...mapping };
          setNewProduct((prev) => ({ ...prev, images: finalImages, imageFiles: {} }));
        }
      }
      const payload = {
        // Backend compatibility fields
        name: productName,
        sku: "",
        unit_price: Number(newProduct.estimated_price_override) || Number(newProduct.estimated_price) || Number(newProduct.base_price) || Number(newProduct.price_per_sqft) || 0,
        unit: pricingMethod === "sqft" ? "per_sqft" : "per_piece",
        measurement_unit: newProduct.unit || "in",
        image_url: finalImages?.main || "",
        product_type: newProduct.product_type,
        product_name: newProduct.product_name || productName,
        pricing_method: pricingMethod,
        category: newProduct.category || DEFAULT_CATEGORY,
        variant,
        base_price: Number(newProduct.base_price) || undefined,
        price_per_sqft: Number(newProduct.price_per_sqft) || undefined,
        price_per_blade: Number(newProduct.price_per_blade) || undefined,
        standard_size: newProduct.standard_size || "",
        width: newProduct.width ? Number(newProduct.width) : undefined,
        height: newProduct.height ? Number(newProduct.height) : undefined,
        blade_count: newProduct.blade_count ? Number(newProduct.blade_count) : undefined,
        estimated_area: Number(newProduct.estimated_area) || undefined,
        estimated_price: Number(newProduct.estimated_price_override) || Number(newProduct.estimated_price) || undefined,
        images: finalImages,
        description: newProduct.description,
        is_active: newProduct.is_active,
      };

      if (editingProduct) {
        const updated = await updateProductApi(editingProduct.id, payload);
        const product = updated.product || updated;
        setProducts((current) =>
          current.map((item) =>
            item.id === editingProduct.id || item._id === editingProduct.id
              ? normalizeProductForState({ ...item, ...product }, item)
              : item
          )
        );
        recordActivity(user, `Updated product ${productName}.`, "Products");
      } else {
        const created = await createProductApi(payload);
        const product = created.product || created;
        const refreshedProducts = await getProducts({ adminOnly: true });
        setProducts((refreshedProducts.products || []).map((item) => normalizeProductForState(item)));
        recordActivity(user, `Created product ${productName}.`, "Products");
      }

      closeModal();
    } catch (error) {
      console.error("Save product failed", error);
      setModalError(
        error.data?.message || error.message || "Unable to save product."
      );
    }
  };

  const deleteProduct = async (id) => {
    try {
      await deleteProductApi(id);
      const deletedProduct = products.find((product) => product.id === id || product._id === id);
      recordActivity(user, `Deleted product ${deletedProduct?.product_name || id}.`, "Products");
      setProducts((current) =>
        current.filter((product) => product._id !== id && product.id !== id)
      );
    } catch (error) {
      console.error("Delete product failed", error);
    }
  };

  const openDeleteConfirm = (product) => {
    setProductToDelete(product);
    setDeleteConfirmOpen(true);
  };

  const closeDeleteConfirm = () => {
    setProductToDelete(null);
    setDeleteConfirmOpen(false);
    setDeleteLoading(false);
  };

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return;
    setDeleteLoading(true);
    try {
      await deleteProduct(productToDelete._id || productToDelete.id);
      closeDeleteConfirm();
    } catch (error) {
      console.error("Delete product failed", error);
      setDeleteLoading(false);
    }
  };

  const getProductType = (product) => {
    const category = product.category || DEFAULT_CATEGORY;
    return product.type ||
      (String(category).toLowerCase() === "glass"
        ? "Glass"
        : String(category).toLowerCase() === "aluminum"
        ? "Aluminum"
        : "Mixed System");
  };

  const productTypeOptions = withSelectedOption(productTypesList, newProduct.product_type);
  const categoryOptions = withSelectedOption(categoryOptionsList, newProduct.category);
  const variantProductName = Object.keys(variantsList).find(
    (productName) => productName.trim().toLowerCase() === newProduct.product_name.trim().toLowerCase(),
  ) || newProduct.product_name;
  const variantOptions = withSelectedOption(
    variantsList[variantProductName] || VARIANTS[variantProductName] || [],
    newProduct.variant
  );
  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      <Sidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen((open) => !open)} />

      <div className="flex-1 min-h-0 flex flex-col">

        <Navbar />

        <main className="flex-1 min-h-0 overflow-y-auto p-6">

          <AdminPageHeader
            title="Products"
            description="Manage product listings, pricing, and availability from one unified dashboard."
            stats={[
              { label: "Products", value: products.length, color: "text-blue-200" },
              { label: "Active", value: products.filter((product) => product.is_active).length, color: "text-emerald-300" },
              { label: "Inactive", value: products.filter((product) => !product.is_active).length, color: "text-red-300" },
            ]}
          />

          {/* FILTERS */}
          <div className="bg-white rounded-3xl shadow mt-6 p-6">

              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative flex-1">
                  <Search
                    size={18}
                    className="absolute left-4 top-4 text-gray-400"
                  />
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={search}
                    onChange={(e) =>
                      setSearch(e.target.value)
                    }
                    className="w-full pl-12 pr-4 py-3 border rounded-xl"
                  />
                </div>

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => openModal()}
                      disabled={!isAdmin}
                      className={`inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-sm transition ${isAdmin ? "bg-red-600 hover:bg-red-700" : "bg-gray-300 cursor-not-allowed"}`}
                    >
                      <Plus size={18} className="mr-2" />
                      Add Product
                    </button>

                  </div>
                </div>
              </div>
              {!isAdmin && (
                <p className="mt-3 text-sm text-yellow-700">
                  Product creation and editing are available only to admin users.
                </p>
              )}

              <div className="grid gap-4 mt-4 lg:grid-cols-3">
                <select
                  value={typeFilter}
                  onChange={(e) =>
                    setTypeFilter(e.target.value)
                  }
                  className="px-4 py-3 border rounded-xl"
                >
                  <option value="All">All types</option>
                  <option value="Default Type">Default Type</option>
                  <option value="Glass">Glass</option>
                  <option value="Aluminum">Aluminum</option>
                </select>

                <select
                  value={categoryFilter}
                  onChange={(e) =>
                    setCategoryFilter(e.target.value)
                  }
                  className="px-4 py-3 border rounded-xl"
                >
                  <option value="All">All categories</option>
                  {categoryOptionsList.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value)
                  }
                  className="px-4 py-3 border rounded-xl"
                >
                  <option value="All">All statuses</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

            </div>

          {/* PRODUCTS */}

              <div className="mt-6">
                {currentProducts.length === 0 ? (
                  <div className="bg-white rounded-3xl p-10 shadow text-center">
                    <p className="text-gray-500">No products match the selected filters.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-3xl border border-gray-200 bg-white shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider text-gray-900">No.</th>
                          <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider text-gray-900">Product</th>
                          <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider text-gray-900">Category</th>
                          <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider text-gray-900">Variant</th>
                          <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider text-gray-900">Price</th>
                          <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider text-gray-900">Status</th>
                          <th className="px-4 py-4 text-right text-sm font-bold uppercase tracking-wider text-gray-900">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {currentProducts.map((product, index) => {
                          const imageSrc = resolveProductImage(product);
                          const productName = product.product_name || product.name;
                          const productType = product.product_type || "Default Type";
                          const rowNumber = firstIndex + index + 1;
                          return (
                            <tr key={product._id || product.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{rowNumber}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-3">
                                  <div className="h-14 w-14 overflow-hidden rounded-2xl bg-gray-100">
                                    <img
                                      src={imageSrc}
                                      alt={productName}
                                      className="h-full w-full object-cover"
                                      onError={(e) => {
                                        e.currentTarget.onerror = null;
                                        e.currentTarget.src = PRODUCT_IMAGE_PLACEHOLDER;
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <div className="text-sm font-semibold text-gray-900">{productName}</div>
                                    <div className="text-xs text-gray-500">{productType}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{product.category || "—"}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{product.variant || "—"}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-m text-green-500">{getProductPriceLabel(product)}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${product.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-700"}`}>
                                  {product.is_active ? "Active" : "Inactive"}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    className="p-2 rounded-lg text-orange-500 hover:bg-orange-50 transition"
                                    onClick={() => openModal(product)}
                                    title="Edit product"
                                    aria-label="Edit product"
                                  >
                                    <Pencil size={20} />
                                  </button>
                                  <button
                                    className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition"
                                    onClick={() => openDeleteConfirm(product)}
                                    title="Delete product"
                                    aria-label="Delete product"
                                  >
                                    <Trash2 size={20} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* PAGINATION */}
              <div className="mt-6 flex flex-col gap-4 items-center sm:flex-row sm:justify-center sm:items-center">
                <span className="text-gray-500 text-center">
                  Showing {firstShown}-{lastShown} of {filteredProducts.length} products
                </span>
                <div className="flex flex-wrap gap-2 justify-center">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                    className="px-4 py-2 border rounded-lg"
                  >
                    Previous
                  </button>
                  {[...Array(totalPages)].map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentPage(index + 1)}
                      className={`w-10 h-10 rounded-lg ${
                        currentPage === index + 1
                          ? "bg-red-600 text-white"
                          : "bg-white border"
                      }`}
                    >
                      {index + 1}
                    </button>
                  ))}
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                    className="px-4 py-2 border rounded-lg"
                  >
                    Next
                  </button>
                </div>
              </div>
        </main>
      </div>

      {showModal && (
        <ProductFormModal
          editingProduct={editingProduct}
          newProduct={newProduct}
          setNewProduct={setNewProduct}
          productTypeOptions={productTypeOptions}
          categoryOptions={categoryOptions}
          variantOptions={variantOptions}
          pricingMethodByName={PRICING_METHOD}
          uploaderSections={uploaderSections}
          uploadProgress={uploadProgress}
          uploading={uploading}
          modalError={modalError}
          saveProduct={saveProduct}
          closeModal={closeModal}
          cancelUpload={cancelUpload}
          saveCatalogOption={saveCatalogOption}
        />
      )}

      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-semibold mb-3">Confirm Delete</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete <strong>{productToDelete?.product_name || productToDelete?.name}</strong>?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closeDeleteConfirm}
                className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteProduct}
                disabled={deleteLoading}
                className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {deleteLoading ? "Deleting..." : "Delete product"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Products;

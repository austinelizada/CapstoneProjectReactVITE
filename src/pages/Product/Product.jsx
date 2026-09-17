import { useEffect, useRef, useState } from "react";
import {
  Package,
  Plus,
  Search,
  Loader2,
  Pencil,
  Trash2,
  X,
  Settings,
  Star,
} from "lucide-react";
import * as catalogApi from '@/api/catalog';
import ProductManagementModal from '@/components/ProductManagementModal';
import { API_BASE } from "@/api/client";
import { getProductReviews } from "@/api/orders";

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
  const [showProductManagementModal, setShowProductManagementModal] = useState(false);
  const [activeProductPageTab, setActiveProductPageTab] = useState("products");
  const [selectedReviewProductId, setSelectedReviewProductId] = useState("");
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewError, setReviewError] = useState("");

  const selectedReviewProduct = products.find(
    (product) => String(product._id || product.id) === selectedReviewProductId
  ) || null;

  const openReviewTab = () => {
    setActiveProductPageTab("reviews");
    if (!selectedReviewProductId && products.length > 0) {
      setSelectedReviewProductId(products[0]._id || products[0].id);
    }
  };

  useEffect(() => {
    if (activeProductPageTab !== "reviews") return;
    if (!selectedReviewProductId) {
      setReviews([]);
      setReviewError("");
      return;
    }

    let active = true;

    const loadReviews = async () => {
      setReviewsLoading(true);
      setReviewError("");
      try {
        const response = await getProductReviews(selectedReviewProductId);
        if (!active) return;
        setReviews(response.reviews || []);
      } catch (err) {
        if (!active) return;
        setReviewError(err.data?.message || err.message || "Unable to load reviews.");
        setReviews([]);
      } finally {
        if (active) setReviewsLoading(false);
      }
    };

    loadReviews();

    return () => {
      active = false;
    };
  }, [activeProductPageTab, selectedReviewProductId]);

  useEffect(() => {
    if (activeProductPageTab !== "reviews" || selectedReviewProductId || products.length === 0) return;
    setSelectedReviewProductId(products[0]._id || products[0].id);
  }, [activeProductPageTab, selectedReviewProductId, products]);

  const reloadCatalogLists = async () => {
    try {
      const types = await catalogApi.getTypes();
      const normalizedTypes = normalizeOptionValues(types);
      setProductTypesList(mergeOptionValues(PRODUCT_TYPES, normalizedTypes));
      const names = await catalogApi.getNames();
      const normalizedNames = normalizeGroupedOptionValues(names, "product_type");
      setProductNamesList(mergeGroupedOptionValues(PRODUCT_NAMES, normalizedNames));
      const categories = await catalogApi.getCategories();
      const normalizedCategories = normalizeOptionValues(categories);
      setCategoryOptionsList(mergeOptionValues(CATEGORY_OPTIONS, normalizedCategories));
      const vars = await catalogApi.getVariants();
      const normalizedVariants = normalizeGroupedOptionValues(vars, "product_name");
      setVariantsList(mergeGroupedOptionValues(VARIANTS, normalizedVariants));
    } catch (e) {
      console.error("Failed to load catalog lists", e);
    }
  };

  const handleCatalogRefresh = (detail = {}) => {
    reloadCatalogLists();

    if (!showModal) return;

    setNewProduct((prev) => {
      const next = { ...prev };
      const kind = detail?.tab || detail?.kind;
      const item = detail?.item || {};

      if (kind === "categories" && item.name) {
        next.category = prev.category || item.name;
      }

      if (kind === "types" && item.name && !prev.product_type) {
        next.product_type = item.name;
      }

      if (kind === "names" && item.name) {
        next.product_type = prev.product_type || item.product_type || "";
        next.product_name = prev.product_name || item.name;
      }

      if (kind === "variants" && item.name) {
        next.product_name = prev.product_name || item.product_name || "";
        next.variant = prev.variant || item.name;
      }

      return next;
    });
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
      blade_count: bladeCount,
      base_price: basePrice,
      overrideRate: newProduct.pricing_method === 'sqft' ? sqftPrice : (newProduct.pricing_method === 'blade' ? bladePrice : undefined),
      customization: newProduct.customization,
      customization_fee: newProduct.customization_fee,
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
    newProduct.base_price,
    newProduct.customization,
    newProduct.customization_fee,
    newProduct.product_name,
    newProduct.product_type,
    newProduct.variant,
  ]);

  const uploaderSections = [
    ["main", "Main Photo"],
    ["left", "Left Angle"],
    ["right", "Right Angle"],
    ["top", "Top Angle"],
    ["bottom", "Bottom Angle"],
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
          unit: product.unit || "in",
          blade_count: product.blade_count || "",
          estimated_area: product.estimated_area || 0,
          estimated_price: product.estimated_price || 0,
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

    // Validation
    if (!newProduct.product_type) {
      setModalError("Product type is required.");
      return;
    }

    if (!newProduct.product_name) {
      setModalError("Product name is required.");
      return;
    }

    if (!newProduct.pricing_method) {
      setModalError("Pricing method is required.");
      return;
    }

    if (newProduct.pricing_method === "sqft") {
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

    if (newProduct.pricing_method === "blade") {
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

    if (newProduct.pricing_method === "fixed") {
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
        name: newProduct.product_name,
        sku: "",
        unit_price: Number(newProduct.estimated_price) || Number(newProduct.base_price) || Number(newProduct.price_per_sqft) || 0,
        unit: newProduct.pricing_method === "sqft" ? "per_sqft" : "per_piece",
        image_url: newProduct.images?.main || "",
        product_type: newProduct.product_type,
        product_name: newProduct.product_name,
        pricing_method: newProduct.pricing_method,
        category: newProduct.category,
        variant: newProduct.variant,
        base_price: Number(newProduct.base_price) || undefined,
        price_per_sqft: Number(newProduct.price_per_sqft) || undefined,
        price_per_blade: Number(newProduct.price_per_blade) || undefined,
        customization_fee: newProduct.customization ? Number(newProduct.customization_fee) : 0,
        standard_size: newProduct.standard_size || "",
        width: newProduct.width ? Number(newProduct.width) : undefined,
        height: newProduct.height ? Number(newProduct.height) : undefined,
        blade_count: newProduct.blade_count ? Number(newProduct.blade_count) : undefined,
        estimated_area: Number(newProduct.estimated_area) || undefined,
        estimated_price: Number(newProduct.estimated_price) || undefined,
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
        recordActivity(user, `Updated product ${newProduct.product_name}.`, "Products");
      } else {
        const created = await createProductApi(payload);
        const product = created.product || created;
        setProducts((current) => [
          ...current,
          normalizeProductForState(product),
        ]);
        recordActivity(user, `Created product ${newProduct.product_name}.`, "Products");
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
  const productNameOptions = withSelectedOption(
    productNamesList[newProduct.product_type] || PRODUCT_NAMES[newProduct.product_type] || [],
    newProduct.product_name
  );
  const categoryOptions = withSelectedOption(categoryOptionsList, newProduct.category);
  const variantOptions = withSelectedOption(
    variantsList[newProduct.product_name] || VARIANTS[newProduct.product_name] || [],
    newProduct.variant
  );
  const effectivePricingMethod = newProduct.pricing_method || PRICING_METHOD[newProduct.product_name] || "";



  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      <Sidebar isOpen={isSidebarOpen} />

      <div className="flex-1 min-h-0 flex flex-col">

        <Navbar
          toggleSidebar={() =>
            setIsSidebarOpen(
              !isSidebarOpen
            )
          }
        />

        <main className="flex-1 min-h-0 overflow-y-auto p-6">

          <AdminPageHeader
            title="Products"
            description="Manage product listings, pricing, and availability from one unified dashboard."
          />

          {/* FILTERS */}
          {activeProductPageTab === "products" && (
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

                    <button
                      onClick={() => setShowProductManagementModal(true)}
                      disabled={!isAdmin}
                      className={`inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition ${isAdmin ? "bg-white text-red-600 border border-red-600 hover:bg-red-50" : "bg-gray-300 cursor-not-allowed"}`}
                    >
                      <Settings size={18} className="mr-2" />
                      Product Management
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={openReviewTab}
                      disabled={!isAdmin}
                      className={`inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition ${isAdmin ? "bg-white text-red-600 border border-red-600 hover:bg-red-50" : "bg-gray-300 cursor-not-allowed"}`}
                    >
                      <Star size={18} className="mr-2" />
                      Reviews
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
          )}

          {/* PRODUCTS */}

          {activeProductPageTab === "products" ? (
            <>
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
            </>
          ) : (
            <div className="mt-6 bg-white rounded-3xl p-6 shadow-sm">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">Product Reviews</h2>
                  <p className="mt-2 text-sm text-slate-500">View customer reviews for purchases tied to your product catalog.</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveProductPageTab("products")}
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Back to Products
                  </button>
                  {reviewsLoading && (
                    <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-700">
                      <Loader2 size={18} className="animate-spin" /> Loading reviews
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-[320px_1fr]">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                  <label className="block text-sm font-semibold text-slate-700">Choose product</label>
                  <select
                    value={selectedReviewProductId}
                    onChange={(e) => setSelectedReviewProductId(e.target.value)}
                    className="mt-3 w-full rounded-3xl border border-slate-200 bg-white py-3 px-4 text-sm text-slate-900 shadow-sm"
                  >
                    <option value="">Select a product</option>
                    {products.map((product) => (
                      <option key={product._id || product.id} value={product._id || product.id}>
                        {product.product_name || product.name || "Unnamed product"}
                      </option>
                    ))}
                  </select>

                  <div className="mt-6 grid gap-4">
                    <div className="rounded-3xl border border-slate-200 bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Total Reviews</p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">{selectedReviewProduct ? reviews.length : "—"}</p>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Average Rating</p>
                      <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-slate-900">
                        {selectedReviewProduct ? (reviews.length ? (reviews.reduce((sum, review) => sum + (review.rating || 0), 0) / reviews.length).toFixed(1) : "0.0") : "—"}
                        <span className="text-amber-500"><Star size={16} /></span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {reviewError && (
                    <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      {reviewError}
                    </div>
                  )}

                  {!selectedReviewProduct && (
                    <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
                      Select a product to view its reviews.
                    </div>
                  )}

                  {selectedReviewProduct && !reviewsLoading && reviews.length === 0 && (
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
                      No reviews found for this product.
                    </div>
                  )}

                  {selectedReviewProduct && reviews.length > 0 && (
                    <div className="space-y-4">
                      {reviews.map((review) => (
                        <div key={`${review.orderId}-${review.submittedAt || review._id || Math.random()}`} className="rounded-3xl border border-slate-200 p-6">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm text-slate-500">Customer</p>
                              <p className="mt-1 font-semibold text-slate-900">{review.customerName || review.customer || "Anonymous"}</p>
                            </div>
                            <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-700">
                              <span>{Array.from({ length: review.rating || 0 }).map((_, index) => (<Star key={index} size={14} />))}</span>
                              <span>{(review.rating || 0).toFixed(1)}</span>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <div>
                              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Title</p>
                              <p className="mt-2 font-semibold text-slate-900">{review.title || "No title provided"}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Submitted</p>
                              <p className="mt-2 font-semibold text-slate-900">{review.submittedAt ? new Date(review.submittedAt).toLocaleDateString() : review.createdAt ? new Date(review.createdAt).toLocaleDateString() : "—"}</p>
                            </div>
                          </div>

                          <div className="mt-4">
                            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Comment</p>
                            <p className="mt-2 text-sm leading-6 text-slate-700">{review.comment || review.feedback || "No comment provided."}</p>
                          </div>

                          {review.photos?.length > 0 && (
                            <div className="mt-4 grid grid-cols-2 gap-3">
                              {review.photos.map((photo, index) => (
                                <img
                                  key={index}
                                  src={photo}
                                  alt={`Review photo ${index + 1}`}
                                  className="h-28 w-full rounded-3xl object-cover"
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ADD PRODUCT MODAL */}

      {showModal && (

        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">

          <div className="bg-white rounded-3xl w-full max-w-6xl p-8 relative max-h-[90vh] overflow-y-auto">

            <button
              onClick={closeModal}
              className="absolute top-4 right-4"
            >
              <X />
            </button>

            <h2 className="text-2xl font-bold mb-6">
              {editingProduct ? "Edit Product" : "Add Product"}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Upload column */}
              <div className="md:col-span-1">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Product photos</p>
                    <p className="text-sm text-gray-500">Side-scroll uploader</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mb-4 text-xs text-slate-500">
                  <span>Drag or scroll sideways to choose image slots</span>
                  <span>{uploaderSections.length} images total</span>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory">
                  {uploaderSections.map(([key, label]) => (
                      <div key={key} className="min-w-[18rem] snap-start bg-gray-50 rounded-2xl p-3 flex flex-col items-center">
                        <div
                          className="w-full h-36 bg-white rounded-lg overflow-hidden flex items-center justify-center mb-2 relative"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const file = e.dataTransfer.files && e.dataTransfer.files[0];
                            if (file) {
                              const url = URL.createObjectURL(file);
                              setNewProduct((p) => ({ ...p, images: { ...p.images, [key]: url }, imageFiles: { ...p.imageFiles, [key]: file } }));
                            }
                          }}
                        >
                      {newProduct.images?.[key] ? (
                        <img src={newProduct.images[key]} alt={`${label} preview`} className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-sm text-gray-400 text-center">{label} <br/> <span className="text-xs">(drag & drop or choose file)</span></div>
                      )}
                      {uploading && uploadProgress[key] !== undefined && (
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <div className="text-white text-xs text-center">
                            <Loader2 className="animate-spin mx-auto mb-2" size={18} />
                            Uploading {uploadProgress[key]}%
                          </div>
                        </div>
                      )}
                    </div>
                    <label className="mt-2 inline-flex items-center gap-3 cursor-pointer px-3 py-2 bg-white border rounded text-sm">
                      <span className="text-gray-600">Choose file</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files && e.target.files[0];
                          if (file) {
                            const url = URL.createObjectURL(file);
                            setNewProduct((p) => ({ ...p, images: { ...p.images, [key]: url }, imageFiles: { ...p.imageFiles, [key]: file } }));
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                    <div className="mt-1 text-xs text-gray-500">{newProduct.imageFiles?.[key]?.name || (newProduct.images?.[key] ? newProduct.images[key].split('/').pop() : 'No file chosen')}</div>
                    {uploadProgress[key] !== undefined && (
                      <div className="mt-2">
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 transition-all duration-200" style={{ width: `${uploadProgress[key]}%` }} />
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1">{uploadProgress[key]}%</div>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2 mt-2">
                      {newProduct.images?.[key] && (
                        <button
                          onClick={() => setNewProduct((p) => ({ ...p, images: { ...p.images, [key]: undefined }, imageFiles: { ...p.imageFiles, [key]: undefined } }))}
                          className="text-xs text-red-600"
                        >
                          Remove
                        </button>
                      )}
                      {uploading && uploadProgress[key] !== undefined && (
                        <span className="text-[10px] text-slate-500">Saving…</span>
                      )}
                    </div>
                  </div>
                ))}
                </div>
                {uploading && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                    <div className="flex items-center justify-between gap-3">
                      <span>Uploading images…</span>
                      <button
                        type="button"
                        onClick={cancelUpload}
                        className="rounded-xl bg-white border px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                      >
                        Cancel upload
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-emerald-700/80">Your current image upload will stop immediately.</p>
                  </div>
                )}
              </div>

              {/* Fields column */}
              <div className="md:col-span-2 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">Product Type *</label>
                    <select
                      value={newProduct.product_type}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewProduct((p) => ({
                          ...p,
                          product_type: val,
                          product_name: "",
                          pricing_method: "",
                          variant: "",
                        }));
                      }}
                      className="w-full px-4 py-3 border rounded-xl"
                    >
                      <option value="">Select Product Type</option>
                        {productTypeOptions.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500">Product Name *</label>
                    <select
                      value={newProduct.product_name}
                      disabled={!newProduct.product_type}
                      onChange={(e) => {
                        const value = e.target.value;
                        setNewProduct((p) => ({
                          ...p,
                          product_name: value,
                          pricing_method: PRICING_METHOD[value] || "",
                          variant: "",
                        }));
                      }}
                      className="w-full px-4 py-3 border rounded-xl"
                    >
                      <option value="">Select Product Name</option>
                      {productNameOptions.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500">Pricing Method *</label>
                    <select
                      value={effectivePricingMethod}
                      disabled={!newProduct.product_name}
                      onChange={(e) => setNewProduct((p) => ({
                        ...p,
                        pricing_method: e.target.value,
                        width: "",
                        height: "",
                        blade_count: "",
                        base_price: "",
                        price_per_sqft: "",
                        price_per_blade: "",
                      }))}
                      className="w-full px-4 py-3 border rounded-xl"
                    >
                      <option value="">Select Pricing Method</option>
                      <option value="sqft">Per square foot</option>
                      <option value="fixed">Fixed price</option>
                      <option value="blade">Per blade</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">Category</label>
                    <select
                      value={newProduct.category}
                      onChange={(e) => setNewProduct((p) => ({ ...p, category: e.target.value }))}
                      className="w-full px-4 py-3 border rounded-xl"
                    >
                      {categoryOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500">Variant</label>
                    <select
                      value={newProduct.variant}
                      disabled={!newProduct.product_name}
                      onChange={(e) => setNewProduct((p) => ({ ...p, variant: e.target.value }))}
                      className="w-full px-4 py-3 border rounded-xl"
                    >
                      <option value="">Select Variant</option>
                      {variantOptions.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500">Status</label>
                    <select value={newProduct.is_active ? "Active" : "Inactive"} onChange={(e)=>setNewProduct(p=>({...p,is_active: e.target.value==="Active"}))} className="w-full px-4 py-3 border rounded-xl">
                      <option>Active</option>
                      <option>Inactive</option>
                    </select>
                  </div>
                </div>

                {/* Dynamic pricing fields */}
                {newProduct.pricing_method === "sqft" || PRICING_METHOD[newProduct.product_name] === "sqft" ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs text-gray-500">Width ({newProduct.unit})</label>
                      <input type="number" value={newProduct.width} min="0" onChange={(e)=>setNewProduct(p=>({...p,width:e.target.value}))} className="w-full px-4 py-3 border rounded-xl" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Height ({newProduct.unit})</label>
                      <input type="number" value={newProduct.height} min="0" onChange={(e)=>setNewProduct(p=>({...p,height:e.target.value}))} className="w-full px-4 py-3 border rounded-xl" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Price Per Sq Ft (₱)</label>
                      <input type="number" value={newProduct.price_per_sqft} min="0" onChange={(e)=>setNewProduct(p=>({...p,price_per_sqft:e.target.value}))} className="w-full px-4 py-3 border rounded-xl" />
                    </div>
                  </div>
                ) : null}

                {newProduct.pricing_method === "blade" || PRICING_METHOD[newProduct.product_name] === "blade" ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs text-gray-500">Blade Count</label>
                      <input type="number" value={newProduct.blade_count} min="0" onChange={(e)=>setNewProduct(p=>({...p,blade_count:e.target.value}))} className="w-full px-4 py-3 border rounded-xl" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Price Per Blade (₱)</label>
                      <input type="number" value={newProduct.price_per_blade} min="0" onChange={(e)=>setNewProduct(p=>({...p,price_per_blade:e.target.value}))} className="w-full px-4 py-3 border rounded-xl" />
                    </div>
                    <div />
                  </div>
                ) : null}

                {newProduct.pricing_method === "fixed" || PRICING_METHOD[newProduct.product_name] === "fixed" ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                      <label className="text-xs text-gray-500">Standard Size</label>
                      <input type="text" value={newProduct.standard_size || ""} onChange={(e)=>setNewProduct(p=>({...p,standard_size:e.target.value}))} className="w-full px-4 py-3 border rounded-xl" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Base Price (₱)</label>
                      <input type="number" value={newProduct.base_price} min="0" onChange={(e)=>setNewProduct(p=>({...p,base_price:e.target.value}))} className="w-full px-4 py-3 border rounded-xl" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Customization</label>
                      <div className="flex items-center gap-3">
                        <input type="checkbox" checked={newProduct.customization} onChange={(e)=>setNewProduct(p=>({...p,customization:e.target.checked}))} />
                        <span className="text-sm text-gray-500">Add customization (₱{newProduct.customization_fee})</span>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-4">
                  <label className="text-xs text-gray-500">Description</label>
                  <textarea rows={3} value={newProduct.description} onChange={(e)=>setNewProduct(p=>({...p,description:e.target.value}))} className="w-full px-4 py-3 border rounded-xl" />
                </div>

                {/* Live preview */}
                <div className="bg-gray-50 border rounded-2xl p-4 mt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500">Area</p>
                      <p className="font-semibold">{newProduct.estimated_area ? `${newProduct.estimated_area} sq ft` : "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Estimated Price</p>
                      <p className="font-semibold text-green-600">₱{(Number(newProduct.estimated_price) || 0).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {modalError ? (
              <p className="text-sm text-red-600 mb-4">
                {modalError}
              </p>
            ) : null}

            <button
              onClick={saveProduct}
              className="mt-6 w-full bg-red-600 text-white py-3 rounded-xl font-semibold hover:bg-red-700"
            >
              {editingProduct ? "Update Product" : "Save Product"}
            </button>

          </div>

        </div>

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

      {showProductManagementModal && (
        <ProductManagementModal
          open={showProductManagementModal}
          onClose={() => setShowProductManagementModal(false)}
          onChange={handleCatalogRefresh}
        />
      )}

    </div>
  );
}

export default Products;

import { useEffect, useRef, useState } from "react";
import {
  Package,
  Plus,
  Search,
  Eye,
  Loader2,
  Pencil,
  Trash2,
  X,
} from "lucide-react";

import Sidebar from "../../components/layout/Sidebar";
import Navbar from "../../components/layout/Navbar";
import { calculateEstimate } from "../../lib/estimator";
import { useAuth } from "@/contexts/AuthContext";
import {
  getProducts,
  createProduct as createProductApi,
  updateProduct as updateProductApi,
  deleteProduct as deleteProductApi,
} from "@/api/products";

function Products() {
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

  useEffect(() => {
    localStorage.setItem("sidebarOpen", JSON.stringify(isSidebarOpen));
  }, [isSidebarOpen]);

  const [newProduct, setNewProduct] =
    useState({
      name: "",
      product_type: "",
      product_name: "",
      pricing_method: "",
      category: "Aluminum",
      variant: "",
      base_price: "",
      price_per_sqft: "",
      price_per_blade: "",
      customization: false,
      customization_fee: 700,
      width: "",
      height: "",
      unit: "in",
      blade_count: "",
      estimated_area: 0,
      estimated_price: 0,
      images: {},
      description: "",
      is_active: true,
    });

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

  const rowsPerPage = 3;

  const filteredProducts = products.filter((product) => {
    const normalizedSearch = search.toLowerCase();
    const matchSearch =
      product.name.toLowerCase().includes(normalizedSearch) ||
      product.description?.toLowerCase().includes(normalizedSearch);

    const matchCategory =
      categoryFilter === "All"
        ? true
        : product.category?.toLowerCase() === categoryFilter.toLowerCase();

    const productType =
      product.type ||
      (product.category?.toLowerCase() === "glass"
        ? "Glass"
        : product.category?.toLowerCase() === "aluminum"
        ? "Aluminum"
        : "Default Type");

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

  const toggleProductStatus = async (product) => {
    try {
      const updated = await updateProductApi(product.id, {
        is_active: !product.is_active,
      });
      const payload = updated.product || updated;
      setProducts((current) =>
        current.map((item) =>
          item.id === product.id || item._id === product.id
            ? {
                ...item,
                ...payload,
                price: `₱${(payload.unit_price || item.unit_price || 0).toLocaleString()}`,
                image: payload.image_url || item.image || "",
                category: payload.category || item.category || "",
              }
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
        const loadedProducts = (data.products || []).map((product) => ({
          ...product,
          id: product._id || product.id,
          price:
            product.price ||
            `₱${(product.unit_price || 0).toLocaleString()}`,
          image: product.image || product.image_url || "",
          category: product.category || "",
          type: product.type ||
            (product.category?.toLowerCase() === "glass"
              ? "Glass"
              : product.category?.toLowerCase() === "aluminum"
              ? "Aluminum"
              : "Default Type"),
        }));
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
        setEditingProduct(product);
        setNewProduct({
          name: product.name || "",
          product_type: product.product_type || product.type || "",
          product_name: product.product_name || product.name || "",
          pricing_method: product.pricing_method || PRICING_METHOD[product.name] || "",
          category: product.category || "Aluminum",
          variant: product.variant || "",
          base_price: product.base_price || product.unit_price || "",
          price_per_sqft: product.price_per_sqft || "",
          price_per_blade: product.price_per_blade || "",
          customization: product.customization || false,
          customization_fee: product.customization_fee || 700,
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
        setNewProduct({
          name: "",
          product_type: "",
          product_name: "",
          pricing_method: "",
          category: "Aluminum",
          variant: "",
          base_price: "",
          price_per_sqft: "",
          price_per_blade: "",
          customization: false,
          customization_fee: 700,
          width: "",
          height: "",
          unit: "in",
          blade_count: "",
          estimated_area: 0,
          estimated_price: 0,
          images: {},
          imageFiles: {},
          description: "",
          is_active: true,
        });
      }
      setShowModal(true);
    };

  const closeModal = () => {
    setShowModal(false);
    setEditingProduct(null);
    setModalError("");
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
              ? {
                  ...item,
                  ...product,
                  id: product._id || product.id,
                  price: `₱${(product.unit_price || 0).toLocaleString()}`,
                  image: product.image_url || product.image || "",
                  category: product.category || item.category || "",
                }
              : item
          )
        );
      } else {
        const created = await createProductApi(payload);
        const product = created.product || created;
        setProducts((current) => [
          ...current,
          {
            ...product,
            id: product._id || product.id,
            price: `₱${(product.unit_price || 0).toLocaleString()}`,
            image: product.image_url || product.image || "",
            category: product.category || "",
          },
        ]);
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
      setProducts((current) =>
        current.filter((product) => product._id !== id && product.id !== id)
      );
    } catch (error) {
      console.error("Delete product failed", error);
    }
  };

  const getProductType = (product) =>
    product.type ||
    (product.category?.toLowerCase() === "glass"
      ? "Glass"
      : product.category?.toLowerCase() === "aluminum"
      ? "Aluminum"
      : "Default Type");



  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar isOpen={isSidebarOpen} />

      <div className="flex-1">

        <Navbar
          toggleSidebar={() =>
            setIsSidebarOpen(
              !isSidebarOpen
            )
          }
        />

        <main className="p-6">

          {/* HEADER */}

          <div className="bg-gradient-to-r from-red-700 via-red-600 to-orange-500 text-white rounded-3xl p-8 shadow-lg">

            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">

              <div>

                <h1 className="text-3xl font-bold">
                  Products
                </h1>

                <p className="mt-2 text-red-100">
                  Manage product listings, pricing, and availability from one unified dashboard.
                </p>

              </div>

            </div>

          </div>

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

              <button
                onClick={() => openModal()}
                disabled={!isAdmin}
                className={`inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-sm transition ${isAdmin ? "bg-red-600 hover:bg-red-700" : "bg-gray-300 cursor-not-allowed"}`}
              >
                <Plus size={18} className="mr-2" />
                Add Product
              </button>
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
                <option value="Windows">Windows</option>
                <option value="Doors">Doors</option>
                <option value="Cabinets">Cabinets</option>
                <option value="Shower Enclosures">Shower Enclosures</option>
                <option value="Aluminum">Aluminum</option>
                <option value="Glass">Glass</option>
                <option value="Accessories">Accessories</option>
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

          <div className="mt-6 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {currentProducts.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 shadow text-center col-span-full">
                <p className="text-gray-500">No products match the selected filters.</p>
              </div>
            ) : (
              currentProducts.map((product) => {
                const productType = getProductType(product);
                return (
                  <div key={product.id} className="group bg-white/5 border border-white/10 backdrop-blur-2xl rounded-[35px] overflow-hidden shadow-2xl">
                    <div className="h-60 bg-gradient-to-br from-blue-600/20 to-white/5">
                      <img
                        src={product.image || "https://via.placeholder.com/400x260?text=No+image"}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <div className="p-8">
                      <div className="flex items-center justify-between gap-4 mb-6">
                        <div>
                          <p className="text-sm text-gray-500">{product.category || "Uncategorized"}</p>
                          <h3 className="text-2xl font-bold text-gray-900 mt-2">{product.name}</h3>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${product.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                          {product.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>

                      <p className="text-gray-500 leading-7 line-clamp-3">{product.description || "No description available."}</p>

                      <div className="mt-8 rounded-3xl bg-white/90 border border-gray-200 p-5">
                        <p className="text-xs uppercase text-gray-500">Type</p>
                        <p className="mt-2 font-semibold text-gray-900">{productType}</p>
                      </div>

                      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        {isAdmin ? (
                          <div className="flex flex-wrap gap-3">
                            <button
                              onClick={() => openModal(product)}
                              className="rounded-2xl border border-red-200 bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteProduct(product.id)}
                              className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                            >
                              Delete
                            </button>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">Admin-only actions are hidden for your account.</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* PAGINATION */}

          <div className="mt-6 flex flex-col gap-4 items-center sm:flex-row sm:justify-center sm:items-center">
            <span className="text-gray-500 text-center">
              Showing {currentProducts.length} of {filteredProducts.length} products
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      {PRODUCT_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
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
                          pricing_method: PRICING_METHOD[value] || p.pricing_method || "",
                        }));
                      }}
                      className="w-full px-4 py-3 border rounded-xl"
                    >
                      <option value="">Select Product Name</option>
                      {(PRODUCT_NAMES[newProduct.product_type] || []).map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">Category</label>
                    <select value={newProduct.category} onChange={(e)=>setNewProduct(p=>({...p,category:e.target.value}))} className="w-full px-4 py-3 border rounded-xl">
                      <option>Windows</option>
                      <option>Doors</option>
                      <option>Cabinets</option>
                      <option>Shower Enclosures</option>
                      <option>Aluminum</option>
                      <option>Glass</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500">Variant</label>
                    <select value={newProduct.variant} disabled={!newProduct.product_name} onChange={(e)=>setNewProduct(p=>({...p,variant:e.target.value}))} className="w-full px-4 py-3 border rounded-xl">
                      <option value="">Select Variant</option>
                      {(VARIANTS[newProduct.product_name] || []).map(v=> <option key={v}>{v}</option>)}
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

    </div>
  );
}

export default Products;

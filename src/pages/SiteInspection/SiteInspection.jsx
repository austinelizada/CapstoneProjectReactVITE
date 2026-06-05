import { useEffect, useState } from "react";
import {
  Search,
  Plus,
  Eye,
  Pencil,
  FileText,
  XOctagon,
  RotateCcw,
} from "lucide-react";
import toast, { Toaster } from 'react-hot-toast';

import { getAdminOrders, generateContract, updateOrderInspection, updateOrderStatus, createInspection } from "@/api/orders";
import { getProducts } from "@/api/products";
import { searchCustomers } from "@/api/users";
import Sidebar from "../../components/layout/Sidebar";
import Navbar from "../../components/layout/Navbar";

const getDefaultInspection = () => ({
  customerId: null,
  customerName: "",
  customerEmail: "",
  phone: "",
  productName: "",
  order_type: "online_order",
  siteAddress: "",
  inspection_date: new Date().toISOString().split("T")[0],
  notes: "",
  items: [
    { id: Date.now() + Math.random(), product_id: "", name: "", width: "", height: "", qty: 1, unit_price: 0, area: 0, unit: "sqft", estimation_mode: "auto" },
  ],
  payment_terms: "",
  estimation_mode: "auto",
});

function SiteInspection() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("sidebarOpen");
    return stored !== null ? JSON.parse(stored) : true;
  });
  const [showModal, setShowModal] = useState(false);
  const [inspections, setInspections] = useState([]);
  const [inspectionsLoading, setInspectionsLoading] = useState(false);
  const [generatingId, setGeneratingId] = useState(null);
  const [cancelledInspections, setCancelledInspections] = useState([]);
  const [cancellingId, setCancellingId] = useState(null);
  const [restoringId, setRestoringId] = useState(null);
  const [viewInspection, setViewInspection] = useState(null);
  const [editInspection, setEditInspection] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [activeTab, setActiveTab] = useState("site");
  const [searchQuery, setSearchQuery] = useState("");
  const [newInspection, setNewInspection] = useState(getDefaultInspection());
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [customerSearchError, setCustomerSearchError] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const today = new Date().toISOString().split("T")[0];

  const fetchSiteInspections = async () => {
    setInspectionsLoading(true);
    try {
      const [siteResp, cancelledResp] = await Promise.all([
        getAdminOrders({ status: "site_inspection" }),
        getAdminOrders({ status: "cancelled" }),
      ]);
      setInspections(siteResp.orders || []);
      setCancelledInspections(cancelledResp.orders || []);
    } catch (error) {
      console.error("Failed to load site inspection records:", error);
      setInspections([]);
      setCancelledInspections([]);
    } finally {
      setInspectionsLoading(false);
    }
  };

  const resetNewInspectionForm = () => {
    setNewInspection(getDefaultInspection());
    setErrors({});
    setCustomerSearch("");
    setCustomerSuggestions([]);
    setCustomerSearchError("");
    setSelectedCustomer(null);
  };

  const closeNewInspectionModal = () => {
    setShowModal(false);
    resetNewInspectionForm();
  };

  const formatCustomerAddress = (customer) => {
    if (!customer) return "";
    return [customer.street_address, customer.city, customer.province, customer.zip_code]
      .filter(Boolean)
      .join(", ");
  };

  const handleClientNameInput = (value) => {
    setCustomerSearch(value);
    setSelectedCustomer(null);
    setCustomerSearchError("");
    setCustomerSuggestions([]);
    setNewInspection((prev) => ({
      ...prev,
      customerName: value,
      customerEmail: "",
      order_type: value.trim() ? "walk_in_customer" : "online_order",
      customerId: null,
    }));
  };

  const handleCustomerSelect = (customer) => {
    const fullName = `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || customer.email || "";
    setSelectedCustomer(customer);
    setCustomerSearch(fullName);
    setCustomerSuggestions([]);
    setCustomerSearchError("");
    setNewInspection((prev) => ({
      ...prev,
      customerId: customer._id,
      customerName: fullName,
      customerEmail: customer.email || "",
      phone: customer.phone || "",
      siteAddress: formatCustomerAddress(customer),
      order_type: "online_order",
    }));
  };

  const clearSelectedCustomer = () => {
    setSelectedCustomer(null);
    setCustomerSearch("");
    setCustomerSuggestions([]);
    setNewInspection((prev) => ({
      ...prev,
      customerId: null,
      customerName: "",
      customerEmail: "",
      phone: "",
      siteAddress: "",
      order_type: "walk_in_customer",
    }));
  };

  const filterInspections = (list) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return list;
    return (list || []).filter((inspection) => {
      const clientName = inspection.customer
        ? `${inspection.customer.first_name || ""} ${inspection.customer.last_name || ""}`.trim() || inspection.customer.email || inspection.customer_name || ""
        : inspection.customer_name || "";
      const phone = inspection.customer?.phone || inspection.customer_phone || "";
      const productName = inspection.items?.[0]?.name || inspection.items?.[0]?.product_id?.name || "";
      const address = inspection.shipping_address || "";
      const status = inspection.status || inspection.inspection_status || "";
      return [clientName, phone, productName, address, status]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  };

  const handleSearchChange = (value) => {
    setSearchQuery(value);
  };


  const validateInspectionPayload = (payload) => {
    const nextErrors = {};
    if (!payload.customerName?.trim()) nextErrors.customerName = "Client name is required.";
    if (!payload.phone?.trim()) nextErrors.phone = "Phone number is required.";
    if (!payload.siteAddress?.trim()) nextErrors.siteAddress = "Site address is required.";
    if (!payload.inspection_date) nextErrors.inspection_date = "Inspection date is required.";
    if (!payload.items || payload.items.length === 0) nextErrors.items = "Add at least one measurement row.";

    const itemErrors = payload.items?.map((item) => {
      const rowErrors = {};
      if (!item.product_id) rowErrors.product_id = "Select a product.";
      if (!item.name?.trim()) rowErrors.name = "Description is required.";
      if (Number(item.width) <= 0) rowErrors.width = "Width must be greater than zero.";
      if (Number(item.height) <= 0) rowErrors.height = "Height must be greater than zero.";
      if (Number(item.qty) <= 0) rowErrors.qty = "Quantity must be at least 1.";
      // unit_price is derived from admin product settings; no manual rate validation here
      return rowErrors;
    }) || [];

    if (itemErrors.some((row) => Object.keys(row).length > 0)) {
      nextErrors.itemErrors = itemErrors;
    }

    return nextErrors;
  };

  const normalizeProductId = (productId) => {
    if (typeof productId === "object" && productId !== null) {
      return String(productId._id || productId.id || productId);
    }
    return productId ? String(productId) : "";
  };

  const calculateItemArea = (item) => {
    const width = Number(item.width) || 0;
    const height = Number(item.height) || 0;
    const qty = Number(item.quantity || item.qty) || 1;
    const sqft = (width * height * qty) / 144;
    return Math.round(sqft * 100) / 100;
  };

  const calculateRowSubtotal = (item) => {
    const area = Number(item.area) || calculateItemArea(item);
    const qty = Number(item.qty) || 1;
    const normalizedProductId = normalizeProductId(item.product_id);
    const product = products.find((p) => String(p._id || p.id) === normalizedProductId) || null;

    if (!product) {
      return Math.round(area * (Number(item.unit_price) || 0) * 100) / 100;
    }

    const pricingMethod = product.pricing_method || "";
    const base = Number(product.base_price) || 0;
    const perSqft = Number(product.price_per_sqft) || 0;
    const perBlade = Number(product.price_per_blade) || 0;
    const unitPrice = Number(product.unit_price) || Number(item.unit_price) || 0;
    const customization = Number(product.customization_fee) || 0;

    let subtotal = 0;
    switch (pricingMethod) {
      case "sqft":
        subtotal = area * perSqft * qty + customization;
        break;
      case "blade":
        subtotal = qty * perBlade + customization;
        break;
      case "fixed":
        subtotal = base + customization;
        break;
      case "per_piece":
        subtotal = qty * unitPrice + customization;
        break;
      default:
        // fallback: use unit_price * area (legacy) or qty * unit_price
        subtotal = area > 0 ? area * unitPrice * qty : qty * unitPrice;
        subtotal = subtotal + customization;
    }

    return Math.round(subtotal * 100) / 100;
  };

  const deriveUnitPriceForPayload = (item) => {
    const normalizedProductId = normalizeProductId(item.product_id);
    const product = products.find((p) => String(p._id || p.id) === normalizedProductId) || null;
    if (!product) return Number(item.unit_price) || 0;
    const pricingMethod = product.pricing_method || "";
    switch (pricingMethod) {
      case "sqft":
        return Number(product.price_per_sqft) || 0;
      case "blade":
        return Number(product.price_per_blade) || 0;
      case "fixed":
        return Number(product.base_price) || 0;
      case "per_piece":
        return Number(product.unit_price) || Number(item.unit_price) || 0;
      default:
        return Number(product.unit_price) || Number(item.unit_price) || 0;
    }
  };

  const formatRateLabel = (item) => {
    const normalizedProductId = normalizeProductId(item.product_id);
    const product = products.find((p) => String(p._id || p.id) === normalizedProductId) || null;
    if (!product) return `₱${(Number(item.unit_price) || 0).toLocaleString()}`;
    const pricingMethod = product.pricing_method || "";
    const perSqft = Number(product.price_per_sqft) || 0;
    const perBlade = Number(product.price_per_blade) || 0;
    const base = Number(product.base_price) || 0;
    const unitPrice = Number(product.unit_price) || 0;
    switch (pricingMethod) {
      case "sqft":
        return `₱${perSqft.toLocaleString()} / sq.ft`;
      case "blade":
        return `₱${perBlade.toLocaleString()} / blade`;
      case "fixed":
        return `Base ₱${base.toLocaleString()}`;
      case "per_piece":
        return `₱${unitPrice.toLocaleString()} / pc`;
      default:
        return `₱${unitPrice.toLocaleString()}`;
    }
  };

const buildInspectionPayload = async (payload) => {
    return {
      customer_id: payload.customerId || null,
      customer_email: payload.customerEmail || "",
      items: (payload.items || []).map((item) => ({
        _id: null,
        product_id: item.product_id || null,
        name: item.name || payload.productName || "Inspection Item",
        quantity: Number(item.qty) || 1,
        unit_price: deriveUnitPriceForPayload(item),
        width: Number(item.width) || 0,
        height: Number(item.height) || 0,
        area: Number(item.area) || 0,
        estimation_mode: item.estimation_mode || 'auto',
        is_estimate: true,
        estimated_price: calculateRowSubtotal(item),
      })),
      shipping_address: payload.siteAddress,
      order_type: payload.order_type === "walk_in_customer" ? "walk_in_customer" : "online_order",
      inspection_notes: payload.notes,
      payment_terms: payload.payment_terms,
      customer_name: payload.customerName,
      customer_phone: payload.phone,
      estimation_mode: "auto",
    };
  };

  const fetchProducts = async () => {
    setProductsLoading(true);
    try {
      const productResp = await getProducts({ adminOnly: true });
      setProducts(productResp.products || []);
    } catch (error) {
      console.error("Failed to load admin products:", error);
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  };

  const handleInspectionFieldChange = (field, value) => {
    setNewInspection((prev) => ({ ...prev, [field]: value }));
  };

  const handleItemFieldChange = (id, field, value) => {
    setNewInspection((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        const width = Number(updated.width) || 0;
        const height = Number(updated.height) || 0;
        const qty = Number(updated.qty) || 1;
        // Convert from square inches to square feet: (w * h) / 144
        const sqft = (width * height * qty) / 144;
        return { ...updated, area: Math.round(sqft * 100) / 100 };
      }),
    }));
  };

  const handleToggleEstimationMode = (id, mode) => {
    setNewInspection((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id !== id) return item;
        if (mode === "manual") {
          // switch to manual mode with empty field
          return { ...item, estimation_mode: "manual", manual_estimated_total: undefined };
        }
        // auto
        return { ...item, estimation_mode: "auto", manual_estimated_total: undefined };
      }),
    }));
  };

  const handleManualTotalChange = (id, value) => {
    // Store raw string value, don't convert to number yet
    setNewInspection((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === id ? { ...item, manual_estimated_total: value } : item)),
    }));
  };

  const handleItemProductChange = (id, productId) => {
    const selectedProduct = products.find((product) => product._id === productId);
    setNewInspection((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id !== id) return item;
        const updated = {
          ...item,
          product_id: productId,
          name: selectedProduct?.name || "",
          unit_price: selectedProduct?.unit_price || 0,
          unit: selectedProduct?.unit || item.unit,
        };
        const width = Number(updated.width) || 0;
        const height = Number(updated.height) || 0;
        const qty = Number(updated.qty) || 1;
        const sqft = (width * height * qty) / 144;
        return { ...updated, area: Math.round(sqft * 100) / 100, estimation_mode: item.estimation_mode || "auto" };
      }),
    }));
  };

  const handleEditItemFieldChange = (id, field, value) => {
    setEditInspection((prev) => ({
      ...prev,
      items: (prev.items || []).map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        const width = Number(updated.width) || 0;
        const height = Number(updated.height) || 0;
        const qty = Number(updated.qty) || 1;
        const sqft = (width * height * qty) / 144;
        return { ...updated, area: Math.round(sqft * 100) / 100 };
      }),
    }));
  };

  const handleEditToggleEstimationMode = (id, mode) => {
    setEditInspection((prev) => ({
      ...prev,
      items: (prev.items || []).map((item) => {
        if (item.id !== id) return item;
        return { ...item, estimation_mode: mode === "manual" ? "manual" : "auto", manual_estimated_total: mode === "manual" ? item.manual_estimated_total : "" };
      }),
    }));
  };

  const handleEditManualTotalChange = (id, value) => {
    setEditInspection((prev) => ({
      ...prev,
      items: (prev.items || []).map((item) => (item.id === id ? { ...item, manual_estimated_total: value } : item)),
    }));
  };

  const handleEditItemProductChange = (id, productId) => {
    const selectedProduct = products.find((product) => product._id === productId);
    setEditInspection((prev) => ({
      ...prev,
      items: (prev.items || []).map((item) => {
        if (item.id !== id) return item;
        const updated = {
          ...item,
          product_id: productId,
          name: selectedProduct?.name || "",
          unit_price: selectedProduct?.unit_price || 0,
          unit: selectedProduct?.unit || item.unit,
        };
        const width = Number(updated.width) || 0;
        const height = Number(updated.height) || 0;
        const qty = Number(updated.qty) || 1;
        const sqft = (width * height * qty) / 144;
        return { ...updated, area: Math.round(sqft * 100) / 100, estimation_mode: item.estimation_mode || "auto" };
      }),
    }));
  };

  const addItemRow = () => {
    setNewInspection((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { id: Date.now() + Math.random(), product_id: "", name: "", width: "", height: "", qty: 1, area: 0, unit: "sqft", unit_price: 0, estimation_mode: "auto" },
      ],
    }));
  };

  const addEditItemRow = () => {
    setEditInspection((prev) => ({
      ...prev,
      items: [
        ...(prev.items || []),
        { id: Date.now() + Math.random(), product_id: "", name: "", width: "", height: "", qty: 1, area: 0, unit: "sqft", unit_price: 0, estimation_mode: "auto", manual_estimated_total: "" },
      ],
    }));
  };

  const removeItemRow = (id) => {
    setNewInspection((prev) => ({ ...prev, items: prev.items.filter((it) => it.id !== id) }));
  };

  const removeEditItemRow = (id) => {
    setEditInspection((prev) => ({ ...prev, items: (prev.items || []).filter((it) => it.id !== id) }));
  };

  const computeTotals = () => {
    const totalArea = (newInspection.items || []).reduce((sum, item) => sum + (Number(item.area) || 0), 0);
    const totalEstimate = Math.round(
      (newInspection.items || []).reduce((sum, item) => {
        if (item.estimation_mode === "manual") return sum + (Number(item.manual_estimated_total) || calculateRowSubtotal(item));
        return sum + calculateRowSubtotal(item);
      }, 0) * 100
    ) / 100;
    return { totalArea, totalEstimate };
  };

  const computeEditTotals = () => {
    if (!editInspection?.items) {
      return { totalArea: 0, totalEstimate: 0 };
    }
    const totalArea = (editInspection.items || []).reduce((sum, item) => sum + (Number(item.area) || 0), 0);
    const totalEstimate = Math.round(
      (editInspection.items || []).reduce((sum, item) => {
        if (item.estimation_mode === "manual") return sum + (Number(item.manual_estimated_total) || calculateRowSubtotal(item));
        return sum + calculateRowSubtotal(item);
      }, 0) * 100
    ) / 100;
    return { totalArea, totalEstimate };
  };

  useEffect(() => {
    fetchSiteInspections();
    fetchProducts();
  }, []);

  useEffect(() => {
    if (selectedCustomer) {
      setCustomerSuggestions([]);
      return;
    }

    const query = customerSearch.trim();
    if (!query) {
      setCustomerSuggestions([]);
      return;
    }

    setCustomerSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const result = await searchCustomers(query);
        setCustomerSuggestions(result.customers || []);
      } catch (error) {
        console.error("Customer search failed", error);
        setCustomerSearchError(error?.message || "Unable to search customers");
      } finally {
        setCustomerSearchLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [customerSearch, selectedCustomer]);

  // Ensure form is reset whenever the New Inspection modal opens
  useEffect(() => {
    if (showModal) {
      resetNewInspectionForm();
    }
    // only run when showModal changes
  }, [showModal]);

  const submitNewInspection = async () => {
    const validationErrors = validateInspectionPayload(newInspection);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      const firstKey = Object.keys(validationErrors)[0];
      const firstError = validationErrors[firstKey];
      if (Array.isArray(firstError)) {
        const rowError = firstError.find((err) => err && Object.values(err).length > 0);
        toast.error(rowError ? Object.values(rowError)[0] : "Please fix the form errors.");
      } else {
        toast.error(firstError);
      }
      return;
    }

    setSubmitting(true);
    try {
      const payload = await buildInspectionPayload(newInspection);
      await createInspection(payload);
      toast.success("Inspection created");
      closeNewInspectionModal();
      await fetchSiteInspections();
    } catch (err) {
      console.error("Create inspection failed", err);
      toast.error(err?.data?.message || err?.message || "Failed to create inspection.");
    } finally {
      setSubmitting(false);
    }
  };

  // Action handlers for inspection table
  const handleView = (inspection) => {
    // Open view modal with inspection details
    setViewInspection(inspection);
  };

  const handleGenerateContract = async (orderId) => {
    if (!orderId) return;
    try {
      setGeneratingId(orderId);
      const res = await generateContract(orderId);
      // If backend returns a contract URL, open it
      if (res && res.url) {
        window.open(res.url, "_blank");
      } else {
        window.alert(res?.message || "Contract generated successfully.");
      }
    } catch (err) {
      console.error("Generate contract failed", err);
      window.alert(err?.data?.message || err?.message || "Failed to generate contract.");
    } finally {
      setGeneratingId(null);
    }
  };

  const handleEdit = (orderId) => {
    const inspection = inspections.find((i) => (i._id || i.id) === orderId);
    if (inspection) {
      const customerName = inspection.customer
        ? `${inspection.customer.first_name || ""} ${inspection.customer.last_name || ""}`.trim()
        : inspection.customer_name || "";
      const phone = inspection.customer?.phone || inspection.customer_phone || "";
      const customerEmail = inspection.customer?.email || inspection.customer_email || "";
      const siteAddress = inspection.shipping_address || "";
      const orderType = inspection.order_type || "online_order";

      setEditInspection({
        id: orderId,
        customerName,
        customerEmail,
        phone,
        siteAddress,
        order_type: orderType,
        payment_terms: inspection.payment_terms || "",
        inspection_date: inspection.inspection_date ? inspection.inspection_date.split("T")[0] : "",
        inspection_notes: inspection.inspection_notes || "",
        issues_found: inspection.issues_found || "",
        inspection_status: inspection.inspection_status || "pending",
        items: (inspection.items || []).map((item) => {
          const normalizedProductId = normalizeProductId(item.product_id);
          const area = item.area || calculateItemArea(item);
          return {
            ...item,
            id: item.id || item._id || `${Date.now()}-${Math.random()}`,
            product_id: normalizedProductId,
            qty: item.quantity || item.qty || 1,
            width: item.width || "",
            height: item.height || "",
            area,
            unit_price: item.unit_price || 0,
            estimation_mode: item.estimation_mode || "auto",
            manual_estimated_total: item.manual_estimated_total ?? "",
          };
        }),
        customerId: inspection.customer?._id || null,
      });
    } else {
      // fallback: open an empty editor
      setEditInspection({ id: orderId, inspection_date: "", inspection_notes: "", issues_found: "", inspection_status: "pending" });
    }
  };

  const handleDelete = (orderId) => {
    // kept for backward compatibility; open confirmation modal
    requestCancel(orderId);
  };

  const handleCancel = async (orderId) => {
    if (!orderId) return;
    try {
      setCancellingId(orderId);
      const res = await updateOrderStatus(orderId, { status: "cancelled" });
      if (res && res.order) {
        setInspections((prev) => prev.filter((i) => (i._id || i.id) !== orderId));
        setCancelledInspections((prev) => [res.order, ...prev]);
        // show undo toast with react-hot-toast
        toast((t) => (
          <div className="flex items-center justify-between gap-4">
            <div>Inspection cancelled</div>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  toast.dismiss(t.id);
                  await handleRestore(orderId);
                }}
                className="text-sm text-blue-600"
              >
                Undo
              </button>
            </div>
          </div>
        ), { duration: 6000 });
      } else {
        setInspections((prev) => prev.filter((i) => (i._id || i.id) !== orderId));
      }
    } catch (err) {
      console.error("Failed to cancel inspection", err);
      toast.error(err?.data?.message || err?.message || "Failed to cancel inspection.");
    } finally {
      setCancellingId(null);
    }
  };

  const [cancelConfirm, setCancelConfirm] = useState({ open: false, id: null });

  const requestCancel = (orderId) => {
    setCancelConfirm({ open: true, id: orderId });
  };

  const handleConfirmCancel = async () => {
    const orderId = cancelConfirm.id;
    setCancelConfirm({ open: false, id: null });
    await handleCancel(orderId);
  };

  const closeCancelModal = () => setCancelConfirm({ open: false, id: null });

  const [restoreConfirm, setRestoreConfirm] = useState({ open: false, id: null });

  const requestRestore = (orderId) => {
    setRestoreConfirm({ open: true, id: orderId });
  };

  const closeRestoreModal = () => setRestoreConfirm({ open: false, id: null });

  const handleConfirmRestore = async () => {
    const orderId = restoreConfirm.id;
    setRestoreConfirm({ open: false, id: null });
    await handleRestore(orderId);
  };

  const handleRestore = async (orderId) => {
    if (!orderId) return;
    try {
      setRestoringId(orderId);
      const res = await updateOrderStatus(orderId, { status: "site_inspection" });
      if (res && res.order) {
        setCancelledInspections((prev) => prev.filter((i) => (i._id || i.id) !== orderId));
        setInspections((prev) => [res.order, ...prev]);
        toast.success("Inspection restored");
      }
    } catch (err) {
      console.error("Restore failed", err);
      toast.error(err?.data?.message || err?.message || "Failed to restore inspection.");
    } finally {
      setRestoringId(null);
    }
  };

  const handleEditChange = (name, value) => {
    setEditInspection((prev) => ({ ...prev, [name]: value }));
  };

  const saveEdit = async () => {
    if (!editInspection || !editInspection.id) return;
    const validationErrors = validateInspectionPayload(editInspection);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      const firstKey = Object.keys(validationErrors)[0];
      const firstError = validationErrors[firstKey];
      if (Array.isArray(firstError)) {
        const rowError = firstError.find((err) => err && Object.values(err).length > 0);
        toast.error(rowError ? Object.values(rowError)[0] : "Please fix the form errors.");
      } else {
        toast.error(firstError);
      }
      return;
    }

    setSavingEdit(true);
    try {
      const payload = {
        inspection_date: editInspection.inspection_date || undefined,
        inspection_notes: editInspection.inspection_notes || undefined,
        issues_found: editInspection.issues_found || undefined,
        inspection_status: editInspection.inspection_status || undefined,
        shipping_address: editInspection.siteAddress || undefined,
        payment_terms: editInspection.payment_terms || undefined,
        items: (editInspection.items || []).map((item) => ({
          product_id: item.product_id ? (item.product_id._id || item.product_id) : null,
          name: item.name || "",
          quantity: Number(item.qty) || 1,
          unit_price: deriveUnitPriceForPayload(item),
          width: Number(item.width) || 0,
          height: Number(item.height) || 0,
          area: Number(item.area) || 0,
          estimated_price: item.estimation_mode === "manual"
            ? Number(item.manual_estimated_total) || calculateRowSubtotal(item)
            : calculateRowSubtotal(item),
          is_estimate: true,
          unit: item.unit || "sqft",
        })),
        total_amount: computeEditTotals().totalEstimate,
      };
      const res = await updateOrderInspection(editInspection.id, payload);
      toast.success("Inspection saved");
      // update local inspections list with returned order
      if (res && res.order) {
        setInspections((prev) => prev.map((i) => ((i._id || i.id) === editInspection.id ? res.order : i)));
      }
      setEditInspection(null);
    } catch (err) {
      console.error("Failed to save inspection edit", err);
      window.alert(err?.data?.message || err?.message || "Failed to save inspection.");
    } finally {
      setSavingEdit(false);
    }
  };

  useEffect(() => {
    localStorage.setItem("sidebarOpen", JSON.stringify(isSidebarOpen));
  }, [isSidebarOpen]);

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar isOpen={isSidebarOpen} />

      <div className="flex-1">
        <Navbar
          toggleSidebar={() =>
            setIsSidebarOpen(!isSidebarOpen)
          }
        />

        <main className="p-6">

          {/* HEADER */}

          <div className="bg-gradient-to-r from-red-700 via-red-600 to-orange-500 text-white rounded-3xl p-8 shadow-lg">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

              <div>
                <h1 className="text-3xl font-bold">
                  Site Inspection Management
                </h1>

                <p className="mt-2 text-red-100">
                  Manage all site inspections and estimations.
                </p>
              </div>

            </div>
          </div>

          {/* STATS */}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">

            <div className="bg-white rounded-3xl p-6 shadow">
              <p className="text-gray-500">

                Total Inspections
              </p>

              <h2 className="text-4xl font-bold mt-2">
                {inspections.length}
              </h2>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow">
              <p className="text-gray-500">
                Pending
              </p>

              <h2 className="text-4xl font-bold text-yellow-500 mt-2">
                {inspections.filter((inspection) =>
                  inspection.inspection_status === "pending" || inspection.status === "site_inspection"
                ).length}
              </h2>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow">
              <p className="text-gray-500">
                Completed
              </p>

              <h2 className="text-4xl font-bold text-green-600 mt-2">
                {inspections.filter((inspection) =>
                  inspection.inspection_status === "completed" || inspection.status === "completed"
                ).length}
              </h2>
            </div>

          </div>

          {/* CANCEL CONFIRMATION MODAL */}
          {cancelConfirm.open && (
            <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
              <div className="bg-white w-full max-w-md rounded-3xl p-6">
                <h3 className="text-xl font-bold mb-4">Confirm Cancel Inspection</h3>
                <p className="text-gray-600 mb-6">Are you sure you want to mark this inspection as cancelled? This action can be restored only by admins via the backend.</p>

                <div className="flex justify-end gap-3">
                  <button onClick={closeCancelModal} className="px-4 py-2 bg-gray-200 rounded-xl">Close</button>
                  <button
                    onClick={handleConfirmCancel}
                    className="px-4 py-2 bg-red-600 text-white rounded-xl"
                    disabled={cancellingId === cancelConfirm.id}
                  >
                    {cancellingId === cancelConfirm.id ? 'Cancelling...' : 'Confirm Cancel'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* RESTORE CONFIRMATION MODAL */}
          {restoreConfirm.open && (
            <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
              <div className="bg-white w-full max-w-md rounded-3xl p-6">
                <h3 className="text-xl font-bold mb-4">Confirm Restore Inspection</h3>
                <p className="text-gray-600 mb-6">Are you sure you want to restore this inspection to Site Inspections?</p>

                <div className="flex justify-end gap-3">
                  <button onClick={closeRestoreModal} className="px-4 py-2 bg-gray-200 rounded-xl">Close</button>
                  <button
                    onClick={handleConfirmRestore}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl"
                    disabled={restoringId === restoreConfirm.id}
                  >
                    {restoringId === restoreConfirm.id ? 'Restoring...' : 'Confirm Restore'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <Toaster position="bottom-right" />

          {/* SEARCH */}
          <div className="bg-white rounded-3xl shadow mt-6 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative flex-1">
                <Search
                  size={20}
                  className="absolute left-4 top-4 text-gray-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search inspections..."
                  className="w-full pl-12 pr-4 py-3 border rounded-xl focus:outline-none focus:border-red-500"
                />
              </div>

              <button
                onClick={() => { resetNewInspectionForm(); setShowModal(true); }}
                className="inline-flex items-center justify-center rounded-2xl bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
              >
                <Plus size={18} className="mr-2" />
                New Site Inspection
              </button>
            </div>
          </div>

          {/* TABLE */}

          <div className="bg-white rounded-3xl shadow mt-6 overflow-hidden">

            <div className="p-6 border-b">

              <h2 className="text-xl font-bold">
                Site Inspection Records
              </h2>

            </div>

            {/* Tabs */}
            <div className="p-4 border-b bg-white flex items-center gap-4">
              <button
                className={`px-4 py-2 rounded-xl font-semibold ${activeTab === 'site' ? 'bg-red-600 text-white' : 'bg-white text-gray-700'}`}
                onClick={() => setActiveTab('site')}
              >
                Site Inspections
              </button>
              <button
                className={`px-4 py-2 rounded-xl font-semibold ${activeTab === 'cancelled' ? 'bg-red-600 text-white' : 'bg-white text-gray-700'}`}
                onClick={() => setActiveTab('cancelled')}
              >
                Cancelled
              </button>
            </div>

            <div className="overflow-x-auto">

              <table className="w-full">

                <thead className="bg-gray-50">

                  <tr>

                    <th className="p-4 text-left">Client</th>
                    <th className="p-4 text-left">Phone</th>
                    <th className="p-4 text-left">Product</th>
                    <th className="p-4 text-left">Order Type</th>
                    <th className="p-4 text-left">Site Address</th>
                    <th className="p-4 text-left">Date Submitted</th>
                    <th className="p-4 text-left">Status</th>
                    <th className="p-4 text-left">Estimation</th>
                    <th className="p-4 text-center">Actions</th>

                  </tr>

                </thead>

                <tbody>
                  {inspectionsLoading ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500">
                        Loading inspections...
                      </td>
                    </tr>
                  ) : (() => {
                    const sourceList = activeTab === 'cancelled' ? cancelledInspections : inspections;
                    const list = filterInspections(sourceList);
                    if (!list || list.length === 0) {
                      return (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-slate-500">
                            No records in this tab.
                          </td>
                        </tr>
                      );
                    }

                    return list.map((inspection) => {
                      const clientName = inspection.customer
                        ? `${inspection.customer.first_name || ""} ${inspection.customer.last_name || ""}`.trim() || inspection.customer.email || inspection.customer_name || "Customer"
                        : inspection.customer_name || "Customer";
                      const phone = inspection.customer?.phone || inspection.customer_phone || "—";
                      const productName = inspection.items?.[0]?.name || inspection.items?.[0]?.product_id?.name || "Project Item";
                      const orderType = inspection.order_type === "walk_in_customer" ? "Walk-in" : "Online";
                      const address = inspection.shipping_address || "—";
                      const date = inspection.createdAt ? new Date(inspection.createdAt).toLocaleDateString() : "—";
                      const statusLabel = inspection.status === "site_inspection" ? "Site Inspection" : inspection.status?.replace(/_/g, " ") || "Pending";
                      const estimatedCost = inspection.total_amount ? `₱${inspection.total_amount.toLocaleString()}` : "—";

                      return (
                        <tr
                          key={inspection._id || inspection.id}
                          className="border-t hover:bg-gray-50"
                        >
                          <td className="p-4">{clientName}</td>
                          <td className="p-4">{phone}</td>
                          <td className="p-4">{productName}</td>
                          <td className="p-4">{orderType}</td>
                          <td className="p-4 max-w-xs break-words">{address}</td>
                          <td className="p-4">{date}</td>
                          <td className="p-4">
                            <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm">
                              {statusLabel}
                            </span>
                          </td>
                          <td className="p-4 font-semibold text-green-600">{estimatedCost}</td>
                          <td className="p-4">
                            <div className="flex justify-center gap-3">
                              <button
                                className="text-blue-600 hover:text-blue-800"
                                onClick={() => handleView(inspection)}
                                title="View inspection"
                                aria-label="View inspection"
                              >
                                <Eye size={23} />
                              </button>
                              {activeTab !== 'cancelled' && (
                                <button
                                  title="Generate Contract"
                                  aria-label="Generate contract"
                                  className="text-emerald-600 hover:text-emerald-800"
                                  onClick={() => handleGenerateContract(inspection._id || inspection.id)}
                                  disabled={generatingId === (inspection._id || inspection.id)}
                                >
                                  {generatingId === (inspection._id || inspection.id) ? (
                                    "Generating..."
                                  ) : (
                                    <FileText size={23} />
                                  )}
                                </button>
                              )}
                              {activeTab !== 'cancelled' ? (
                                <>
                                  <button
                                    title="Edit inspection"
                                    aria-label="Edit inspection"
                                    className="text-orange-500 hover:text-orange-700"
                                    onClick={() => handleEdit(inspection._id || inspection.id)}
                                  >
                                    <Pencil size={23} />
                                  </button>
                                  <button
                                    className="text-red-600 hover:text-red-800"
                                    onClick={() => requestCancel(inspection._id || inspection.id)}
                                    title="Cancel inspection"
                                    aria-label="Cancel inspection"
                                    disabled={cancellingId === (inspection._id || inspection.id)}
                                  >
                                    {cancellingId === (inspection._id || inspection.id) ? "Cancelling..." : <XOctagon size={23} />}
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    title="Restore inspection"
                                    aria-label="Restore inspection"
                                    className="text-emerald-600 hover:text-emerald-800"
                                    onClick={() => requestRestore(inspection._id || inspection.id)}
                                    disabled={restoringId === (inspection._id || inspection.id)}
                                  >
                                    {restoringId === (inspection._id || inspection.id) ? 'Restoring...' : <RotateCcw size={23} />}
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  })() }
                </tbody>

              </table>

            </div>

            <div className="flex justify-center items-center p-4 border-t bg-gray-50 gap-4">
              <button className="px-4 py-2 border rounded-lg bg-white hover:bg-gray-100">
                Previous
              </button>
              <button className="w-10 h-10 rounded-lg bg-red-600 text-white">
                1
              </button>
              <button className="w-10 h-10 rounded-lg border bg-white hover:bg-gray-100">
                2
              </button>
              <button className="px-4 py-2 border rounded-lg bg-white hover:bg-gray-100">
                Next
              </button>
            </div>

          </div>

          {/* MODAL */}

          {showModal && (

            <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">

              <div className="bg-white w-full max-w-4xl rounded-3xl p-8 max-h-[90vh] overflow-y-auto">

                <div className="flex justify-between items-center mb-8">

                  <h2 className="text-2xl font-bold">
                    New Site Inspection
                  </h2>

                  <button
                    onClick={() => setShowModal(false)}
                    className="text-3xl"
                  >
                    ×
                  </button>

                </div>

                <div className="grid md:grid-cols-2 gap-6">

                  <div className="relative">
                  <label className="block font-medium text-gray-700 mb-2">Client Name</label>
                    <input
                      type="text"
                      placeholder="Search customer or enter name"
                      className="border rounded-xl p-3 w-full"
                      value={customerSearch || newInspection.customerName}
                      onChange={(e) => handleClientNameInput(e.target.value)}
                      disabled={Boolean(selectedCustomer)}
                    />
                    {selectedCustomer && (
                      <button
                        type="button"
                        onClick={clearSelectedCustomer}
                        className="mt-2 text-sm text-blue-600"
                      >
                        Change customer
                      </button>
                    )}
                    {customerSearchLoading && !selectedCustomer && (
                      <p className="mt-2 text-sm text-gray-500">Searching customers...</p>
                    )}
                    {customerSearchError && <p className="mt-2 text-sm text-red-600">{customerSearchError}</p>}
                    {customerSuggestions.length > 0 && !selectedCustomer && (
                      <div className="absolute z-30 mt-2 w-full rounded-2xl border bg-white shadow-lg max-h-72 overflow-y-auto">
                        {customerSuggestions.map((customer) => {
                          const label = `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || customer.email || customer.phone || "Unnamed";
                          return (
                            <button
                              key={customer._id}
                              type="button"
                              onClick={() => handleCustomerSelect(customer)}
                              className="w-full text-left px-4 py-3 hover:bg-gray-100"
                            >
                              <div className="font-semibold">{label}</div>
                              <div className="text-sm text-gray-500">{customer.email || customer.phone || formatCustomerAddress(customer)}</div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {errors.customerName && <p className="mt-2 text-sm text-red-600">{errors.customerName}</p>}
                  </div>

                  <div>
                  <label className="block font-medium text-gray-700 mb-2">Email Address</label>
                    <input
                      type="email"
                      placeholder="Email Address"
                      className="border rounded-xl p-3 w-full"
                      value={newInspection.customerEmail}
                      onChange={(e) => handleInspectionFieldChange("customerEmail", e.target.value)}
                      readOnly={Boolean(selectedCustomer)}
                    />
                  </div>

                  <div>
                  <label className="block font-medium text-gray-700 mb-2">Phone Number</label>
                    <input
                      type="text"
                      placeholder="Phone Number"
                      className="border rounded-xl p-3 w-full"
                      value={newInspection.phone}
                      onChange={(e) => handleInspectionFieldChange("phone", e.target.value)}
                      readOnly={Boolean(selectedCustomer)}
                    />
                    {errors.phone && <p className="mt-2 text-sm text-red-600">{errors.phone}</p>}
                  </div>

                  <div>
                    <label className="block font-medium text-gray-700 mb-2">Site Inspection Date</label>
                    <input
                      type="date"
                      className="border rounded-xl p-3 w-full"
                      value={newInspection.inspection_date}
                      min={today}
                      onChange={(e) => handleInspectionFieldChange("inspection_date", e.target.value)}
                    />
                    {errors.inspection_date && <p className="mt-2 text-sm text-red-600">{errors.inspection_date}</p>}
                  </div>

                  <div>
                    <label className="block font-medium text-gray-700 mb-2">Customer Type</label>
                    <select
                      className="border rounded-xl p-3 w-full"
                      value={newInspection.order_type}
                      onChange={(e) => handleInspectionFieldChange("order_type", e.target.value)}
                      disabled={Boolean(selectedCustomer)}
                    >
                      <option value="online_order">Online Customer</option>
                      <option value="walk_in_customer">Walk-in Customer</option>
                    </select>
                  </div>

                            <div>
                              <label className="block font-medium text-gray-700 mb-2">Site Address</label>
                                <input
                                  type="text"
                                  placeholder="Site Address"
                                  className="border rounded-xl p-3 w-full"
                                  value={newInspection.siteAddress}
                                  onChange={(e) => handleInspectionFieldChange("siteAddress", e.target.value)}
                                />
                                {errors.siteAddress && <p className="mt-2 text-sm text-red-600">{errors.siteAddress}</p>}
                              </div>
                  
		              <div>
                    <label className="block font-medium text-gray-700 mb-2">Payment Terms</label>
                    <select
                      className="border rounded-xl p-3 w-full"
                      value={newInspection.payment_terms}
                      onChange={(e) => handleInspectionFieldChange("payment_terms", e.target.value)}
                    >
                      <option value="50%_down_payment">50% Down Payment</option>
                      <option value="full_payment">Full Payment</option>
                    </select>
                  </div>
                </div>
                <textarea
                  rows="4"
                  placeholder="Inspection Notes"
                  className="w-full border rounded-xl p-3 mt-6"
                  value={newInspection.notes}
                  onChange={(e) => setNewInspection((p) => ({ ...p, notes: e.target.value }))}
                />

                {/* Measurements rows */}
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">Measurements</h3>
                    <button type="button" onClick={addItemRow} className="px-3 py-1 bg-red-600 text-white rounded">+ Add Row</button>
                  </div>
                  <div className="space-y-3">
                    {(newInspection.items || []).map((it, index) => {
                      const rowSubtotal = calculateRowSubtotal(it);
                      return (
                        <div key={it.id} className="py-5 mt-4 grid grid-cols-10 gap-2 items-center">
                          <div className="col-span-3">
                            <select
                              className="w-full border rounded p-2"
                              value={it.product_id || ""}
                              onChange={(e) => handleItemProductChange(it.id, e.target.value)}
                            >
                              <option value="">Select product</option>
                              {products.map((product) => (
                                <option key={product._id} value={product._id}>
                                  {product.name}
                                </option>
                              ))}
                            </select>
                            {productsLoading && <p className="text-xs text-gray-500 mt-1">Loading products...</p>}
                          </div>
                          <input
                            className="col-span-2 border rounded p-2"
                            placeholder="W"
                            value={it.width}
                            onChange={(e) => handleItemFieldChange(it.id, 'width', e.target.value)}
                          />
                          <input
                            className="col-span-2 border rounded p-2"
                            placeholder="H"
                            value={it.height}
                            onChange={(e) => handleItemFieldChange(it.id, 'height', e.target.value)}
                          />
                          <div className="col-span-2 border rounded p-2 bg-gray-50 flex items-center">
                            <div className="text-sm">{formatRateLabel(it)}</div>
                          </div>

                          <button type="button" className="col-span-1 text-red-600" onClick={() => removeItemRow(it.id)}>Remove</button>

                          {/* per-row summary cards below inputs */}
                          <div className="col-span-12 mt-2 grid grid-cols-3 gap-2">
                            <div className="p-4 bg-red-100 rounded text-sm">
                              <div className="text-sm text-gray-700">Total Area</div>
                              <div className="font-bold text-gray-700"> {it.area || 0} sq ft
                              </div>
                            </div>
                            <div className="p-3 bg-yellow-100 rounded text-sm">
                              <div className="text-medium text-gray-700">Estimation Mode</div>
                              <div className="mt-1">
                                <select
                                  value={it.estimation_mode || 'auto'}
                                  onChange={(e) => handleToggleEstimationMode(it.id, e.target.value)}
                                  className="w-full border rounded p-1 text-sm text-gray-700 bg-white font-bold"
                                >
                                  <option value="auto">Auto</option>
                                  <option value="manual">Manual</option>
                                </select>
                              </div>
                            </div>
                            <div className="p-3 bg-green-100 rounded text-sm">
                              <div className="text-sm text-gray-700">Estimated Total</div>
                              {it.estimation_mode === 'auto' ? (
                                <div className="p-2 text-sm font-bold text-gray-700"> ₱{rowSubtotal.toLocaleString()}
                                </div>
                              ) : (
                                <div className="mt-2">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={it.manual_estimated_total ?? ''}
                                    onChange={(e) => handleManualTotalChange(it.id, e.target.value.replace(/[^0-9]/g, ''))}
                                    className="w-full border rounded p-1 text-sm font-bold"
                                    placeholder="Enter amount"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                          {errors.itemErrors?.[index] && (
                            <div className="col-span-12 text-sm text-red-600">
                              {Object.values(errors.itemErrors[index]).filter(Boolean).join(" ")}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>


                <div className="flex justify-between items-center gap-3 mt-8">

                  <div className="text-lg font-bold">
                    Total Project Cost: <span className="text-red-600">₱{computeTotals().totalEstimate.toLocaleString()}</span>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowModal(false)}
                      className="px-6 py-3 bg-gray-200 rounded-xl"
                    >
                      Cancel
                    </button>

                    <button onClick={submitNewInspection} className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700" disabled={submitting}>
                      {submitting ? 'Saving...' : 'Save Inspection'}
                    </button>
                  </div>

                </div>

              </div>

            </div>

          )}

          {/* VIEW DETAILS MODAL */}
          {viewInspection && (
            <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
              <div className="bg-white w-full max-w-3xl rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold">Inspection Details</h2>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => { setViewInspection(null); }}
                      className="px-4 py-2 bg-gray-200 rounded-xl"
                    >
                      Close
                    </button>
                    <button
                      onClick={() => { handleEdit(viewInspection._id || viewInspection.id); setViewInspection(null); }}
                      className="px-4 py-2 bg-orange-500 text-white rounded-xl"
                    >
                      Edit
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <h3 className="font-semibold">Client</h3>
                      <p className="text-lg font-medium">
                        {viewInspection.customer
                          ? `${viewInspection.customer.first_name || ''} ${viewInspection.customer.last_name || ''}`.trim()
                          : viewInspection.customer_name || 'Customer'}
                      </p>
                      <p className="text-sm text-gray-500">{viewInspection.customer?.email || viewInspection.customer_email || '—'}</p>
                      <p className="text-sm text-gray-500">{viewInspection.customer?.phone || viewInspection.customer_phone || '—'}</p>
                    </div>

                    <div>
                      <h3 className="font-semibold">Order Details</h3>
                      <div className="space-y-2 text-sm text-gray-700">
                        <div>
                          <span className="font-semibold">Order Type: </span>
                          {viewInspection.order_type === 'walk_in_customer' ? 'Walk-in Customer' : 'Online Customer'}
                        </div>
                        <div>
                          <span className="font-semibold">Payment Terms: </span>
                          {viewInspection.payment_terms === '50%_down_payment'
                            ? '50% Down Payment'
                            : viewInspection.payment_terms === 'full_payment'
                              ? 'Full Payment'
                              : viewInspection.payment_terms || '—'}
                        </div>
                        <div>
                          <span className="font-semibold">Total Amount: </span>
                          {viewInspection.total_amount ? `₱${Number(viewInspection.total_amount).toLocaleString()}` : '—'}
                        </div>
                        <div>
                          <span className="font-semibold">Created:</span> {viewInspection.createdAt ? new Date(viewInspection.createdAt).toLocaleString() : '—'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold">Site Address</h3>
                    <p className="break-words">{viewInspection.shipping_address || '—'}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold">Items</h3>
                    <div className="space-y-3">
                      {(viewInspection.items || []).map((it, idx) => (
                        <div key={idx} className="rounded-2xl border bg-gray-50 p-4">
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="font-semibold text-gray-700">{it.name || it.product_id?.name || 'Item'}</p>
                              <p className="text-sm text-gray-500">Qty: {it.quantity || 1}</p>
                            </div>
                            <div className="text-sm text-gray-500">
                              {it.width || it.height ? `${it.width || 0} x ${it.height || 0}` : 'Dimensions unavailable'}
                            </div>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-gray-600">
                            <div>Area: {(Number(it.area) || 0).toLocaleString()} sq ft</div>
                            <div>Est. Total: {it.estimated_price ? `₱${Number(it.estimated_price).toLocaleString()}` : '₱0'}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold">Inspection Notes</h3>
                    <p className="whitespace-pre-wrap">{viewInspection.inspection_notes || '—'}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-semibold">Inspection Date</h3>
                      <p>{viewInspection.inspection_date ? new Date(viewInspection.inspection_date).toLocaleString() : '—'}</p>
                    </div>
                    <div>
                      <h3 className="font-semibold">Status</h3>
                      <p>{viewInspection.inspection_status || viewInspection.status || '—'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* EDIT INSPECTION MODAL */}
          {editInspection && (
            <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
              <div className="bg-white w-full max-w-4xl rounded-3xl p-8 max-h-[90vh] overflow-y-auto">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold">Edit Site Inspection</h2>
                    <p className="text-sm text-gray-500 mt-1">Review customer details and update inspection schedule.</p>
                  </div>
                  <button
                    onClick={() => setEditInspection(null)}
                    className="text-3xl"
                  >
                    ×
                  </button>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block font-medium text-gray-700 mb-2">Client Name</label>
                    <input
                      type="text"
                      value={editInspection.customerName || ""}
                      readOnly
                      className="border rounded-xl p-3 w-full bg-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-gray-700 mb-2">Email Address</label>
                    <input
                      type="email"
                      value={editInspection.customerEmail || ""}
                      readOnly
                      className="border rounded-xl p-3 w-full bg-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-gray-700 mb-2">Phone Number</label>
                    <input
                      type="text"
                      value={editInspection.phone || ""}
                      readOnly
                      className="border rounded-xl p-3 w-full bg-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-gray-700 mb-2">Site Inspection Date</label>
                    <input
                      type="date"
                      value={editInspection.inspection_date || ""}
                      onChange={(e) => handleEditChange('inspection_date', e.target.value)}
                      className="w-full border rounded-xl p-3"
                      min={today}
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-gray-700 mb-2">Customer Type</label>
                    <select
                      value={editInspection.order_type || "online_order"}
                      className="w-full border rounded-xl p-3 bg-gray-100"
                      disabled
                    >
                      <option value="online_order">Online Customer</option>
                      <option value="walk_in_customer">Walk-in Customer</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block font-medium text-gray-700 mb-2">Site Address</label>
                    <input
                      type="text"
                      value={editInspection.siteAddress || ""}
                      onChange={(e) => handleEditChange('siteAddress', e.target.value)}
                      className="border rounded-xl p-3 w-full"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block font-medium text-gray-700 mb-2">Payment Terms</label>
                    <select
                      value={editInspection.payment_terms || ""}
                      onChange={(e) => handleEditChange('payment_terms', e.target.value)}
                      className="w-full border rounded-xl p-3"
                    >
                      <option value="50%_down_payment">50% Down Payment</option>
                      <option value="full_payment">Full Payment</option>
                    </select>
                  </div>
                </div>

                <div className="mt-6">
                  <label className="block font-medium text-gray-700 mb-2">Inspection Notes</label>
                  <textarea
                    rows="4"
                    value={editInspection.inspection_notes || ""}
                    onChange={(e) => handleEditChange('inspection_notes', e.target.value)}
                    className="w-full border rounded-xl p-3"
                  />
                </div>

                <div className="mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">Measurements</h3>
                    <button type="button" onClick={addEditItemRow} className="px-3 py-1 bg-red-600 text-white rounded">+ Add Row</button>
                  </div>
                  <div className="space-y-3">
                    {(editInspection.items || []).map((it, index) => {
                      const rowSubtotal = calculateRowSubtotal(it);
                      return (
                        <div key={it.id} className="py-5 mt-4 grid grid-cols-10 gap-2 items-center">
                          <div className="col-span-3">
                            <select
                              className="w-full border rounded p-2"
                              value={it.product_id || ""}
                              onChange={(e) => handleEditItemProductChange(it.id, e.target.value)}
                            >
                              <option value="">Select product</option>
                              {products.map((product) => (
                                <option key={product._id} value={product._id}>
                                  {product.name}
                                </option>
                              ))}
                            </select>
                            {productsLoading && <p className="text-xs text-gray-500 mt-1">Loading products...</p>}
                          </div>
                          <input
                            className="col-span-2 border rounded p-2"
                            placeholder="W"
                            value={it.width}
                            onChange={(e) => handleEditItemFieldChange(it.id, 'width', e.target.value)}
                          />
                          <input
                            className="col-span-2 border rounded p-2"
                            placeholder="H"
                            value={it.height}
                            onChange={(e) => handleEditItemFieldChange(it.id, 'height', e.target.value)}
                          />
                          <div className="col-span-2 border rounded p-2 bg-gray-50 flex items-center">
                            <div className="text-sm">{formatRateLabel(it)}</div>
                          </div>

                          <button type="button" className="col-span-1 text-red-600" onClick={() => removeEditItemRow(it.id)}>Remove</button>

                          <div className="col-span-12 mt-2 grid grid-cols-3 gap-2">
                            <div className="p-4 bg-red-100 rounded text-sm">
                              <div className="text-sm text-gray-700">Total Area</div>
                              <div className="font-bold text-gray-700">{it.area || 0} sq ft</div>
                            </div>
                            <div className="p-3 bg-yellow-100 rounded text-sm">
                              <div className="text-medium text-gray-700">Estimation Mode</div>
                              <div className="mt-1">
                                <select
                                  value={it.estimation_mode || 'auto'}
                                  onChange={(e) => handleEditToggleEstimationMode(it.id, e.target.value)}
                                  className="w-full border rounded p-1 text-sm text-gray-700 bg-white font-bold"
                                >
                                  <option value="auto">Auto</option>
                                  <option value="manual">Manual</option>
                                </select>
                              </div>
                            </div>
                            <div className="p-3 bg-green-100 rounded text-sm">
                              <div className="text-sm text-gray-700">Estimated Total</div>
                              {it.estimation_mode === 'manual' ? (
                                <div className="mt-2">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={it.manual_estimated_total ?? ''}
                                    onChange={(e) => handleEditManualTotalChange(it.id, e.target.value.replace(/[^0-9]/g, ''))}
                                    className="w-full border rounded p-1 text-sm font-bold"
                                    placeholder="Enter amount"
                                  />
                                </div>
                              ) : (
                                <div className="p-2 text-sm font-bold text-gray-700">₱{rowSubtotal.toLocaleString()}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-6 bg-gray-50 rounded-3xl p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold">Measurements</h3>
                      <p className="text-sm text-gray-500">Review item data from this inspection.</p>
                    </div>
                    <div className="text-right text-sm text-gray-600">
                      Total Area: {computeEditTotals().totalArea.toLocaleString()} sq ft
                    </div>
                  </div>
                  <div className="space-y-3">
                    {(editInspection.items || []).map((item, idx) => (
                      <div key={idx} className="rounded-2xl border bg-white p-4">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="font-semibold text-gray-700">{item.name || item.product_id?.name || 'Item'}</div>
                            <div className="text-sm text-gray-500">Qty: {item.quantity || 1}</div>
                          </div>
                          <div className="text-sm text-gray-500">
                            Area: {(Number(item.area) || 0).toLocaleString()} sq ft
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center gap-3 mt-8">
                  <div className="text-lg font-bold">
                    Estimated Total: <span className="text-red-600">₱{computeEditTotals().totalEstimate.toLocaleString()}</span>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setEditInspection(null)}
                      className="px-6 py-3 bg-gray-200 rounded-xl"
                      disabled={savingEdit}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveEdit}
                      className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700"
                      disabled={savingEdit}
                    >
                      {savingEdit ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

export default SiteInspection;
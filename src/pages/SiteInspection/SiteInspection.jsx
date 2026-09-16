import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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

import { getAdminOrders, getAdminOrder, generateContract, updateOrderInspection, updateOrderStatus, createInspection, sendWalkInApprovalEmail } from "@/api/orders";
import { getProducts } from "@/api/products";
import { searchCustomers } from "@/api/users";
import { uploadFiles } from "@/api/uploads";
import Sidebar from "../../components/layout/Sidebar";
import Navbar from "../../components/layout/Navbar";
import ContractModal from "../../components/ContractModal";
import { formatDateToMMDDYYYY, formatDateTimeToMMDDYYYY } from "@/lib/dateUtils";
import { useAuth } from "@/contexts/AuthContext";
import { recordActivity } from "@/lib/activityLog";

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
    { id: Date.now() + Math.random(), product_id: "", name: "", width: 1, height: 1, qty: 1, unit_price: 0, area: 0, unit: "sqft", estimation_mode: "auto" },
  ],
  payment_terms: "",
  estimation_mode: "auto",
  // Walk-in customer fields
  signed_contract_file: null,
  contract_number: "",
  contract_signed_date: new Date().toISOString().split("T")[0],
});

const generateTrackingId = () => {
  const year = new Date().getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `ACGC-TRK-${year}-${random}`;
};

const SITE_INSPECTION_STATUS = "site_inspection";
const PENDING_CONTRACT_STATUSES = new Set(["", "pending"]);
const CONTRACT_STAGE_STATUSES = new Set([
  "contract_created",
  "contract_sent",
  "contract_accepted",
  "contract_declined",
  "in_transaction",
  "processing",
  "cutting",
  "fabrication",
  "installation_scheduling",
  "installation",
  "completed",
  "cancelled",
]);

const normalizeWorkflowValue = (value) =>
  (value || "").toString().trim().toLowerCase();

const isSiteInspectionVisible = (order) => {
  if (!order) return false;

  const status = normalizeWorkflowValue(order.status);
  const contractStatus = normalizeWorkflowValue(order.contract_status);

  if (status !== SITE_INSPECTION_STATUS) return false;
  if (CONTRACT_STAGE_STATUSES.has(status)) return false;
  if (!PENDING_CONTRACT_STATUSES.has(contractStatus)) return false;
  if (order.contract_terms || order.contract_amount) return false;

  return true;
};

function SiteInspection() {
  const { user } = useAuth();
  const navigate = useNavigate();
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
  const [currentPage, setCurrentPage] = useState(1);
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
  const [showContractModal, setShowContractModal] = useState(false);
  const [contractData, setContractData] = useState(null);
  const [contractInspection, setContractInspection] = useState(null);
  const [uploadingContractFile, setUploadingContractFile] = useState(false);
  const [contractUploadError, setContractUploadError] = useState("");
  
  const today = new Date().toISOString().split("T")[0];
  const pageSize = 8;

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, cancelledInspections.length, inspections.length]);

  const fetchSiteInspections = async () => {
    setInspectionsLoading(true);
    try {
      const [siteResp, cancelledResp] = await Promise.all([
        getAdminOrders({ status: "site_inspection" }),
        getAdminOrders({ status: "cancelled" }),
      ]);
      setInspections((siteResp.orders || []).filter(isSiteInspectionVisible));
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
    setUploadingContractFile(false);
    setContractUploadError("");
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

    // Walk-in customer validation
    if (payload.order_type === "walk_in_customer" && !payload.signed_contract_file) {
      nextErrors.signed_contract_file = "Signed contract is required for walk-in customers.";
    }

    const itemErrors = payload.items?.map((item) => {
      const rowErrors = {};
      const normalizedProductId = normalizeProductId(item.product_id);
      if (!normalizedProductId) rowErrors.product_id = "Select a product.";
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

  const getEditItemFromOrderItem = (item) => {
    const normalizedProductId = normalizeProductId(item.product_id || item._id);
    const selectedProduct = products.find((p) => String(p._id || p.id) === normalizedProductId) || null;
    const quantity = item.quantity !== undefined && item.quantity !== null
      ? Number(item.quantity)
      : item.qty !== undefined && item.qty !== null
        ? Number(item.qty)
        : 1;
    const providedWidth = item.width !== undefined && item.width !== null ? Number(item.width) : 0;
    const providedHeight = item.height !== undefined && item.height !== null ? Number(item.height) : 0;
    const widthValue = providedWidth > 0 ? providedWidth : Number(selectedProduct?.width || 0);
    const heightValue = providedHeight > 0 ? providedHeight : Number(selectedProduct?.height || 0);
    const areaValue = item.area !== undefined && item.area !== null && Number(item.area) > 0
      ? Number(item.area)
      : Math.round(((widthValue * heightValue * quantity) / 144) * 100) / 100;
    const productUnitPrice = deriveUnitPriceForPayload({
      ...item,
      product_id: normalizedProductId,
      unit_price: item.unit_price,
    });
    const unitPriceValue = item.unit_price !== undefined && item.unit_price !== null && Number(item.unit_price) > 0
      ? Number(item.unit_price)
      : productUnitPrice;
    const estimationMode = item.is_estimate ? (item.estimation_mode || "auto") : "auto";

    return {
      ...item,
      id: item.id || item._id || `${Date.now()}-${Math.random()}`,
      product_id: normalizedProductId,
      name: item.name || selectedProduct?.name || "",
      qty: quantity,
      quantity,
      width: widthValue ? String(widthValue) : "",
      height: heightValue ? String(heightValue) : "",
      area: areaValue,
      unit_price: unitPriceValue,
      unit: item.unit || selectedProduct?.unit || "sqft",
      estimation_mode: estimationMode,
      manual_estimated_total: item.manual_estimated_total ?? (estimationMode === "manual" ? String(item.estimated_price || "") : ""),
      category: selectedProduct?.category || item.category || item.product_type || "",
      product_type: selectedProduct?.product_type || item.product_type || "",
      base_price: selectedProduct?.base_price || item.base_price || 0,
      price_per_sqft: selectedProduct?.price_per_sqft || item.price_per_sqft || 0,
      price_per_blade: selectedProduct?.price_per_blade || item.price_per_blade || 0,
      customization_fee: selectedProduct?.customization_fee || item.customization_fee || 0,
      variant: selectedProduct?.variant || item.variant || "",
    };
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
    const basePayload = {
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
      inspection_date: payload.inspection_date,
    };

    // Add walk-in customer specific fields
    if (payload.order_type === "walk_in_customer") {
      const contractFileValue = payload.signed_contract_file;
      basePayload.signed_contract_url =
        typeof contractFileValue === "string"
          ? contractFileValue
          : contractFileValue?.url || "";
      basePayload.contract_number = payload.contract_number || "";
      basePayload.contract_signed_date = payload.contract_signed_date || null;
    }

    return basePayload;
  };

  const handleSignedContractUpload = async (files) => {
    if (!files || files.length === 0) {
      setContractUploadError("Please select a file");
      return;
    }

    const file = files[0];
    const allowedExtensions = [".pdf", ".jpg", ".jpeg", ".png"];
    const fileExtension = "." + file.name.split(".").pop().toLowerCase();

    if (!allowedExtensions.includes(fileExtension)) {
      setContractUploadError("Only PDF, JPG, and PNG files are allowed");
      return;
    }

    const maxFileSize = 10 * 1024 * 1024; // 10 MB
    if (file.size > maxFileSize) {
      setContractUploadError("File size must be less than 10 MB");
      return;
    }

    setUploadingContractFile(true);
    setContractUploadError("");

    try {
      const uploadResp = await uploadFiles([file]);
      if (uploadResp.success && uploadResp.files && uploadResp.files.length > 0) {
        const uploadedFile = uploadResp.files[0];
        const uploadedFileUrl = typeof uploadedFile === "string" ? uploadedFile : uploadedFile?.url || "";
        setNewInspection((prev) => ({ ...prev, signed_contract_file: uploadedFileUrl }));
        toast.success("Contract file uploaded successfully");
      } else {
        setContractUploadError("Failed to upload contract file");
      }
    } catch (error) {
      console.error("Contract upload error:", error);
      setContractUploadError(error.message || "Failed to upload contract file");
    } finally {
      setUploadingContractFile(false);
    }
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
    setNewInspection((prev) => {
      if (field === "order_type") {
        if (value === "walk_in_customer") {
          return {
            ...prev,
            order_type: value,
            contract_number: prev.contract_number || generateTrackingId(),
          };
        }

        return {
          ...prev,
          order_type: value,
          contract_number: "",
        };
      }

      return { ...prev, [field]: value };
    });
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
    const normalizedProductId = normalizeProductId(productId);
    const selectedProduct = products.find((product) => String(product._id || product.id) === normalizedProductId);
    setNewInspection((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id !== id) return item;
        const updated = {
          ...item,
          product_id: normalizedProductId,
          name: selectedProduct?.name || item.name || "",
          unit_price: selectedProduct?.unit_price || item.unit_price || 0,
          unit: selectedProduct?.unit || item.unit || "sqft",
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
    const normalizedProductId = normalizeProductId(productId);
    const selectedProduct = products.find((product) => String(product._id || product.id) === normalizedProductId);
    setEditInspection((prev) => ({
      ...prev,
      items: (prev.items || []).map((item) => {
        if (item.id !== id) return item;
        const updated = {
          ...item,
          product_id: normalizedProductId,
          name: selectedProduct?.name || item.name || "",
          unit_price: selectedProduct?.unit_price || item.unit_price || 0,
          unit: selectedProduct?.unit || item.unit || "sqft",
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
        { id: Date.now() + Math.random(), product_id: "", name: "", width: 1, height: 1, qty: 1, area: 0, unit: "sqft", unit_price: 0, estimation_mode: "auto" },
      ],
    }));
  };

  const addEditItemRow = () => {
    setEditInspection((prev) => ({
      ...prev,
      items: [
        ...(prev.items || []),
        { id: Date.now() + Math.random(), product_id: "", name: "", width: 1, height: 1, qty: 1, area: 0, unit: "sqft", unit_price: 0, estimation_mode: "auto", manual_estimated_total: "" },
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
    // If navigated with ?view=orderId, open that inspection
    const params = new URLSearchParams(window.location.search || "");
    const viewId = params.get("view");
    if (viewId) {
      (async () => {
        try {
          const res = await getAdminOrder(viewId);
          if (res && res.order) setViewInspection(res.order);
        } catch (err) {
          console.error("Failed to load order for view param", err);
        }
      })();
    }
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
      const createResp = await createInspection(payload);
      recordActivity(user, `Created site inspection for ${newInspection.customerName || "customer"}.`, "Site Inspection");
      toast.success("Inspection created");
      
      // Send approval email for walk-in customers
      if (newInspection.order_type === "walk_in_customer" && createResp.order?._id) {
        try {
          await sendWalkInApprovalEmail(createResp.order._id, {
            customerName: newInspection.customerName,
            customerEmail: newInspection.customerEmail,
            contractUrl: newInspection.signed_contract_file,
          });
          recordActivity(user, `Sent walk-in approval email for ${newInspection.customerName || "customer"}.`, "Site Inspection");
          toast.success("Approval email sent to customer");
        } catch (emailError) {
          console.error("Failed to send approval email:", emailError);
          toast("Inspection created, but email sending failed. You can send it manually.", {
            icon: "⚠️",
          });
        }
      }
      
      closeNewInspectionModal();
      await fetchSiteInspections();
      if (newInspection.order_type === "walk_in_customer") {
        navigate("/transactions", { state: { activeTable: "receipts" } });
      }
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

  const validateContractOrder = (order) => {
    const errors = [];
    const customerName = order.customer_name || `${order.customer?.first_name || ""} ${order.customer?.last_name || ""}`.trim();
    if (!customerName) errors.push("Customer name is required.");
    if (!order.customer_email && !order.customer?.email) errors.push("Customer email is required.");
    if (!order.customer_phone && !order.customer?.phone) errors.push("Customer contact number is required.");
    if (!order.shipping_address) errors.push("Order shipping address is required.");
    if (!Array.isArray(order.items) || order.items.length === 0) errors.push("Order must contain at least one product.");

    if (Array.isArray(order.items)) {
      order.items.forEach((item, index) => {
        if (!item.name && !item.product_id?.name) {
          errors.push(`Product at row ${index + 1} must have a name.`);
        }
        if (!item.unit_price && item.unit_price !== 0) {
          errors.push(`Product at row ${index + 1} must have a unit price.`);
        }
        if (!item.quantity || item.quantity < 1) {
          errors.push(`Product at row ${index + 1} must have a quantity of at least 1.`);
        }
      });
    }

    const calculatedTotal = (order.items || []).reduce((sum, item) => {
      const unitPrice = Number(item.unit_price) || 0;
      const quantity = Number(item.quantity) || 1;
      return sum + unitPrice * quantity;
    }, 0);

    if (calculatedTotal <= 0) {
      errors.push("Calculated product total must be greater than zero.");
    }

    return errors;
  };

  const hasValidInspectionDate = (order) => {
    if (!order?.inspection_date) return false;
    const inspectionDate = new Date(order.inspection_date);
    return !Number.isNaN(inspectionDate.getTime());
  };

  const generateContractData = (order) => {
    if (!order) return null;

    const customerName = order.customer_name || `${order.customer?.first_name || ""} ${order.customer?.last_name || ""}`.trim() || "Customer";
    const customerEmail = order.customer_email || order.customer?.email || "N/A";
    const customerPhone = order.customer_phone || order.customer?.phone || "N/A";
    const customerType = order.order_type === "walk_in_customer" ? "Walk-in Customer" : "Online Customer";
    const orderNumber = order.tracking || `ORD-${String(order._id || "").slice(-8).toUpperCase()}`;
    const orderDate = order.createdAt ? formatDateToMMDDYYYY(order.createdAt) : "N/A";
    const siteInspectionDate = order.inspection_date ? formatDateToMMDDYYYY(order.inspection_date) : "TBD";
    const projectLocation = order.shipping_address || "N/A";
    const paymentTerms = order.payment_terms || "Standard payment terms apply.";
    const contractTerms = order.contract_terms || "The terms and conditions outlined by ACGC Glass & Aluminum Services apply to this agreement.";
    const totalProjectCost = Number(order.contract_amount || order.total_amount || 0);
    const downPayment = Math.round((totalProjectCost * 0.5) * 100) / 100;
    const contractNumber = `ACGC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
    const trackingNumber = `TRK-${order.tracking || (order._id?.slice(-4).toUpperCase() || Math.random().toString(36).substring(2, 8).toUpperCase())}`;
    const contractDate = formatDateToMMDDYYYY(new Date());

    const items = (order.items || []).map((item, index) => {
      const itemName = item.name || item.product_id?.name || `Item ${index + 1}`;
      const quantity = Number(item.quantity) || 1;
      const unitPrice = Number(item.unit_price) || 0;
      const width = Number(item.width) || 0;
      const height = Number(item.height) || 0;
      const area = Number(item.area) || Math.round(((width * height) / 144) * 100) / 100;
      const amount = item.is_estimate && Number(item.estimated_price) ? Number(item.estimated_price) : quantity * unitPrice;
      return {
        name: itemName,
        quantity,
        width,
        height,
        area,
        unitPrice,
        amount,
        category: item.product_id?.category || item.product_type || "N/A",
      };
    });

    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);

    return {
      customerName,
      customerType,
      customerEmail,
      customerPhone,
      orderNumber,
      orderDate,
      siteInspectionDate,
      projectLocation,
      totalProjectCost,
      downPayment,
      paymentTerms,
      contractTerms,
      contractNumber,
      trackingNumber,
      contractDate,
      status: (order.contract_status || "pending").toUpperCase(),
      subtotal,
      items,
      orderStatus: order.status,
    };
  };

  const handleGenerateContract = async (orderId) => {
    if (!orderId) return;
    try {
      setGeneratingId(orderId);

      const { order } = await getAdminOrder(orderId);
      if (!order) {
        toast.error("Order not found");
        return;
      }

      if (!hasValidInspectionDate(order)) {
        toast.error("A Site Inspection Date must be scheduled before a contract can be generated.");
        return;
      }

      const validationErrors = validateContractOrder(order);
      if (validationErrors.length > 0) {
        toast.error(validationErrors.join(" "));
        return;
      }

      const contract = generateContractData(order);
      if (!contract) {
        toast.error("Unable to build contract data.");
        return;
      }

      const contractResponse = await generateContract(orderId, {
        contract_terms: order.contract_terms || contract.contractTerms,
        contract_amount: order.contract_amount || contract.totalProjectCost,
      });
      recordActivity(user, `Generated contract for order ${orderId}.`, "Site Inspection");

      const savedOrder = contractResponse?.order || {};
      const generatedOrder = {
        ...order,
        ...savedOrder,
        customer: typeof savedOrder.customer === "object" ? savedOrder.customer : order.customer,
        status: savedOrder.status || "contract_sent",
        contract_status: savedOrder.contract_status || "sent",
        contract_terms: savedOrder.contract_terms || order.contract_terms || contract.contractTerms,
        contract_amount: savedOrder.contract_amount || order.contract_amount || contract.totalProjectCost,
      };
      const generatedContract = generateContractData(generatedOrder) || contract;

      setInspections((prev) => prev.filter((inspection) => (inspection._id || inspection.id) !== orderId));
      setViewInspection((prev) => ((prev?._id || prev?.id) === orderId ? null : prev));
      setEditInspection((prev) => (prev?.id === orderId ? null : prev));
      setContractInspection(generatedOrder);
      setContractData(generatedContract);
      setShowContractModal(true);
      toast.success("Contract generated successfully!");
    } catch (err) {
      console.error("Generate contract failed", err);
      toast.error(err?.data?.message || err?.message || "Failed to generate contract.");
    } finally {
      setGeneratingId(null);
    }
  };

  const handleEdit = (orderId) => {
    const inspection = inspections.find((i) => (i._id || i.id) === orderId);
    if (inspection) {
      // Try to extract customer name from multiple sources
      let customerName = "";
      if (inspection.customer?.first_name || inspection.customer?.last_name) {
        customerName = `${inspection.customer.first_name || ""} ${inspection.customer.last_name || ""}`.trim();
      } else if (inspection.customer_name) {
        customerName = inspection.customer_name;
      } else if (inspection.customer?.email) {
        // Fallback: use email if no name available
        customerName = inspection.customer.email;
      } else if (inspection.customer_email) {
        customerName = inspection.customer_email;
      }
      
      const phone = inspection.customer?.phone || inspection.customer_phone || "";
      const customerEmail = inspection.customer?.email || inspection.customer_email || "";
const siteAddress = inspection.shipping_address || inspection.customer?.street_address || formatCustomerAddress(inspection.customer) || "";
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
        items: (inspection.items || []).map((item) => getEditItemFromOrderItem(item)),        customerId: inspection.customer?._id || null,
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
      recordActivity(user, `Cancelled site inspection ${orderId}.`, "Site Inspection");
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
  const [contractConfirm, setContractConfirm] = useState({ open: false, id: null });

  const requestRestore = (orderId) => {
    setRestoreConfirm({ open: true, id: orderId });
  };

  const requestGenerateContract = (orderId) => {
    setContractConfirm({ open: true, id: orderId });
  };

  const closeRestoreModal = () => setRestoreConfirm({ open: false, id: null });
  const closeContractModal = () => setContractConfirm({ open: false, id: null });

  const handleConfirmRestore = async () => {
    const orderId = restoreConfirm.id;
    setRestoreConfirm({ open: false, id: null });
    await handleRestore(orderId);
  };

  const handleConfirmGenerateContract = async () => {
    const orderId = contractConfirm.id;
    setContractConfirm({ open: false, id: null });
    await handleGenerateContract(orderId);
  };

  const handleRestore = async (orderId) => {
    if (!orderId) return;
    try {
      setRestoringId(orderId);
      const res = await updateOrderStatus(orderId, { status: "site_inspection" });
      recordActivity(user, `Restored site inspection ${orderId}.`, "Site Inspection");
      if (res && res.order) {
        setCancelledInspections((prev) => prev.filter((i) => (i._id || i.id) !== orderId));
        if (isSiteInspectionVisible(res.order)) {
          setInspections((prev) => [res.order, ...prev]);
        }
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
        customer_name: editInspection.customerName || undefined,
        customer_email: editInspection.customerEmail || undefined,
        customer_phone: editInspection.phone || undefined,
        inspection_date: editInspection.inspection_date || undefined,
        inspection_notes: editInspection.inspection_notes || undefined,
        issues_found: editInspection.issues_found || undefined,
        inspection_status: editInspection.inspection_date ? "scheduled" : editInspection.inspection_status || undefined,
        shipping_address: editInspection.siteAddress || undefined,
        payment_terms: editInspection.payment_terms || undefined,
        items: (editInspection.items || []).map((item) => {
          const normalizedProductId = normalizeProductId(item.product_id);
          // Preserve original product_id if normalization fails; only use null as last resort
          const finalProductId = normalizedProductId || item.product_id || item._id || null;
          return {
            product_id: finalProductId,
            name: item.name || "",
            quantity: Number(item.qty) || Number(item.quantity) || 1,
            unit_price: deriveUnitPriceForPayload(item),
            width: Number(item.width) || 0,
            height: Number(item.height) || 0,
            area: Number(item.area) || 0,
            estimated_price: item.estimation_mode === "manual"
              ? Number(item.manual_estimated_total) || calculateRowSubtotal(item)
              : calculateRowSubtotal(item),
            is_estimate: true,
            unit: item.unit || "sqft",
          };
        }),
        total_amount: computeEditTotals().totalEstimate,
      };

      // Validate that all items have product_id before sending
      const itemsWithoutProductId = payload.items.filter((item) => !item.product_id || !item.name);
      if (itemsWithoutProductId.length > 0) {
        const errorMsg = itemsWithoutProductId
          .map((item, idx) => `Row ${idx + 1}: ${!item.product_id ? "Missing product" : "Missing name"}`)
          .join("; ");
        toast.error(`Cannot save inspection: ${errorMsg}`);
        setSavingEdit(false);
        return;
      }

      const res = await updateOrderInspection(editInspection.id, payload);
      recordActivity(user, `Updated site inspection ${editInspection.id}.`, "Site Inspection");
      toast.success("Inspection saved");
      // update local inspections list with returned order
      if (res && res.order) {
        setInspections((prev) => {
          const next = prev.map((i) => ((i._id || i.id) === editInspection.id ? res.order : i));
          return next.filter(isSiteInspectionVisible);
        });
      }
      setEditInspection(null);
    } catch (err) {
      console.error("Failed to save inspection edit", err, err?.data);
      // Extract detailed error message from backend response
      const details = err?.data?.details;
      const detailMessage = Array.isArray(details)
        ? details.filter(Boolean).join("; ")
        : typeof details === "string"
        ? details
        : null;
      const errorMessage = detailMessage || err?.data?.message || err?.message || "Failed to save inspection.";
      window.alert(errorMessage);
    } finally {
      setSavingEdit(false);
    }
  };

  useEffect(() => {
    localStorage.setItem("sidebarOpen", JSON.stringify(isSidebarOpen));
  }, [isSidebarOpen]);

  const sourceList = activeTab === "cancelled" ? cancelledInspections : inspections.filter(isSiteInspectionVisible);
  const filteredList = filterInspections(sourceList);
  const totalPages = Math.max(1, Math.ceil(filteredList.length / pageSize));
  const currentPageIndex = Math.min(Math.max(currentPage, 1), totalPages);
  const paginatedList = filteredList.slice((currentPageIndex - 1) * pageSize, currentPageIndex * pageSize);
  const visibleRecordStart = filteredList.length === 0 ? 0 : (currentPageIndex - 1) * pageSize + 1;
  const visibleRecordEnd = Math.min(currentPageIndex * pageSize, filteredList.length);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      <Sidebar isOpen={isSidebarOpen} />

      <div className="flex-1 min-h-0 flex flex-col">
        <Navbar
          toggleSidebar={() =>
            setIsSidebarOpen(!isSidebarOpen)
          }
        />

        <main className="flex-1 min-h-0 overflow-y-auto p-6">

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

          {contractConfirm.open && (
            <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
              <div className="bg-white w-full max-w-md rounded-3xl p-6">
                <h3 className="text-xl font-bold mb-4">Generate Contract</h3>
                <p className="text-gray-600 mb-6">A contract will be generated for this order. Do you want to continue?</p>

                <div className="flex justify-end gap-3">
                  <button onClick={closeContractModal} className="px-4 py-2 bg-gray-200 rounded-xl">Cancel</button>
                  <button
                    onClick={handleConfirmGenerateContract}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl"
                    disabled={generatingId === contractConfirm.id}
                  >
                    {generatingId === contractConfirm.id ? 'Generating...' : 'Confirm'}
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

                    <th className="w-16 p-4 text-center">No.</th>
                    <th className="p-4 text-left">Client</th>
                    <th className="p-4 text-left">Phone</th>
                    <th className="p-4 text-left">Product</th>
                    <th className="p-4 text-left">Client Type</th>
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
                      <td colSpan={10} className="p-8 text-center text-slate-500">
                        Loading inspections...
                      </td>
                    </tr>
                  ) : !filteredList.length ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-500">
                        No records in this tab.
                      </td>
                    </tr>
                  ) : (
                    paginatedList.map((inspection, index) => {
                      const clientName = inspection.customer
                        ? `${inspection.customer.first_name || ""} ${inspection.customer.last_name || ""}`.trim() || inspection.customer.email || inspection.customer_name || "Customer"
                        : inspection.customer_name || "Customer";
                      const phone = inspection.customer?.phone || inspection.customer_phone || "—";
                      const productName = inspection.items?.[0]?.name || inspection.items?.[0]?.product_id?.name || "Project Item";
                      const orderType = inspection.order_type === "walk_in_customer" ? "Walk-in" : "Online";
                      const address = inspection.shipping_address || "—";
                      const date = inspection.createdAt ? formatDateToMMDDYYYY(inspection.createdAt) : "—";
                      const statusLabel = inspection.inspection_status
                        ? inspection.inspection_status
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (c) => c.toUpperCase())
                        : inspection.status === "site_inspection"
                          ? "Site Inspection"
                          : inspection.status?.replace(/_/g, " ") || "Pending";
                      const estimatedCost = inspection.total_amount ? `₱${inspection.total_amount.toLocaleString()}` : "—";

                      return (
                        <tr
                          key={inspection._id || inspection.id}
                          className="border-t hover:bg-gray-50"
                        >
                          <td className="w-16 p-4 text-center font-semibold text-slate-600">
                            {(currentPageIndex - 1) * pageSize + index + 1}
                          </td>
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
                          <td className="p-4 font-semibold text-green-500">{estimatedCost}</td>
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
                              {activeTab !== 'cancelled' && hasValidInspectionDate(inspection) && (
                                <button
                                  title="Generate Contract"
                                  aria-label="Generate contract"
                                  className="text-emerald-600 hover:text-emerald-800"
                                  onClick={() => requestGenerateContract(inspection._id || inspection.id)}
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
                  )}
                </tbody>

              </table>

            </div>

            <div className="flex flex-col gap-3 justify-center items-center p-4 border-t bg-gray-50 sm:flex-row">
              <div className="text-sm text-slate-600">
                Showing {visibleRecordStart} - {visibleRecordEnd} of {filteredList.length} records
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage <= 1}
                  className="px-4 py-2 rounded-lg border bg-white text-slate-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                  const startPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
                  const pageNumber = startPage + idx;
                  return (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => setCurrentPage(pageNumber)}
                      className={`w-10 h-10 rounded-lg ${pageNumber === currentPage ? 'bg-red-600 text-white' : 'border bg-white text-slate-700 hover:bg-gray-100'}`}
                    >
                      {pageNumber}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage >= totalPages}
                  className="px-4 py-2 rounded-lg border bg-white text-slate-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>

          </div>

          {/* MODAL */}

          {showModal && (

            <div className="fixed inset-0 bg-black/50 flex justify-center items-start pt-10 z-50">

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
                      <option value="">Select Payment Terms</option>
                      <option value="50%_down_payment">50% Down Payment</option>
                      <option value="full_payment">Full Payment</option>
                    </select>
                  </div>
                </div>

                {/* Walk-in Customer Fields */}
                {newInspection.order_type === "walk_in_customer" && (
                  <div className="mt-6 bg-blue-50 rounded-2xl p-4">
                    <h3 className="font-semibold text-blue-900 mb-4">Walk-in Customer - Contract Information</h3>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="md:col-span-2">
                        <label className="block font-medium text-gray-700 mb-2">
                          Signed Contract / Acceptance Form <span className="text-red-600">*</span>
                        </label>
                        <label className="block border-2 border-dashed rounded-xl p-4 text-center cursor-pointer hover:bg-gray-50">
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => handleSignedContractUpload(e.target.files)}
                            className="hidden"
                            disabled={uploadingContractFile}
                          />
                          {uploadingContractFile ? (
                            <p className="text-gray-600">Uploading...</p>
                          ) : typeof newInspection.signed_contract_file === "string" && newInspection.signed_contract_file.trim() ? (
                            <div>
                              <p className="text-green-600 font-semibold">✓ File uploaded</p>
                              <p className="text-sm text-gray-600 mt-1">{newInspection.signed_contract_file.split("/").pop()}</p>
                            </div>
                          ) : (
                            <div>
                              <p className="text-gray-700">📄 Upload PDF, JPG, or PNG</p>
                              <p className="text-sm text-gray-600">Max 10 MB</p>
                            </div>
                          )}
                        </label>
                        {contractUploadError && <p className="mt-2 text-sm text-red-600">{contractUploadError}</p>}
                        {errors.signed_contract_file && <p className="mt-2 text-sm text-red-600">{errors.signed_contract_file}</p>}
                      </div>

                      <div>
                        <label className="block font-medium text-gray-700 mb-2">Date Signed</label>
                        <input
                          type="date"
                          className="border rounded-xl p-3 w-full"
                          value={newInspection.contract_signed_date}
                          onChange={(e) => handleInspectionFieldChange("contract_signed_date", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}

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
                          <div className="col-span-3 relative">
                            <button
                              type="button"
                              onClick={() => {
                                const current = document.getElementById(`product-menu-${it.id}`);
                                if (current?.classList.contains('hidden')) {
                                  current.classList.remove('hidden');
                                } else if (current) {
                                  current.classList.add('hidden');
                                }
                              }}
                              className="w-full border rounded p-2 text-left bg-white hover:bg-gray-50 flex justify-between items-center"
                            >
                              <span>{products.find(p => String(p._id || p.id) === it.product_id)?.name || 'Select product'}</span>
                              <span>▼</span>
                            </button>
                            <div
                              id={`product-menu-${it.id}`}
                              className="hidden absolute top-full left-0 right-0 mt-1 border rounded bg-white shadow-lg z-[100] max-h-48 overflow-y-auto"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  handleItemProductChange(it.id, '');
                                  document.getElementById(`product-menu-${it.id}`)?.classList.add('hidden');
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-gray-100"
                              >
                                Select product
                              </button>
                              {products.map((product) => (
                                <button
                                  key={String(product._id || product.id)}
                                  type="button"
                                  onClick={() => {
                                    handleItemProductChange(it.id, String(product._id || product.id));
                                    document.getElementById(`product-menu-${it.id}`)?.classList.add('hidden');
                                  }}
                                  className="w-full text-left px-3 py-2 hover:bg-gray-100"
                                >
                                  {product.name}
                                </button>
                              ))}
                            </div>
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
            <div className="fixed inset-0 bg-black/50 flex justify-center items-start pt-10 z-50">
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
                          <span className="font-semibold">Created:</span> {viewInspection.createdAt ? formatDateTimeToMMDDYYYY(viewInspection.createdAt) : '—'}
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
                      <p>{viewInspection.inspection_date ? formatDateToMMDDYYYY(viewInspection.inspection_date) : '—'}</p>
                    </div>
                    <div>
                      <h3 className="font-semibold">Status</h3>
                      <p>{viewInspection.inspection_status || viewInspection.status || '—'}</p>
                    </div>
                  </div>

                  {/* Acceptance Method Badge */}
                  <div className="bg-gray-50 rounded-2xl p-4">
                    <h3 className="font-semibold mb-2">Acceptance Method</h3>
                    {viewInspection.acceptance_method === 'walk_in_signed_contract' ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-3 h-3 bg-orange-500 rounded-full"></span>
                        <span className="font-medium text-orange-700">Walk-in Signed Contract</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-3 h-3 bg-green-500 rounded-full"></span>
                        <span className="font-medium text-green-700">Online Acceptance</span>
                      </div>
                    )}
                  </div>

                  {/* Walk-in Specific Details */}
                  {viewInspection.acceptance_method === 'walk_in_signed_contract' && (
                    <div className="bg-blue-50 rounded-2xl p-4">
                      <h3 className="font-semibold text-blue-900 mb-3">Contract Details</h3>
                      <div className="space-y-2 text-sm">
                        {viewInspection.contract_number && (
                          <div>
                            <span className="font-semibold">Contract Number: </span>
                            {viewInspection.contract_number}
                          </div>
                        )}
                        {viewInspection.contract_signed_date && (
                          <div>
                            <span className="font-semibold">Date Signed: </span>
                            {formatDateToMMDDYYYY(viewInspection.contract_signed_date)}
                          </div>
                        )}
                        {viewInspection.signed_contract_url && (
                          <div>
                            <span className="font-semibold">Signed Contract: </span>
                            <a href={viewInspection.signed_contract_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                              View/Download
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* EDIT INSPECTION MODAL */}
          {editInspection && (
            <div className="fixed inset-0 bg-black/50 flex justify-center items-start pt-10 z-50">
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
                      <option value="">Select Payment Terms</option>
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
                          <div className="col-span-3 relative">
                            <button
                              type="button"
                              onClick={() => {
                                const current = document.getElementById(`edit-product-menu-${it.id}`);
                                if (current?.classList.contains('hidden')) {
                                  current.classList.remove('hidden');
                                } else if (current) {
                                  current.classList.add('hidden');
                                }
                              }}
                              className="w-full border rounded p-2 text-left bg-white hover:bg-gray-50 flex justify-between items-center"
                            >
                              <span>{products.find(p => String(p._id || p.id) === it.product_id)?.name || 'Select product'}</span>
                              <span>▼</span>
                            </button>
                            <div
                              id={`edit-product-menu-${it.id}`}
                              className="hidden absolute top-full left-0 right-0 mt-1 border rounded bg-white shadow-lg z-[100] max-h-48 overflow-y-auto"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  handleEditItemProductChange(it.id, '');
                                  document.getElementById(`edit-product-menu-${it.id}`)?.classList.add('hidden');
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-gray-100"
                              >
                                Select product
                              </button>
                              {products.map((product) => (
                                <button
                                  key={String(product._id || product.id)}
                                  type="button"
                                  onClick={() => {
                                    handleEditItemProductChange(it.id, String(product._id || product.id));
                                    document.getElementById(`edit-product-menu-${it.id}`)?.classList.add('hidden');
                                  }}
                                  className="w-full text-left px-3 py-2 hover:bg-gray-100"
                                >
                                  {product.name}
                                </button>
                              ))}
                            </div>
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
                    {(editInspection.items || []).map((item, idx) => {
                      const displayProductName = item.name || products.find((p) => String(p._id || p.id) === normalizeProductId(item.product_id))?.name || 'Item';
                      return (
                        <div key={idx} className="rounded-2xl border bg-white p-4">
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                              <div className="font-semibold text-gray-700">{displayProductName}</div>
                              <div className="text-sm text-gray-500">Qty: {item.qty || item.quantity || 1}</div>
                            </div>
                            <div className="text-sm text-gray-500">
                              Area: {(Number(item.area) || 0).toLocaleString()} sq ft
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
                      {savingEdit ? 'Sending to email...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </main>

        {/* Contract Modal */}
        <ContractModal
          isOpen={showContractModal}
          onClose={() => setShowContractModal(false)}
          inspection={contractInspection}
          contractData={contractData}
        />
      </div>
    </div>
  );
}

export default SiteInspection;

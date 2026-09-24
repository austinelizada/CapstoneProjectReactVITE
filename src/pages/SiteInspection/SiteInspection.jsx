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
import { toPng } from "html-to-image";
import jsPDF from "jspdf";

import { getAdminOrders, getAdminOrder, generateContract, updateOrderInspection, updateOrderStatus, createInspection, sendWalkInApprovalEmail } from "@/api/orders";
import { getProducts } from "@/api/products";
import { searchCustomers } from "@/api/users";
import { uploadFiles } from "@/api/uploads";
import Sidebar from "../../components/layout/Sidebar";
import Navbar from "../../components/layout/Navbar";
import AdminPageHeader from "../../components/layout/AdminPageHeader";
import ContractModal from "../../components/ContractModal";
import { formatDateToMMDDYYYY, formatDateTimeToMMDDYYYY } from "@/lib/dateUtils";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminTheme } from "@/contexts/AdminThemeContext";
import { recordActivity } from "@/lib/activityLog";

const getDefaultInspection = () => ({
  customerId: null,
  customerName: "",
  customerEmail: "",
  phone: "",
  productName: "",
  order_type: "online_order",
  siteAddress: "",
  inspection_date: "",
  estimated_installation_date: "",
  notes: "",
  site_notes: "",
  warranty_period: 90,
  has_account_on_website: true,
  downpayment_received: false,
  manual_override: "",
  items: [
    { id: Date.now() + Math.random(), product_id: "", name: "", width: 1, height: 1, qty: 1, unit_price: 0, area: 0, unit: "sqft", estimation_mode: "auto" },
  ],
  payment_terms: "50%_down_payment",
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

const normalizeProductId = (productId) => {
  if (typeof productId === "object" && productId !== null) {
    return String(productId._id || productId.id || productId);
  }
  return productId ? String(productId) : "";
};

export const getEstimatedInstallationDate = (inspection) => (
  inspection?.estimated_installation_date ||
  inspection?.estimated_install_date ||
  inspection?.estimatedInstallationDate ||
  inspection?.installation_date ||
  inspection?.installationDate ||
  inspection?.estimatedInstallDate ||
  inspection?.est_install_date ||
  inspection?.estInstallDate ||
  ""
);

const toApiDate = (value) => {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const createContractPrintClone = (element) => {
  const clone = element.cloneNode(true);
  clone.style.width = `${element.scrollWidth}px`;
  clone.style.height = "auto";
  clone.style.overflow = "visible";
  clone.style.position = "relative";
  clone.style.maxHeight = "none";
  clone.style.maxWidth = "none";

  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.left = "-9999px";
  wrapper.style.top = "0";
  wrapper.style.opacity = "0";
  wrapper.style.pointerEvents = "none";
  wrapper.style.zIndex = "-1";
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  return { wrapper, clone };
};

export const validateInspectionPayload = (payload = {}) => {
  const nextErrors = {};

  if (!payload.customerName?.trim()) nextErrors.customerName = "Client name is required.";
  if (!payload.phone?.trim()) nextErrors.phone = "Phone number is required.";
  if (!payload.siteAddress?.trim()) nextErrors.siteAddress = "Site address is required.";
  if (!payload.inspection_date) nextErrors.inspection_date = "Inspection date is required.";
  if (!payload.estimated_installation_date) nextErrors.estimated_installation_date = "Estimated installation date is required.";
  if (!payload.items || payload.items.length === 0) nextErrors.items = "Add at least one measurement row.";

  // Walk-in customers only need a signed contract when they have a website account.
  if (requiresSignedContractForWalkIn(payload) && !payload.signed_contract_file) {
    nextErrors.signed_contract_file = "Signed contract is required for walk-in customers with a website account.";
  }

  const itemErrors = payload.items?.map((item) => {
    const rowErrors = {};
    const normalizedProductId = normalizeProductId(item.product_id);
    if (!normalizedProductId) rowErrors.product_id = "Select a product.";
    if (!item.name?.trim()) rowErrors.name = "Description is required.";
    if (Number(item.width) <= 0) rowErrors.width = "Width must be greater than zero.";
    if (Number(item.height) <= 0) rowErrors.height = "Height must be greater than zero.";
    if (Number(item.qty) <= 0) rowErrors.qty = "Quantity must be at least 1.";
    return rowErrors;
  }) || [];

  if (itemErrors.some((row) => Object.keys(row).length > 0)) {
    nextErrors.itemErrors = itemErrors;
  }

  return nextErrors;
};

export const requiresSignedContractForWalkIn = (payload = {}) => {
  const isWalkInCustomer = String(payload.order_type || "") === "walk_in_customer";
  const hasWebsiteAccount = payload.has_account_on_website === true;

  return isWalkInCustomer && hasWebsiteAccount;
};

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
  const { darkMode } = useAdminTheme();
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
  const formatCurrency = (value) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value || 0));

  const modalShellClass = darkMode
    ? "border border-slate-700 bg-[#071d2d] text-slate-100 shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
    : "border border-slate-200 bg-white text-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.12)]";
  const modalHeaderClass = darkMode ? "border-b border-slate-700 bg-[#0b2338]" : "border-b border-slate-200 bg-slate-50";
  const modalSectionClass = darkMode ? "border border-slate-700 bg-[#0f2438]" : "border border-slate-200 bg-white";
  const fieldClass = darkMode
    ? "w-full rounded-xl border border-slate-600 bg-[#122d42] px-3 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-red-500"
    : "w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-red-500";
  const lockedFieldClass = darkMode
    ? "w-full cursor-not-allowed rounded-xl border border-slate-600 bg-slate-800 px-3 py-3 text-sm text-slate-300 shadow-inner outline-none placeholder:text-slate-500"
    : "w-full cursor-not-allowed rounded-xl border border-slate-300 bg-slate-200 px-3 py-3 text-sm text-slate-600 shadow-inner outline-none placeholder:text-slate-400";
  const labelClass = darkMode ? "text-slate-200" : "text-slate-700";
  const mutedTextClass = darkMode ? "text-slate-400" : "text-slate-500";
  const statusBadgeClass = darkMode
    ? "flex h-[48px] items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 text-sm font-bold text-amber-200"
    : "flex h-[48px] items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-3 text-sm font-bold text-amber-700";
  const inspectionStatus = newInspection.inspection_date ? {
    label: "Scheduled",
    icon: "✓",
    className: darkMode
      ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : "border border-emerald-200 bg-emerald-50 text-emerald-700",
  } : {
    label: "Needs to be Called",
    icon: "📞",
    className: statusBadgeClass,
  };
  const inputGridClass = darkMode ? "bg-[#122d42]" : "bg-slate-50";
  const footerClass = darkMode ? "border-t border-slate-700 bg-[#0b2338]" : "border-t border-slate-200 bg-slate-50";
  const secondaryButtonClass = darkMode
    ? "rounded-xl border border-slate-600 bg-slate-800 px-5 py-3 text-sm font-bold text-slate-200 transition hover:bg-slate-700"
    : "rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100";
  const primaryButtonClass = darkMode
    ? "rounded-xl bg-red-600 px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-70"
    : "rounded-xl bg-red-600 px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-70";

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
    setNewInspection((prev) => {
      const isClearingSelectedCustomer = Boolean(prev.customerId);
      const isClientNameEmpty = !value.trim();

      return {
        ...prev,
        customerName: value,
        customerEmail: "",
        phone: isClearingSelectedCustomer || isClientNameEmpty ? "" : prev.phone,
        siteAddress: isClearingSelectedCustomer || isClientNameEmpty ? "" : prev.siteAddress,
        order_type: value.trim() ? "walk_in_customer" : "online_order",
        customerId: null,
        has_account_on_website: isClearingSelectedCustomer || isClientNameEmpty ? false : prev.has_account_on_website,
      };
    });
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
      has_account_on_website: true,
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
      has_account_on_website: false,
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
      inspection_notes: payload.notes || payload.site_notes || "",
      site_notes: payload.site_notes || payload.notes || "",
      payment_terms: payload.payment_terms,
      customer_name: payload.customerName,
      customer_phone: payload.phone,
      estimation_mode: "auto",
      inspection_date: toApiDate(payload.inspection_date),
      estimated_installation_date: toApiDate(payload.estimated_installation_date),
      warranty_period: payload.warranty_period || 90,
      has_account_on_website: Boolean(payload.has_account_on_website),
      manual_override: payload.manual_override || "",
      downpayment_received: Boolean(payload.downpayment_received),
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

      const contractEmail = generatedOrder.customer_email || generatedOrder.customer?.email || order.customer_email || order.customer?.email || "";
      if (!contractEmail.trim()) {
        toast("Contract generated, but no customer email was provided.", { icon: "⚠️" });
      }

      setInspections((prev) => prev.filter((inspection) => (inspection._id || inspection.id) !== orderId));
      setViewInspection((prev) => ((prev?._id || prev?.id) === orderId ? null : prev));
      setEditInspection((prev) => (prev?.id === orderId ? null : prev));
      setContractInspection(generatedOrder);
      setContractData(generatedContract);
      setShowContractModal(true);

      if (contractEmail.trim()) {
        try {
          await new Promise((resolve) => setTimeout(resolve, 150));
          const contractElement = document.getElementById("contract-content");
          let contractAttachment;
          if (contractElement) {
            const { wrapper, clone } = createContractPrintClone(contractElement);
            try {
              await new Promise((resolve) => setTimeout(resolve, 100));
              const contractImage = await toPng(clone, {
                cacheBust: true,
                pixelRatio: 2,
                backgroundColor: "#ffffff",
              });
              const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
              const pdfWidth = pdf.internal.pageSize.getWidth();
              const pdfHeight = pdf.internal.pageSize.getHeight();
              const imageProperties = pdf.getImageProperties(contractImage);
              const imageHeight = (imageProperties.height * pdfWidth) / imageProperties.width;
              let heightLeft = imageHeight;
              let position = 0;

              pdf.addImage(contractImage, "PNG", 0, position, pdfWidth, imageHeight);
              heightLeft -= pdfHeight;
              while (heightLeft > 0) {
                position -= pdfHeight;
                pdf.addPage();
                pdf.addImage(contractImage, "PNG", 0, position, pdfWidth, imageHeight);
                heightLeft -= pdfHeight;
              }

              const pdfDataUrl = pdf.output("datauristring");
              contractAttachment = `data:application/pdf;base64,${pdfDataUrl.split(",")[1]}`;
            } finally {
              wrapper.remove();
            }
          }
          await sendWalkInApprovalEmail(orderId, {
            customerName: generatedOrder.customer_name || generatedOrder.customer?.first_name
              ? `${generatedOrder.customer?.first_name || ""} ${generatedOrder.customer?.last_name || ""}`.trim() || generatedOrder.customer_name
              : order.customer_name,
            customerEmail: contractEmail.trim(),
            contractUrl: generatedOrder.signed_contract_url || order.signed_contract_url || "",
            contractAttachment,
          });
          recordActivity(user, `Emailed contract details for order ${orderId}.`, "Site Inspection");
          toast.success("Contract PDF emailed to customer");
        } catch (emailError) {
          console.error("Contract generated but email delivery failed:", emailError);
          toast.error(emailError?.data?.message || "Contract generated, but the email could not be sent.");
        }
      }
      toast.success("Contract generated successfully!");
    } catch (err) {
      console.error("Generate contract failed", err);
      toast.error(err?.data?.message || err?.message || "Failed to generate contract.");
    } finally {
      setGeneratingId(null);
    }
  };

  const normalizeDateInputValue = (value) => {
    if (!value) return "";
    if (value instanceof Date) {
      return value.toISOString().split("T")[0];
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return "";
      const date = new Date(trimmed);
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString().split("T")[0];
      }
      return trimmed.split("T")[0];
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().split("T")[0];
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
        inspection_date: normalizeDateInputValue(inspection.inspection_date),
        estimated_installation_date: normalizeDateInputValue(getEstimatedInstallationDate(inspection)),
        warranty_period: inspection.warranty_period || 90,
        has_account_on_website: Boolean(inspection.has_account_on_website),
        downpayment_received: Boolean(inspection.downpayment_received),
        manual_override: inspection.manual_override || "",
        inspection_notes: inspection.inspection_notes || "",
        issues_found: inspection.issues_found || "",
        inspection_status: inspection.inspection_status || "pending",
        items: (inspection.items || []).map((item) => getEditItemFromOrderItem(item)),
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
        inspection_date: toApiDate(editInspection.inspection_date),
        inspection_notes: editInspection.inspection_notes || undefined,
        issues_found: editInspection.issues_found || undefined,
        inspection_status: editInspection.inspection_date ? "scheduled" : editInspection.inspection_status || undefined,
        estimated_installation_date: toApiDate(editInspection.estimated_installation_date),
        shipping_address: editInspection.siteAddress || undefined,
        payment_terms: editInspection.payment_terms || undefined,
        warranty_period: editInspection.warranty_period || 90,
        has_account_on_website: Boolean(editInspection.has_account_on_website),
        downpayment_received: Boolean(editInspection.downpayment_received),
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
        total_amount: Number(editInspection.manual_override) || computeEditTotals().totalEstimate,
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

      // Walk-in customers without website accounts can still receive the proposal
      // at the email entered in the inspection form.
      if (editInspection.order_type === "walk_in_customer" && editInspection.customerEmail?.trim()) {
        try {
          await sendWalkInApprovalEmail(editInspection.id, {
            customerName: editInspection.customerName,
            customerEmail: editInspection.customerEmail.trim(),
          });
          recordActivity(user, `Sent walk-in approval email for ${editInspection.customerName || "customer"}.`, "Site Inspection");
          toast.success("Contract details emailed to customer");
        } catch (emailError) {
          console.error("Failed to send approval email after edit:", emailError);
          toast.error(emailError?.data?.message || "Inspection saved, but the contract email could not be sent.");
        }
      }

      // update local inspections list with returned order
      if (res && res.order) {
        setInspections((prev) => {
          const next = prev.map((i) => ((i._id || i.id) === editInspection.id ? res.order : i));
          return next.filter(isSiteInspectionVisible);
        });
      }
      await fetchSiteInspections();
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

  const getInspectionProductSummary = (inspection) => {
    const items = Array.isArray(inspection?.items) ? inspection.items : [];

    if (!items.length) return "Project Item";

    const names = items
      .map((item) => item?.name || item?.product_id?.name || item?.product_name || "Unnamed item")
      .filter(Boolean);

    if (items.length === 1) return names[0] || "Project Item";

    const firstName = names[0] || "Project Item";
    const extraCount = items.length - 1;

    return `${firstName} + ${extraCount} more item${extraCount > 1 ? "s" : ""}`;
  };

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

          <AdminPageHeader
            title="Site Inspection Management"
            description="Manage all site inspections and estimations."
            stats={[
              { label: "Inspections", value: inspections.length, color: "text-blue-200" },
              { label: "Scheduled", value: inspections.filter(hasValidInspectionDate).length, color: "text-emerald-300" },
              { label: "Cancelled", value: cancelledInspections.length, color: "text-red-300" },
            ]}
          />



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
          <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative flex-1">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search inspections..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm text-slate-700 outline-none transition focus:border-red-400 focus:bg-white"
                />
              </div>

              <button
                onClick={() => { resetNewInspectionForm(); setShowModal(true); }}
                className="inline-flex items-center justify-center rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
              >
                <Plus size={18} className="mr-2" />
                New Site Inspection
              </button>
            </div>
          </div>

          {/* TABLE */}

          <div className={`mt-6 overflow-hidden rounded-3xl border shadow-sm ${darkMode ? "border-slate-700 bg-[#071f2f] shadow-[0_18px_48px_rgba(15,23,42,0.42)]" : "border-slate-200 bg-white"}`}>

            <div className={`border-b px-6 py-5 ${darkMode ? "border-slate-700 bg-[#0b2338]" : "border-slate-200 bg-slate-50"}`}>

              <h2 className={`text-xl font-bold tracking-[-0.02em] ${darkMode ? "text-white" : "text-slate-900"}`}>
                Site Inspection Records
              </h2>

            </div>

            {/* Tabs */}
            <div className={`flex items-center gap-3 border-b p-4 ${darkMode ? "border-slate-700 bg-[#0d2033]" : "border-slate-200 bg-white"}`}>
              <button
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === 'site' ? 'bg-red-600 text-white shadow-sm' : darkMode ? 'bg-slate-700 text-slate-200 hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                onClick={() => setActiveTab('site')}
              >
                Site Inspections
              </button>
              <button
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === 'cancelled' ? 'bg-red-600 text-white shadow-sm' : darkMode ? 'bg-slate-700 text-slate-200 hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                onClick={() => setActiveTab('cancelled')}
              >
                Cancelled
              </button>
            </div>

            <div className="overflow-x-auto">

              <table className="w-full">

                <thead className={darkMode ? "bg-[#0d2033] shadow-inner" : "bg-gradient-to-r from-slate-100 via-slate-50 to-white shadow-inner"}>
                  <tr>
                    <th className={`w-16 p-4 text-center text-[11px] font-black uppercase tracking-[0.16em] ${darkMode ? "text-slate-300" : "text-slate-500"}`}>#</th>
                    <th className={`p-4 text-left text-[11px] font-black uppercase tracking-[0.16em] ${darkMode ? "text-slate-300" : "text-slate-500"}`}>Tracking ID</th>
                    <th className={`p-4 text-left text-[11px] font-black uppercase tracking-[0.16em] ${darkMode ? "text-slate-300" : "text-slate-500"}`}>Client</th>
                    <th className={`p-4 text-left text-[11px] font-black uppercase tracking-[0.16em] ${darkMode ? "text-slate-300" : "text-slate-500"}`}>Site Address</th>
                    <th className={`p-4 text-left text-[11px] font-black uppercase tracking-[0.16em] ${darkMode ? "text-slate-300" : "text-slate-500"}`}>Created</th>
                    <th className={`p-4 text-left text-[11px] font-black uppercase tracking-[0.16em] ${darkMode ? "text-slate-300" : "text-slate-500"}`}>Inspection Date</th>
                    <th className={`p-4 text-left text-[11px] font-black uppercase tracking-[0.16em] ${darkMode ? "text-slate-300" : "text-slate-500"}`}>Est. Install Date</th>
                    <th className={`p-4 text-left text-[11px] font-black uppercase tracking-[0.16em] ${darkMode ? "text-slate-300" : "text-slate-500"}`}>Status</th>
                    <th className={`p-4 text-right text-[11px] font-black uppercase tracking-[0.16em] ${darkMode ? "text-slate-300" : "text-slate-500"}`}>Est. Total</th>
                    <th className={`p-4 text-center text-[11px] font-black uppercase tracking-[0.16em] ${darkMode ? "text-slate-300" : "text-slate-500"}`}>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {inspectionsLoading ? (
                    <tr>
                      <td colSpan={9} className={`p-8 text-center ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                        Loading inspections...
                      </td>
                    </tr>
                  ) : !filteredList.length ? (
                    <tr>
                      <td colSpan={9} className={`p-8 text-center ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                        No records in this tab.
                      </td>
                    </tr>
                  ) : (
                    paginatedList.map((inspection, index) => {
                      const clientName = inspection.customer
                        ? `${inspection.customer.first_name || ""} ${inspection.customer.last_name || ""}`.trim() || inspection.customer.email || inspection.customer_name || "Customer"
                        : inspection.customer_name || inspection.customer_email || "Customer";
                      const trackingId = inspection.tracking || inspection.order_number || inspection.orderId || `SI-${String((inspection._id || inspection.id || "")).slice(-8).toUpperCase()}`;
                      const phone = inspection.customer?.phone || inspection.customer_phone || "—";
                      const siteAddress = inspection.shipping_address || inspection.siteAddress || inspection.customer?.street_address || "—";
                      const createdDate = inspection.createdAt ? formatDateToMMDDYYYY(inspection.createdAt) : "—";
                      const inspectionDate = inspection.inspection_date ? formatDateToMMDDYYYY(inspection.inspection_date) : "—";
                      const installDateValue = getEstimatedInstallationDate(inspection);
                      const installDate = installDateValue ? formatDateToMMDDYYYY(installDateValue) : "—";
                      const total = Number(inspection.total_amount || inspection.contract_amount || 0);
                      const isScheduled = hasValidInspectionDate(inspection);
                      const isCancelledTab = activeTab === "cancelled";
                      const statusConfig = isCancelledTab
                        ? {
                            label: "Cancelled",
                            className: darkMode
                              ? "border border-rose-300/40 bg-gradient-to-r from-rose-500/25 via-red-500/20 to-slate-800 text-rose-50 shadow-[0_10px_24px_rgba(244,63,94,0.26)] ring-1 ring-rose-200/10"
                              : "border border-rose-200 bg-gradient-to-r from-rose-50 via-red-50 to-slate-100 text-rose-700 shadow-[0_10px_24px_rgba(244,63,94,0.12)]",
                          }
                        : isScheduled
                          ? {
                              label: "Scheduled",
                              className: darkMode
                                ? "border border-emerald-300/40 bg-gradient-to-r from-emerald-500/30 via-teal-500/25 to-emerald-400/20 text-emerald-50 shadow-[0_10px_24px_rgba(16,185,129,0.28)] ring-1 ring-emerald-200/10"
                                : "border border-emerald-200 bg-gradient-to-r from-emerald-50 via-teal-50 to-lime-50 text-emerald-700 shadow-[0_10px_24px_rgba(16,185,129,0.12)]",
                            }
                          : {
                              label: "Needs to be Called",
                              className: darkMode
                                ? "border border-amber-300/40 bg-gradient-to-r from-amber-500/30 via-orange-500/18 to-yellow-500/14 text-amber-50 shadow-[0_10px_24px_rgba(245,158,11,0.24)] ring-1 ring-amber-200/10"
                                : "border border-amber-200 bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 text-amber-700 shadow-[0_10px_24px_rgba(245,158,11,0.12)]",
                            };

                      return (
                        <tr
                          key={inspection._id || inspection.id}
                          className={isCancelledTab
                            ? darkMode
                              ? "border-t border-slate-700 bg-slate-900/40 opacity-85 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-800/70 hover:shadow-[0_8px_18px_rgba(15,23,42,0.22)]"
                              : "border-t border-slate-200 bg-slate-50/80 opacity-85 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-100 hover:shadow-[0_8px_18px_rgba(15,23,42,0.04)]"
                            : darkMode
                              ? "border-t border-slate-700 bg-[#0b2338] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#102d46] hover:shadow-[0_8px_18px_rgba(15,23,42,0.2)]"
                              : "border-t border-slate-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-[0_8px_18px_rgba(15,23,42,0.04)]"}
                        >
                          <td className={`w-16 p-4 text-center font-bold ${isCancelledTab ? darkMode ? "text-slate-400" : "text-slate-500" : darkMode ? "text-slate-300" : "text-slate-600"}`}>
                            {(currentPageIndex - 1) * pageSize + index + 1}
                          </td>
                          <td className="p-4 align-top py-5">
                            <div className={`text-[11px] font-black uppercase tracking-[0.16em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Tracking</div>
                            <div className={`mt-1 font-bold ${darkMode ? "text-slate-100" : "text-slate-900"}`}>{trackingId}</div>
                          </td>
                          <td className="p-4 align-top py-5">
                            <div className={`font-semibold ${darkMode ? "text-slate-100" : isCancelledTab ? "text-slate-600" : "text-slate-900"}`}>{clientName}</div>
                            <div className={`mt-1 text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{phone}</div>
                          </td>
                          <td className={`p-4 align-top py-5 ${darkMode ? "text-slate-300" : isCancelledTab ? "text-slate-600" : "text-slate-700"}`}>
                            <div className="max-w-[220px] break-words leading-relaxed">
                              {siteAddress}
                            </div>
                          </td>
                          <td className={`p-4 align-top py-5 ${darkMode ? "text-slate-400" : isCancelledTab ? "text-slate-500" : "text-slate-700"}`}>{createdDate}</td>
                          <td className={`p-4 align-top py-5 ${darkMode ? "text-slate-400" : isCancelledTab ? "text-slate-500" : "text-slate-700"}`}>{inspectionDate}</td>
                          <td className={`p-4 align-top py-5 ${darkMode ? "text-slate-400" : isCancelledTab ? "text-slate-500" : "text-slate-700"}`}>{installDate}</td>
                          <td className="p-4 align-top py-5">
                            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold tracking-[0.02em] ${statusConfig.className}`}>
                              <span
                                className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] shadow-inner ${darkMode ? "border-white/15 bg-slate-950/70 text-white" : "border-white/70 bg-white/80 text-slate-700"}`}
                                aria-hidden="true"
                              >
                                {isCancelledTab ? "⛔" : isScheduled ? "✓" : "📞"}
                              </span>
                              {statusConfig.label}
                            </span>
                          </td>
                          <td className={`p-4 align-top py-5 text-right font-black ${darkMode ? "text-slate-100" : isCancelledTab ? "text-slate-600" : "text-slate-900"}`}>
                            {Number.isFinite(total) && total > 0 ? `₱${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "₱0.00"}
                          </td>
                          <td className="p-4 align-top py-5">
                            <div className="flex items-center justify-center gap-3">
                              <button
                                className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm transition-all duration-200 ${darkMode ? "border-sky-500/30 bg-sky-500/10 text-sky-200 hover:-translate-y-0.5 hover:border-sky-400 hover:bg-sky-500/20" : isCancelledTab ? "border-blue-200 bg-blue-50 text-blue-700 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-100" : "border-sky-200 bg-sky-50 text-sky-700 hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-100"}`}
                                onClick={() => handleView(inspection)}
                                title="View inspection"
                                aria-label="View inspection"
                              >
                                <Eye size={18} />
                              </button>
                              {activeTab !== "cancelled" && (
                                <button
                                  className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm transition-all duration-200 ${darkMode ? "border-amber-500/30 bg-amber-500/10 text-amber-200 hover:-translate-y-0.5 hover:border-amber-400 hover:bg-amber-500/20" : "border-amber-200 bg-amber-50 text-amber-700 hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-100"}`}
                                  onClick={() => handleEdit(inspection._id || inspection.id)}
                                  title="Edit inspection"
                                  aria-label="Edit inspection"
                                >
                                  <Pencil size={18} />
                                </button>
                              )}
                              {activeTab !== "cancelled" && hasValidInspectionDate(inspection) && (
                                <button
                                  title="Generate Contract"
                                  aria-label="Generate contract"
                                  className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${darkMode ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-emerald-500/20" : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-100"}`}
                                  onClick={() => requestGenerateContract(inspection._id || inspection.id)}
                                  disabled={generatingId === (inspection._id || inspection.id)}
                                >
                                  {generatingId === (inspection._id || inspection.id) ? (
                                    <span className="text-[10px] font-bold">…</span>
                                  ) : (
                                    <FileText size={18} />
                                  )}
                                </button>
                              )}
                              {activeTab !== "cancelled" ? (
                                <button
                                  className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${darkMode ? "border-red-500/30 bg-red-500/10 text-red-200 hover:-translate-y-0.5 hover:border-red-400 hover:bg-red-500/20" : "border-red-200 bg-red-50 text-red-700 hover:-translate-y-0.5 hover:border-red-300 hover:bg-red-100"}`}
                                  onClick={() => requestCancel(inspection._id || inspection.id)}
                                  title="Cancel inspection"
                                  aria-label="Cancel inspection"
                                  disabled={cancellingId === (inspection._id || inspection.id)}
                                >
                                  {cancellingId === (inspection._id || inspection.id) ? (
                                    <span className="text-[10px] font-bold">…</span>
                                  ) : (
                                    <XOctagon size={18} />
                                  )}
                                </button>
                              ) : (
                                <button
                                  title="Restore inspection"
                                  aria-label="Restore inspection"
                                  className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${darkMode ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-emerald-500/20" : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-100"}`}
                                  onClick={() => requestRestore(inspection._id || inspection.id)}
                                  disabled={restoringId === (inspection._id || inspection.id)}
                                >
                                  {restoringId === (inspection._id || inspection.id) ? (
                                    <span className="text-[10px] font-bold">…</span>
                                  ) : (
                                    <RotateCcw size={18} />
                                  )}
                                </button>
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

            <div className={`flex flex-col gap-3 justify-center items-center border-t p-4 sm:flex-row ${darkMode ? "border-slate-700 bg-[#0b2338]" : "border-slate-200 bg-gray-50"}`}>
              <div className={`text-sm ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
                Showing {visibleRecordStart} - {visibleRecordEnd} of {filteredList.length} records
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage <= 1}
                  className={`px-4 py-2 rounded-lg border disabled:cursor-not-allowed disabled:opacity-50 ${darkMode ? "border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700" : "border bg-white text-slate-700 hover:bg-gray-100"}`}
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
                      className={`w-10 h-10 rounded-lg ${pageNumber === currentPage ? 'bg-red-600 text-white' : darkMode ? 'border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700' : 'border bg-white text-slate-700 hover:bg-gray-100'}`}
                    >
                      {pageNumber}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage >= totalPages}
                  className={`px-4 py-2 rounded-lg border disabled:cursor-not-allowed disabled:opacity-50 ${darkMode ? "border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700" : "border bg-white text-slate-700 hover:bg-gray-100"}`}
                >
                  Next
                </button>
              </div>
            </div>

          </div>

          {/* MODAL */}

          {showModal && (
            <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-6 backdrop-blur-[2px]">
              <div className={`flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[26px] ${modalShellClass}`}>
                <div className={`flex items-start justify-between px-6 py-5 ${modalHeaderClass}`}>
                  <div>
                    <h2 className={`text-[26px] font-black tracking-[-0.04em] ${darkMode ? "text-white" : "text-slate-900"}`}>New Site Inspection</h2>
                    <p className={`mt-1 text-sm ${darkMode ? "text-slate-300" : "text-slate-600"}`}>Fill in the details below to create a new inspection record.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border text-2xl shadow-sm transition ${darkMode ? "border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900"}`}
                    aria-label="Close new site inspection modal"
                  >
                    ×
                  </button>
                </div>

                <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
                  <section className={`rounded-2xl p-5 ${modalSectionClass}`}>
                    <h3 className={`mb-5 text-[13px] font-black uppercase tracking-[0.16em] ${darkMode ? "text-red-400" : "text-red-600"}`}>Client Information</h3>

                    <div className="grid gap-5 md:grid-cols-3">
                      <div className="md:col-span-1">
                        <label className={`mb-2 block text-[14px] font-bold ${labelClass}`}>Client Name <span className="text-red-400">*</span></label>
                        <input
                          type="text"
                          placeholder="e.g. Maria Santos"
                          className={`${fieldClass} ${Boolean(selectedCustomer) ? "border-slate-300 bg-slate-200 text-slate-600 shadow-inner dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" : ""}`}
                          value={customerSearch || newInspection.customerName}
                          onChange={(e) => handleClientNameInput(e.target.value)}
                        />
                        {customerSearchLoading && !selectedCustomer && <p className={`mt-2 text-xs ${mutedTextClass}`}>Searching customers...</p>}
                        {customerSearchError && <p className="mt-2 text-xs text-red-400">{customerSearchError}</p>}
                        {errors.customerName && <p className="mt-2 text-xs text-red-400">{errors.customerName}</p>}
                        {customerSuggestions.length > 0 && !selectedCustomer && (
                          <div className={`absolute z-30 mt-2 w-full max-w-[22rem] rounded-2xl border shadow-lg max-h-72 overflow-y-auto ${darkMode ? "border-slate-700 bg-[#122d42]" : "border-slate-200 bg-white"}`}>
                            {customerSuggestions.map((customer) => {
                              const label = `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || customer.email || customer.phone || "Unnamed";
                              return (
                                <button
                                  key={customer._id}
                                  type="button"
                                  onClick={() => handleCustomerSelect(customer)}
                                  className={`w-full text-left px-4 py-3 ${darkMode ? "hover:bg-slate-700" : "hover:bg-slate-100"}`}
                                >
                                  <div className={`font-semibold ${darkMode ? "text-slate-100" : "text-slate-900"}`}>{label}</div>
                                  <div className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{customer.email || customer.phone || formatCustomerAddress(customer)}</div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="md:col-span-1">
                        <label className={`mb-2 block text-[14px] font-bold ${labelClass}`}>Client Number <span className="text-red-400">*</span></label>
                        <input
                          type="text"
                          placeholder="e.g. 09171234567"
                          className={selectedCustomer ? lockedFieldClass : fieldClass}
                          value={newInspection.phone}
                          onChange={(e) => handleInspectionFieldChange("phone", e.target.value)}
                          readOnly={!!selectedCustomer}
                        />
                        {errors.phone && <p className="mt-2 text-xs text-red-400">{errors.phone}</p>}
                      </div>

                      <div className="md:col-span-1">
                        <label className={`mb-2 block text-[14px] font-bold ${labelClass}`}>Site Address <span className="text-red-400">*</span></label>
                        <input
                          type="text"
                          placeholder="e.g. 45 Magsaysay Dr."
                          className={selectedCustomer ? lockedFieldClass : fieldClass}
                          value={newInspection.siteAddress}
                          onChange={(e) => handleInspectionFieldChange("siteAddress", e.target.value)}
                          readOnly={!!selectedCustomer}
                        />
                        {errors.siteAddress && <p className="mt-2 text-xs text-red-400">{errors.siteAddress}</p>}
                      </div>
                    </div>

                    <div className="mt-5 grid gap-5 md:grid-cols-3">
                      <div>
                        <label className={`mb-2 block text-[14px] font-bold ${labelClass}`}>Inspection Date <span className="text-red-400">*</span></label>
                        <input
                          type="date"
                          className={fieldClass}
                          value={newInspection.inspection_date}
                          min={today}
                          onChange={(e) => handleInspectionFieldChange("inspection_date", e.target.value)}
                        />
                        {errors.inspection_date && <p className="mt-2 text-xs text-red-400">{errors.inspection_date}</p>}
                      </div>

                      <div>
                        <label className={`mb-2 block text-[14px] font-bold ${labelClass}`}>Est. Installation Date <span className="text-red-400">*</span></label>
                        <input
                          type="date"
                          className={fieldClass}
                          value={newInspection.estimated_installation_date || ""}
                          min={today}
                          onChange={(e) => handleInspectionFieldChange("estimated_installation_date", e.target.value)}
                        />
                        {errors.estimated_installation_date && <p className="mt-2 text-xs text-red-400">{errors.estimated_installation_date}</p>}
                      </div>

                      <div>
                        <label className={`mb-2 block text-[14px] font-bold ${labelClass}`}>Status</label>
                        <div className={`flex h-[48px] items-center justify-center rounded-xl px-3 text-sm font-bold ${inspectionStatus.className}`}>
                          <span className="mr-2 text-base">{inspectionStatus.icon}</span>
                          {inspectionStatus.label}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6">
                      <p className={`mb-3 text-[14px] font-bold ${labelClass}`}>Warranty Period</p>
                      <div className="flex flex-wrap items-center gap-3">
                        {[30, 90, "Custom"].map((option) => {
                          const isSelected = option === "Custom"
                            ? newInspection.warranty_period === "Custom"
                            : Number(newInspection.warranty_period) === Number(option);
                          return (
                            <button
                              key={String(option)}
                              type="button"
                              onClick={() => handleInspectionFieldChange("warranty_period", option === "Custom" ? "Custom" : Number(option))}
                              className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${
                                isSelected
                                  ? "border-red-500 bg-red-600 text-white shadow-sm"
                                  : darkMode
                                    ? "border-slate-600 bg-[#122d42] text-slate-200 hover:bg-slate-700"
                                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                              }`}
                            >
                              {option === "Custom" ? "Custom" : `${option} Days`}
                            </button>
                          );
                        })}
                      </div>
                      <p className={`mt-3 text-xs ${mutedTextClass}`}>Coverage starts on the installation date. Used for testing warranty expiry.</p>
                    </div>
                  </section>

                  <section className={`rounded-2xl p-5 ${modalSectionClass}`}>
                    <h3 className={`mb-5 text-[13px] font-black uppercase tracking-[0.16em] ${darkMode ? "text-red-400" : "text-red-600"}`}>Customer Account</h3>

                    <div className="grid gap-5 md:grid-cols-[1.1fr_1.7fr]">
                      <div>
                        <p className={`mb-2 text-[14px] font-bold ${labelClass}`}>Has Account on Website?</p>
                        <div className={`grid grid-cols-2 overflow-hidden rounded-xl border shadow-sm ${darkMode ? "border-slate-600 bg-[#122d42]" : "border-slate-200 bg-slate-50"}`}>
                          <button
                            type="button"
                            onClick={() => handleInspectionFieldChange("has_account_on_website", true)}
                            className={`flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold transition ${
                              newInspection.has_account_on_website
                                ? darkMode ? "bg-green-500/15 text-green-300" : "bg-green-50 text-green-700"
                                : darkMode ? "bg-[#122d42] text-slate-400" : "bg-white text-slate-500"
                            }`}
                          >
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-green-400 bg-green-600 text-[10px] text-white">✓</span>
                            Yes
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(selectedCustomer || newInspection.customerId)}
                            onClick={() => handleInspectionFieldChange("has_account_on_website", false)}
                            className={`flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                              !newInspection.has_account_on_website
                                ? darkMode ? "bg-slate-700 text-slate-100" : "bg-slate-200 text-slate-800"
                                : darkMode ? "bg-[#122d42] text-slate-400" : "bg-white text-slate-500"
                            }`}
                          >
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-500 bg-slate-600 text-[10px] text-slate-100">×</span>
                            No
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className={`mb-2 block text-[14px] font-bold ${labelClass}`}>Customer Email (optional)</label>
                        <input
                          type="email"
                          placeholder="e.g. maria@email.com"
                          className={fieldClass}
                          value={newInspection.customerEmail}
                          onChange={(e) => handleInspectionFieldChange("customerEmail", e.target.value)}
                          readOnly={Boolean(selectedCustomer)}
                        />
                        <p className={`mt-2 text-xs ${mutedTextClass}`}>Optional — only needed if you plan to email the contract; you can still print it without one.</p>
                      </div>
                    </div>

                  </section>

                  <section className={`rounded-2xl p-5 ${modalSectionClass}`}>
                    <h3 className={`mb-4 text-[13px] font-black uppercase tracking-[0.16em] ${darkMode ? "text-red-400" : "text-red-600"}`}>Site Details</h3>
                    <textarea
                      rows={4}
                      placeholder="Describe the project scope, access notes, special requirements..."
                      className={fieldClass}
                      value={newInspection.site_notes || newInspection.notes || ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        setNewInspection((prev) => ({ ...prev, site_notes: value, notes: value }));
                      }}
                    />
                  </section>

                  <section className={`rounded-2xl p-5 ${modalSectionClass}`}>
                    <h3 className={`mb-4 text-[13px] font-black uppercase tracking-[0.16em] ${darkMode ? "text-red-400" : "text-red-600"}`}>Measurements</h3>
                    <p className={`text-sm ${darkMode ? "text-slate-300" : "text-slate-600"}`}>Add or edit measurement rows. Totals update in real time.</p>

                    <div className={`mt-4 overflow-hidden rounded-xl border ${darkMode ? "border-slate-700 bg-[#122d42]" : "border-slate-200 bg-white"}`}>
                      <div className={`grid grid-cols-[1.7fr_0.9fr_0.9fr_0.8fr_0.7fr_1fr_1fr] gap-2 px-3 py-3 text-[11px] font-black uppercase tracking-[0.12em] ${darkMode ? "bg-[#0d2033] text-slate-300" : "bg-slate-100 text-slate-600"}`}>
                        <div>Product / Description</div>
                        <div>Width</div>
                        <div>Height</div>
                        <div>Unit</div>
                        <div>Qty</div>
                        <div>Price/ Sqft</div>
                        <div>Total</div>
                      </div>

                      {(newInspection.items || []).map((item, index) => {
                        const rowSubtotal = calculateRowSubtotal(item);
                        return (
                          <div key={item.id} className={`grid grid-cols-[1.7fr_0.9fr_0.9fr_0.8fr_0.7fr_1fr_1fr] gap-2 border-t p-3 ${darkMode ? "border-slate-700" : "border-slate-200"}`}>
                            <div className="flex items-center gap-2">
                              <select
                                value={item.product_id || ""}
                                onChange={(e) => handleItemProductChange(item.id, e.target.value)}
                                className={darkMode ? "w-full rounded-lg border border-slate-600 bg-[#122d42] px-2 py-2 text-sm text-slate-100 outline-none focus:border-red-500" : "w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900 outline-none focus:border-red-500"}
                              >
                                <option value="">-- Select Active Product --</option>
                                {products.map((product) => (
                                  <option key={String(product._id || product.id)} value={String(product._id || product.id)}>{product.name}</option>
                                ))}
                              </select>
                            </div>
                            <input
                              type="number"
                              min="0"
                              value={item.width || 0}
                              onChange={(e) => handleItemFieldChange(item.id, "width", e.target.value)}
                              className={darkMode ? "w-full rounded-lg border border-slate-600 bg-[#122d42] px-2 py-2 text-sm text-slate-100 outline-none focus:border-red-500" : "w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900 outline-none focus:border-red-500"}
                            />
                            <input
                              type="number"
                              min="0"
                              value={item.height || 0}
                              onChange={(e) => handleItemFieldChange(item.id, "height", e.target.value)}
                              className={darkMode ? "w-full rounded-lg border border-slate-600 bg-[#122d42] px-2 py-2 text-sm text-slate-100 outline-none focus:border-red-500" : "w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900 outline-none focus:border-red-500"}
                            />
                            <div className={`flex items-center justify-center rounded-lg border px-2 py-2 text-sm font-medium ${darkMode ? "border-slate-600 bg-[#0d2033] text-slate-200" : "border-slate-200 bg-slate-100 text-slate-700"}`}>
                              {item.unit || "sqft"}
                            </div>
                            <input
                              type="number"
                              min="1"
                              value={item.qty || 1}
                              onChange={(e) => handleItemFieldChange(item.id, "qty", e.target.value)}
                              className={darkMode ? "w-full rounded-lg border border-slate-600 bg-[#122d42] px-2 py-2 text-sm text-slate-100 outline-none focus:border-red-500" : "w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900 outline-none focus:border-red-500"}
                            />
                            <div className={`flex items-center justify-center rounded-lg border px-2 py-2 text-sm font-bold ${darkMode ? "border-slate-600 bg-[#0d2033] text-slate-100" : "border-slate-200 bg-slate-100 text-slate-800"}`}>
                              {formatCurrency(Number(item.unit_price) || 0)}
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-sm font-bold ${darkMode ? "text-slate-100" : "text-slate-800"}`}>{formatCurrency(rowSubtotal)}</span>
                              <button type="button" onClick={() => removeItemRow(item.id)} className="text-lg font-bold text-red-400 hover:text-red-300">×</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <button type="button" onClick={addItemRow} className={`rounded-[12px] border px-4 py-2 text-sm font-bold transition ${darkMode ? "border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20" : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"}`}>
                        + Add Row
                      </button>
                      <div className={`text-lg font-black ${darkMode ? "text-slate-100" : "text-slate-900"}`}>
                        Total: <span className="text-red-400">{formatCurrency(computeTotals().totalEstimate)}</span>
                      </div>
                    </div>
                  </section>

                  <section className={`rounded-2xl p-5 ${modalSectionClass}`}>
                    <h3 className={`mb-4 text-[13px] font-black uppercase tracking-[0.16em] ${darkMode ? "text-red-400" : "text-red-600"}`}>Payment Information</h3>
                    <div className={`mb-5 rounded-xl border px-4 py-3 text-sm font-medium ${darkMode ? "border-amber-500/30 bg-amber-500/10 text-amber-100" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                      <span className="mr-2 text-base">💡</span>
                      Business Policy: A 50% downpayment is required before project commences.
                    </div>

                    <div className="grid gap-5 md:grid-cols-2">
                      <div>
                        <label className={`mb-2 block text-[14px] font-bold ${labelClass}`}>Computed Total</label>
                        <div className={`rounded-xl border px-3 py-3 text-xl font-black ${darkMode ? "border-slate-600 bg-[#122d42] text-white" : "border-slate-200 bg-white text-slate-900"}`}>
                          {formatCurrency(computeTotals().totalEstimate)}
                        </div>
                      </div>

                      <div>
                        <label className={`mb-2 block text-[14px] font-bold ${labelClass}`}>Manual Override (optional)</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="Enter adjusted total..."
                          className={fieldClass}
                          value={newInspection.manual_override}
                          onChange={(e) => handleInspectionFieldChange("manual_override", e.target.value)}
                        />
                      </div>
                    </div>

                    <div className={`mt-5 rounded-xl border border-dashed px-4 py-4 ${darkMode ? "border-slate-600 bg-[#102838] text-slate-200" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
                      <div className="flex items-center justify-between gap-4 text-[14px] font-bold">
                        <span>Final Estimated Total</span>
                        <span className={`text-[18px] font-black ${darkMode ? "text-white" : "text-slate-900"}`}>
                          {formatCurrency(Number(newInspection.manual_override) || computeTotals().totalEstimate)}
                        </span>
                      </div>
                      <div className={`mt-3 flex items-center justify-between gap-4 border-t pt-3 text-[14px] font-bold ${darkMode ? "border-slate-700 text-red-400" : "border-slate-200 text-red-600"}`}>
                        <span>50% Downpayment Due</span>
                        <span className={`text-[18px] font-black ${darkMode ? "text-red-400" : "text-red-600"}`}>
                          {formatCurrency(((Number(newInspection.manual_override) || computeTotals().totalEstimate) * 0.5))}
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-5 md:grid-cols-2">
                      <div>
                        <label className={`mb-2 block text-[14px] font-bold ${labelClass}`}>Payment Terms</label>
                        <select
                          className={fieldClass}
                          value={newInspection.payment_terms}
                          onChange={(e) => handleInspectionFieldChange("payment_terms", e.target.value)}
                        >
                          <option value="50%_down_payment">50% downpayment, 50% upon completion</option>
                          <option value="full_payment">Full Payment</option>
                        </select>
                      </div>

                      <div>
                        <label className={`mb-2 block text-[14px] font-bold ${labelClass}`}>Downpayment Received?</label>
                        <div className={`grid grid-cols-2 overflow-hidden rounded-xl border shadow-sm ${darkMode ? "border-slate-600 bg-[#122d42]" : "border-slate-200 bg-slate-50"}`}>
                          <button
                            type="button"
                            onClick={() => handleInspectionFieldChange("downpayment_received", true)}
                            className={`flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold transition ${
                              newInspection.downpayment_received
                                ? darkMode ? "bg-green-500/15 text-green-300" : "bg-green-50 text-green-700"
                                : darkMode ? "bg-[#122d42] text-slate-400" : "bg-white text-slate-500"
                            }`}
                          >
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-green-400 bg-green-600 text-[10px] text-white">✓</span>
                            Yes, Paid
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInspectionFieldChange("downpayment_received", false)}
                            className={`flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold transition ${
                              !newInspection.downpayment_received
                                ? darkMode ? "bg-slate-700 text-slate-100" : "bg-slate-200 text-slate-800"
                                : darkMode ? "bg-[#122d42] text-slate-400" : "bg-white text-slate-500"
                            }`}
                          >
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-500 bg-slate-600 text-[10px] text-slate-100">✕</span>
                            Not Yet
                          </button>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>

                <div className={`flex shrink-0 justify-end gap-3 px-6 py-5 ${footerClass}`}>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className={secondaryButtonClass}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submitNewInspection}
                    className={primaryButtonClass}
                    disabled={submitting}
                  >
                    {submitting ? "Creating..." : "Create Inspection"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VIEW DETAILS MODAL */}
          {viewInspection && (() => {
            const orderId = viewInspection._id || viewInspection.id;
            const customerName = viewInspection.customer
              ? `${viewInspection.customer.first_name || ""} ${viewInspection.customer.last_name || ""}`.trim() || viewInspection.customer.email || viewInspection.customer_name || "Customer"
              : viewInspection.customer_name || viewInspection.customer_email || "Customer";
            const customerPhone = viewInspection.customer?.phone || viewInspection.customer_phone || "—";
            const siteAddress = viewInspection.shipping_address || viewInspection.siteAddress || viewInspection.customer?.street_address || "—";
            const inspectionDate = viewInspection.inspection_date ? formatDateToMMDDYYYY(viewInspection.inspection_date) : "—";
            const installDateValue = getEstimatedInstallationDate(viewInspection);
            const installDate = installDateValue ? formatDateToMMDDYYYY(installDateValue) : "—";
            const orderReference = viewInspection.order_number || viewInspection.tracking || viewInspection.contract_number || `SI-ORD-${String(orderId || "NEW").slice(-10).toUpperCase()}`;
            const readinessIssues = [];
            if (!viewInspection.inspection_date) readinessIssues.push("Inspection Date");
            if (!installDateValue) readinessIssues.push("Estimated Installation Date");
            const inspectionItems = Array.isArray(viewInspection.items) ? viewInspection.items : [];
            const estimatedTotal = inspectionItems.reduce((sum, item) => {
              const qty = Number(item.quantity ?? item.qty ?? 1) || 1;
              const unitPrice = Number(item.unit_price ?? item.price ?? 0) || 0;
              const lineTotal = Number(item.estimated_price ?? item.total_price ?? qty * unitPrice) || 0;
              return sum + lineTotal;
            }, 0);
            const downPayment = estimatedTotal * 0.5;
            const balance = estimatedTotal - downPayment;
            const paymentTermsText = viewInspection.payment_terms === "50%_down_payment"
              ? "50% downpayment, 50% upon completion"
              : viewInspection.payment_terms === "full_payment"
                ? "Full payment"
                : "50% downpayment, 50% upon completion";
            const statusBadge = !viewInspection.inspection_date || !installDateValue
              ? {
                  label: "Needs to be Called",
                  className: darkMode
                    ? "border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-violet-200"
                    : "border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-violet-700",
                }
              : {
                  label: "Scheduled",
                  className: darkMode
                    ? "border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-200"
                    : "border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700",
                };
            const downpaymentStatus = viewInspection.downpayment_received
              ? {
                  label: "Paid",
                  className: darkMode
                    ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                    : "border border-emerald-200 bg-emerald-50 text-emerald-700",
                }
              : {
                  label: "Pending",
                  className: darkMode
                    ? "border border-amber-500/30 bg-amber-500/10 text-amber-200"
                    : "border border-amber-200 bg-amber-50 text-amber-700",
                };

            return (
              <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 pt-6">
                <div className={`flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[18px] border ${modalShellClass}`}>
                  <div className={`flex items-center justify-between px-5 py-4 ${darkMode ? "border-b border-slate-700 bg-[#0b2338]" : "border-b border-slate-200 bg-white"}`}>
                    <div className="flex items-center gap-4">
                      <h2 className={`text-[28px] font-black tracking-[-0.04em] ${darkMode ? "text-white" : "text-slate-900"}`}>Inspection Details</h2>
                      <span className={`text-xs font-semibold uppercase tracking-[0.18em] ${darkMode ? "text-slate-300" : "text-slate-500"}`}>
                        {orderReference}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleGenerateContract(orderId)}
                        disabled={!orderId || generatingId === orderId}
                        className={`inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-600/90 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        <span>✓</span>
                        {generatingId === orderId ? "Generating..." : "Generate Contract"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setViewInspection(null)}
                        aria-label="Close inspection details"
                        className={`flex h-9 w-9 items-center justify-center rounded-lg border text-lg font-semibold transition ${darkMode ? "border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"}`}
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  {readinessIssues.length > 0 && (
                    <div className={`flex items-center gap-3 border-b px-5 py-3 text-sm font-medium ${darkMode ? "border-amber-500/20 bg-amber-500/10 text-amber-100" : "border-amber-200 bg-[#fdf3d5] text-amber-900"}`}>
                      <span className="text-base">⚠</span>
                      <span>
                        This order isn't ready for contract generation yet. Missing: {readinessIssues.join(", ")}. 
                      </span>
                    </div>
                  )}

                  <div className={`flex-1 space-y-5 overflow-y-auto px-5 py-5 ${darkMode ? "bg-[#0d1b2a]" : "bg-[#f4f3f1]"}`}>
                    <div className={`rounded-[16px] border p-5 ${darkMode ? "border-slate-700 bg-[#122d42]" : "border-slate-200 bg-[#f9f9f9]"}`}>
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Client Information</div>
                      </div>

                      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                        <div>
                          <div className={`mb-2 text-[11px] font-black uppercase tracking-[0.18em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Client Name</div>
                          <div className={`text-lg font-bold ${darkMode ? "text-slate-100" : "text-slate-900"}`}>{customerName}</div>
                        </div>

                        <div>
                          <div className={`mb-2 text-[11px] font-black uppercase tracking-[0.18em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Client Number</div>
                          <div className={`text-lg font-semibold ${darkMode ? "text-slate-100" : "text-slate-900"}`}>{customerPhone}</div>
                        </div>

                        <div className="md:col-span-1">
                          <div className={`mb-2 text-[11px] font-black uppercase tracking-[0.18em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Site Address</div>
                          <div className={`text-sm leading-6 ${darkMode ? "text-slate-200" : "text-slate-700"}`}>{siteAddress}</div>
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-3">
                        <div>
                          <div className={`mb-2 text-[11px] font-black uppercase tracking-[0.18em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Inspection Date</div>
                          <div className={`text-base font-medium ${darkMode ? "text-slate-200" : "text-slate-700"}`}>{inspectionDate}</div>
                        </div>

                        <div>
                          <div className={`mb-2 text-[11px] font-black uppercase tracking-[0.18em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Est. Installation Date</div>
                          <div className={`text-base font-medium ${darkMode ? "text-slate-200" : "text-slate-700"}`}>{installDate}</div>
                        </div>

                        <div className="flex items-end justify-start md:justify-end">
                          <span className={`inline-flex items-center justify-center rounded-xl border px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] ${statusBadge.className}`}>
                            {statusBadge.label}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className={`rounded-[16px] border p-0 overflow-hidden ${darkMode ? "border-slate-700 bg-[#122d42]" : "border-slate-200 bg-white"}`}>
                      <div className={`px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] ${darkMode ? "bg-[#0d2033] text-slate-300" : "bg-slate-100 text-slate-500"}`}>
                        Measurements
                      </div>

                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left">
                          <thead className={darkMode ? "bg-[#0d2033] text-slate-300" : "bg-slate-100 text-slate-600"}>
                            <tr>
                              <th className="px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em]">Product / Description</th>
                              <th className="px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em]">Width</th>
                              <th className="px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em]">Height</th>
                              <th className="px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em]">Unit</th>
                              <th className="px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em]">Qty</th>
                              <th className="px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em]">Price/SQFT</th>
                              <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-[0.14em]">Est. Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {inspectionItems.length ? inspectionItems.map((item, index) => {
                              const itemName = item.name || item.product_id?.name || `Item ${index + 1}`;
                              const width = Number(item.width || 0);
                              const height = Number(item.height || 0);
                              const qty = Number(item.quantity ?? item.qty ?? 1) || 1;
                              const unit = item.unit || "in";
                              const unitPrice = Number(item.unit_price ?? item.price ?? 0) || 0;
                              const lineTotal = Number(item.estimated_price ?? item.total_price ?? qty * unitPrice) || 0;

                              return (
                                <tr key={`${itemName}-${index}`} className={darkMode ? "border-t border-slate-700 text-slate-200" : "border-t border-slate-200 text-slate-700"}>
                                  <td className="px-4 py-3 font-medium">{itemName}</td>
                                  <td className="px-4 py-3">{width || "—"}</td>
                                  <td className="px-4 py-3">{height || "—"}</td>
                                  <td className="px-4 py-3">{unit}</td>
                                  <td className="px-4 py-3">{qty}</td>
                                  <td className="px-4 py-3">{unitPrice ? formatCurrency(unitPrice) : "—"}</td>
                                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(lineTotal)}</td>
                                </tr>
                              );
                            }) : (
                              <tr>
                                <td colSpan={7} className={`px-4 py-6 text-center text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                                  No measurement rows available.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className={`flex justify-end px-4 py-3 text-sm font-semibold ${darkMode ? "bg-[#0d2033] text-slate-200" : "bg-slate-50 text-slate-700"}`}>
                        <span>Total: </span>
                        <span className="ml-2 text-base font-black">{formatCurrency(estimatedTotal)}</span>
                      </div>
                    </div>

                    <div className={`rounded-[16px] border p-5 ${darkMode ? "border-slate-700 bg-[#122d42]" : "border-slate-200 bg-[#f5f0f0]"}`}>
                      <div className="mb-4 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Payment Summary</div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm font-semibold">
                          <span className={darkMode ? "text-slate-200" : "text-slate-700"}>Estimated Total</span>
                          <span className={darkMode ? "text-slate-100" : "text-slate-900"}>{formatCurrency(estimatedTotal)}</span>
                        </div>

                        <div className="relative h-10 overflow-hidden rounded-lg border border-rose-200 bg-rose-100">
                          <div className="absolute inset-y-0 left-0 w-1/2 bg-rose-200" />
                          <div className="relative flex h-full items-center justify-between px-3 text-sm font-semibold text-rose-700">
                            <span>50% Downpayment</span>
                            <span>{formatCurrency(downPayment)}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-sm font-semibold">
                          <span className={darkMode ? "text-slate-200" : "text-slate-700"}>Balance</span>
                          <span className={darkMode ? "text-slate-100" : "text-slate-900"}>{formatCurrency(balance)}</span>
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4 text-sm text-slate-500">
                          <span>Payment Terms</span>
                          <span className={darkMode ? "text-slate-300" : "text-slate-600"}>{paymentTermsText}</span>
                        </div>

                        <div className="mt-3 flex items-center justify-between text-sm">
                          <span className={darkMode ? "text-slate-300" : "text-slate-600"}>Downpayment Status</span>
                          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] ${downpaymentStatus.className}`}>
                            {downpaymentStatus.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* EDIT INSPECTION MODAL */}
          {editInspection && (
            <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-6 backdrop-blur-[2px]">
              <div className={`flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[26px] ${modalShellClass}`}>
                <div className={`flex items-start justify-between px-6 py-5 ${modalHeaderClass}`}>
                  <div>
                    <h2 className={`text-[26px] font-black tracking-[-0.04em] ${darkMode ? "text-white" : "text-slate-900"}`}>
                      Edit Site Inspection
                    </h2>
                    <p className={`mt-1 text-sm ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
                      Update client, schedule, and project details for this inspection.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditInspection(null)}
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border text-2xl shadow-sm transition ${darkMode ? "border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900"}`}
                    aria-label="Close edit site inspection modal"
                  >
                    ×
                  </button>
                </div>

                <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
                  <section className={`rounded-2xl p-5 ${modalSectionClass}`}>
                    <h3 className={`mb-5 text-[13px] font-black uppercase tracking-[0.16em] ${darkMode ? "text-red-400" : "text-red-600"}`}>
                      Client Information
                    </h3>

                    <div className="grid gap-5 md:grid-cols-3">
                      <div>
                        <label className={`mb-2 block text-[14px] font-bold ${labelClass}`}>Client Name</label>
                        <input
                          type="text"
                          className={fieldClass}
                          value={editInspection.customerName || ""}
                          onChange={(e) => handleEditChange("customerName", e.target.value)}
                        />
                      </div>

                      <div>
                        <label className={`mb-2 block text-[14px] font-bold ${labelClass}`}>Client Number</label>
                        <input
                          type="text"
                          className={fieldClass}
                          value={editInspection.phone || ""}
                          onChange={(e) => handleEditChange("phone", e.target.value)}
                        />
                      </div>

                      <div>
                        <label className={`mb-2 block text-[14px] font-bold ${labelClass}`}>Site Address</label>
                        <input
                          type="text"
                          className={fieldClass}
                          value={editInspection.siteAddress || ""}
                          onChange={(e) => handleEditChange("siteAddress", e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="mt-5 grid gap-5 md:grid-cols-3">
                      <div>
                        <label className={`mb-2 block text-[14px] font-bold ${labelClass}`}>Inspection Date <span className="text-red-400">*</span></label>
                        <input
                          type="date"
                          className={fieldClass}
                          value={editInspection.inspection_date || ""}
                          min={today}
                          onChange={(e) => handleEditChange("inspection_date", e.target.value)}
                        />
                        {errors.inspection_date && <p className="mt-2 text-xs text-red-400">{errors.inspection_date}</p>}
                      </div>

                      <div>
                        <label className={`mb-2 block text-[14px] font-bold ${labelClass}`}>Est. Installation Date <span className="text-red-400">*</span></label>
                        <input
                          type="date"
                          className={fieldClass}
                          value={editInspection.estimated_installation_date || ""}
                          min={today}
                          onChange={(e) => handleEditChange("estimated_installation_date", e.target.value)}
                        />
                        {errors.estimated_installation_date && <p className="mt-2 text-xs text-red-400">{errors.estimated_installation_date}</p>}
                      </div>

                      <div>
                        <label className={`mb-2 block text-[14px] font-bold ${labelClass}`}>Status</label>
                        <div className={`flex h-[48px] items-center justify-center rounded-xl px-3 text-sm font-bold ${editInspection.inspection_date ? (darkMode ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border border-emerald-200 bg-emerald-50 text-emerald-700") : statusBadgeClass}`}>
                          <span className="mr-2 text-base">{editInspection.inspection_date ? "✓" : "📞"}</span>
                          {editInspection.inspection_date ? "Scheduled" : "Needs to be Called"}
                        </div>
                      </div>
                    </div>

                  </section>

                  <section className={`rounded-2xl p-5 ${modalSectionClass}`}>
                    <h3 className={`mb-5 text-[13px] font-black uppercase tracking-[0.16em] ${darkMode ? "text-red-400" : "text-red-600"}`}>Customer Account</h3>

                    <div className="grid gap-5 md:grid-cols-[1.1fr_1.7fr]">
                      <div>
                        <p className={`mb-2 text-[14px] font-bold ${labelClass}`}>Has Account on Website?</p>
                        <div className={`grid grid-cols-2 overflow-hidden rounded-xl border shadow-sm ${darkMode ? "border-slate-600 bg-[#122d42]" : "border-slate-200 bg-slate-50"}`}>
                          <button
                            type="button"
                            onClick={() => handleEditChange("has_account_on_website", true)}
                            className={`flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold transition ${Boolean(editInspection.has_account_on_website) ? (darkMode ? "bg-green-500/15 text-green-300" : "bg-green-50 text-green-700") : (darkMode ? "bg-[#122d42] text-slate-400" : "bg-white text-slate-500")}`}
                          >
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-green-400 bg-green-600 text-[10px] text-white">✓</span>
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditChange("has_account_on_website", false)}
                            className={`flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold transition ${!Boolean(editInspection.has_account_on_website) ? (darkMode ? "bg-slate-700 text-slate-100" : "bg-slate-200 text-slate-800") : (darkMode ? "bg-[#122d42] text-slate-400" : "bg-white text-slate-500")}`}
                          >
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-500 bg-slate-600 text-[10px] text-slate-100">×</span>
                            No
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className={`mb-2 block text-[14px] font-bold ${labelClass}`}>Customer Email (optional)</label>
                        <input
                          type="email"
                          className={fieldClass}
                          value={editInspection.customerEmail || ""}
                          onChange={(e) => handleEditChange("customerEmail", e.target.value)}
                        />
                        <p className={`mt-2 text-xs ${mutedTextClass}`}>Optional — only needed if you plan to email the contract; you can still print it without one.</p>
                      </div>
                    </div>
                  </section>

                  <section className={`rounded-2xl p-5 ${modalSectionClass}`}>
                    <h3 className={`mb-4 text-[13px] font-black uppercase tracking-[0.16em] ${darkMode ? "text-red-400" : "text-red-600"}`}>
                      Site Details
                    </h3>
                    <textarea
                      rows={4}
                      placeholder="Describe the project scope, access notes, special requirements..."
                      className={fieldClass}
                      value={editInspection.inspection_notes || ""}
                      onChange={(e) => handleEditChange("inspection_notes", e.target.value)}
                    />
                  </section>

                  <section className={`rounded-2xl p-5 ${modalSectionClass}`}>
                    <h3 className={`mb-4 text-[13px] font-black uppercase tracking-[0.16em] ${darkMode ? "text-red-400" : "text-red-600"}`}>
                      Measurements
                    </h3>

                    <div className={`mt-4 overflow-hidden rounded-xl border ${darkMode ? "border-slate-700 bg-[#122d42]" : "border-slate-200 bg-white"}`}>
                      <div className={`grid grid-cols-[1.7fr_0.9fr_0.9fr_0.8fr_0.7fr_1fr_1fr] gap-2 px-3 py-3 text-[11px] font-black uppercase tracking-[0.12em] ${darkMode ? "bg-[#0d2033] text-slate-300" : "bg-slate-100 text-slate-600"}`}>
                        <div>Product / Description</div>
                        <div>Width</div>
                        <div>Height</div>
                        <div>Unit</div>
                        <div>Qty</div>
                        <div>Price / Sqft</div>
                        <div>Total</div>
                      </div>

                      {(editInspection.items || []).map((item) => {
                        const rowSubtotal = calculateRowSubtotal(item);
                        return (
                          <div key={item.id || `${item.product_id || "row"}-${Math.random()}`} className={`grid grid-cols-[1.7fr_0.9fr_0.9fr_0.8fr_0.7fr_1fr_1fr] gap-2 border-t p-3 ${darkMode ? "border-slate-700" : "border-slate-200"}`}>
                            <div className="flex items-center gap-2">
                              <select
                                value={item.product_id || ""}
                                onChange={(e) => handleEditItemProductChange(item.id, e.target.value)}
                                className={darkMode ? "w-full rounded-lg border border-slate-600 bg-[#122d42] px-2 py-2 text-sm text-slate-100 outline-none focus:border-red-500" : "w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900 outline-none focus:border-red-500"}
                              >
                                <option value="">-- Select Product --</option>
                                {products.map((product) => (
                                  <option key={String(product._id || product.id)} value={String(product._id || product.id)}>{product.name}</option>
                                ))}
                              </select>
                            </div>

                            <input
                              type="number"
                              min="0"
                              value={item.width || 0}
                              onChange={(e) => handleEditItemFieldChange(item.id, "width", e.target.value)}
                              className={darkMode ? "w-full rounded-lg border border-slate-600 bg-[#122d42] px-2 py-2 text-sm text-slate-100 outline-none focus:border-red-500" : "w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900 outline-none focus:border-red-500"}
                            />

                            <input
                              type="number"
                              min="0"
                              value={item.height || 0}
                              onChange={(e) => handleEditItemFieldChange(item.id, "height", e.target.value)}
                              className={darkMode ? "w-full rounded-lg border border-slate-600 bg-[#122d42] px-2 py-2 text-sm text-slate-100 outline-none focus:border-red-500" : "w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900 outline-none focus:border-red-500"}
                            />

                            <div className={`flex items-center justify-center rounded-lg border px-2 py-2 text-sm font-medium ${darkMode ? "border-slate-600 bg-[#0d2033] text-slate-200" : "border-slate-200 bg-slate-100 text-slate-700"}`}>
                              {item.unit || "sqft"}
                            </div>

                            <input
                              type="number"
                              min="1"
                              value={item.qty || item.quantity || 1}
                              onChange={(e) => handleEditItemFieldChange(item.id, "qty", e.target.value)}
                              className={darkMode ? "w-full rounded-lg border border-slate-600 bg-[#122d42] px-2 py-2 text-sm text-slate-100 outline-none focus:border-red-500" : "w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900 outline-none focus:border-red-500"}
                            />

                            <div className={`flex items-center justify-center rounded-lg border px-2 py-2 text-sm font-bold ${darkMode ? "border-slate-600 bg-[#0d2033] text-slate-100" : "border-slate-200 bg-slate-100 text-slate-800"}`}>
                              {formatCurrency(Number(item.unit_price) || 0)}
                            </div>

                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-sm font-bold ${darkMode ? "text-slate-100" : "text-slate-800"}`}>
                                {formatCurrency(rowSubtotal)}
                              </span>
                              <button type="button" onClick={() => removeEditItemRow(item.id)} className="text-lg font-bold text-red-400 hover:text-red-300">
                                ×
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <button type="button" onClick={addEditItemRow} className={`rounded-[12px] border px-4 py-2 text-sm font-bold transition ${darkMode ? "border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20" : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"}`}>
                        + Add Row
                      </button>
                      <div className={`text-lg font-black ${darkMode ? "text-slate-100" : "text-slate-900"}`}>
                        Total: <span className="text-red-400">{formatCurrency(computeEditTotals().totalEstimate)}</span>
                      </div>
                    </div>
                  </section>

                  <section className={`rounded-2xl p-5 ${modalSectionClass}`}>
                    <h3 className={`mb-4 text-[13px] font-black uppercase tracking-[0.16em] ${darkMode ? "text-red-400" : "text-red-600"}`}>
                      Payment Information
                    </h3>

                    <div className={`mb-5 rounded-xl border px-4 py-3 text-sm font-medium ${darkMode ? "border-amber-500/30 bg-amber-500/10 text-amber-100" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                      <span className="mr-2 text-base">💡</span>
                      Business Policy: A 50% downpayment is required before project commences.
                    </div>

                    <div className="grid gap-5 md:grid-cols-2">
                      <div>
                        <label className={`mb-2 block text-[14px] font-bold ${labelClass}`}>Computed Total</label>
                        <div className={`rounded-xl border px-3 py-3 text-xl font-black ${darkMode ? "border-slate-600 bg-[#122d42] text-white" : "border-slate-200 bg-white text-slate-900"}`}>
                          {formatCurrency(computeEditTotals().totalEstimate)}
                        </div>
                      </div>

                      <div>
                        <label className={`mb-2 block text-[14px] font-bold ${labelClass}`}>Manual Override (optional)</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="Enter adjusted total..."
                          className={fieldClass}
                          value={editInspection.manual_override || ""}
                          onChange={(e) => handleEditChange("manual_override", e.target.value)}
                        />
                      </div>
                    </div>

                    <div className={`mt-5 rounded-xl border border-dashed px-4 py-4 ${darkMode ? "border-slate-600 bg-[#102838] text-slate-200" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
                      <div className="flex items-center justify-between gap-4 text-[14px] font-bold">
                        <span>Final Estimated Total</span>
                        <span className={`text-[18px] font-black ${darkMode ? "text-white" : "text-slate-900"}`}>
                          {formatCurrency(Number(editInspection.manual_override) || computeEditTotals().totalEstimate)}
                        </span>
                      </div>
                      <div className={`mt-3 flex items-center justify-between gap-4 border-t pt-3 text-[14px] font-bold ${darkMode ? "border-slate-700 text-red-400" : "border-slate-200 text-red-600"}`}>
                        <span>50% Downpayment Due</span>
                        <span className={`text-[18px] font-black ${darkMode ? "text-red-400" : "text-red-600"}`}>
                          {formatCurrency((Number(editInspection.manual_override) || computeEditTotals().totalEstimate) * 0.5)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-5 md:grid-cols-2">
                      <div>
                        <label className={`mb-2 block text-[14px] font-bold ${labelClass}`}>Payment Terms</label>
                        <select
                          className={fieldClass}
                          value={editInspection.payment_terms || ""}
                          onChange={(e) => handleEditChange("payment_terms", e.target.value)}
                        >
                          <option value="">Select Payment Terms</option>
                          <option value="50%_down_payment">50% Down Payment</option>
                          <option value="full_payment">Full Payment</option>
                        </select>
                      </div>

                      <div>
                        <label className={`mb-2 block text-[14px] font-bold ${labelClass}`}>Downpayment Received?</label>
                        <div className={`grid grid-cols-2 overflow-hidden rounded-xl border shadow-sm ${darkMode ? "border-slate-600 bg-[#122d42]" : "border-slate-200 bg-slate-50"}`}>
                        <button
                          type="button"
                          onClick={() => handleEditChange("downpayment_received", true)}
                          className={`flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold transition ${editInspection.downpayment_received ? (darkMode ? "bg-green-500/15 text-green-300" : "bg-green-50 text-green-700") : (darkMode ? "bg-[#122d42] text-slate-400" : "bg-white text-slate-500")}`}
                        >
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-green-400 bg-green-600 text-[10px] text-white">✓</span>
                          Yes, Paid
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditChange("downpayment_received", false)}
                          className={`flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold transition ${!editInspection.downpayment_received ? (darkMode ? "bg-slate-700 text-slate-100" : "bg-slate-200 text-slate-800") : (darkMode ? "bg-[#122d42] text-slate-400" : "bg-white text-slate-500")}`}
                        >
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-500 bg-slate-600 text-[10px] text-slate-100">×</span>
                          Not Yet
                        </button>
                      </div>
                    </div>

                    </div>
                  </section>
                </div>

                <div className={`flex shrink-0 justify-end gap-3 px-6 py-5 ${footerClass}`}>
                  <button
                    type="button"
                    onClick={() => setEditInspection(null)}
                    className={secondaryButtonClass}
                    disabled={savingEdit}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveEdit}
                    className={primaryButtonClass}
                    disabled={savingEdit}
                  >
                    {savingEdit ? "Saving..." : "Save Changes"}
                  </button>
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

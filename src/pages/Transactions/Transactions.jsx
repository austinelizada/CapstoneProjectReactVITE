import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  FileText,
  ShieldCheck,
  CheckCircle,
  Eye,
  Check,
  XCircle,
} from "lucide-react";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import toast, { Toaster } from "react-hot-toast";

import Sidebar from "../../components/layout/Sidebar";
import Navbar from "../../components/layout/Navbar";
import ContractModal from "../../components/ContractModal";
import { getAdminOrders, acceptContract, declineContract, updateOrderStatus } from "@/api/orders";
import { formatDateToMMDDYYYY, formatDateTimeToMMDDYYYY, getTodayIso, isTodayOrFuture, isSameOrAfter } from "@/lib/dateUtils";
import { useAuth } from "@/contexts/AuthContext";
import { recordActivity } from "@/lib/activityLog";

function Transactions() {
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] =
    useState(() => {
      if (typeof window === "undefined") return true;
      const stored = localStorage.getItem("sidebarOpen");
      return stored !== null ? JSON.parse(stored) : true;
    });

  const [activeTable, setActiveTable] =
    useState("receipts");

  const location = useLocation();

  useEffect(() => {
    if (location && location.state && location.state.activeTable) {
      setActiveTable(location.state.activeTable);
      try {
        window.history.replaceState({}, document.title);
      } catch (e) {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebarOpen", JSON.stringify(isSidebarOpen));
  }, [isSidebarOpen]);

  const [receiptPage, setReceiptPage] =
    useState(1);

  const [projectPage, setProjectPage] =
    useState(1);
  const [cancelledPage, setCancelledPage] =
    useState(1);
  const [warrantyInPage, setWarrantyInPage] = useState(1);
  const [warrantyOutPage, setWarrantyOutPage] = useState(1);
  const [tableSearch, setTableSearch] = useState("");

  useEffect(() => {
    setReceiptPage(1);
    setProjectPage(1);
    setCancelledPage(1);
    setWarrantyInPage(1);
    setWarrantyOutPage(1);
  }, [activeTable]);

  const rowsPerPage = 5;

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [processingOrderId, setProcessingOrderId] = useState(null);
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    action: "",
    order: null,
  });

  const [showContractModal, setShowContractModal] = useState(false);
  const [contractPreviewOrder, setContractPreviewOrder] = useState(null);
  const [contractPreviewData, setContractPreviewData] = useState(null);
  const [showWarrantyModal, setShowWarrantyModal] = useState(false);
  const [warrantyOrder, setWarrantyOrder] = useState(null);
  const [warrantyTerms, setWarrantyTerms] = useState("Standard parts and workmanship warranty for one year.");
  const [warrantyStartDate, setWarrantyStartDate] = useState("");
  const [warrantyExpiryDate, setWarrantyExpiryDate] = useState("");
  const [warrantySaving, setWarrantySaving] = useState(false);
  const today = getTodayIso();

  const canReviewTransaction = (order) => {
    const contractStatus = (order.contract_status || "").toString().toLowerCase();
    const orderStatus = (order.status || "").toString().toLowerCase();
    const acceptanceMethod = (order.acceptance_method || "").toString().toLowerCase();
    
    // Online: contract_status === "accepted" && status === "contract_accepted"
    // Walk-in: contract_status === "accepted" && acceptance_method === "walk_in_signed_contract"
    return contractStatus === "accepted" && (
      orderStatus === "contract_accepted" || 
      acceptanceMethod === "walk_in_signed_contract"
    );
  };

  const isCompletedProject = (order) => {
    const status = (order.status || "").toString().toLowerCase();
    const contractStatus = (order.contract_status || "").toString().toLowerCase();
    const progress = Number(order.progress || 0);
    const invalidStatuses = ["cancelled", "declined", "contract_declined", "rejected"];

    if (invalidStatuses.includes(status) || invalidStatuses.includes(contractStatus)) {
      return false;
    }

    return status === "completed" || progress >= 100;
  };

  // Warranty helpers
  const getCompletionDate = (order) => {
    // prefer an explicit completed timestamp, fallback to updatedAt when status === completed
    if (!order) return null;
    if (order.completed_at) return new Date(order.completed_at);
    if (order.completedAt) return new Date(order.completedAt);
    if ((order.status || "").toString().toLowerCase() === "completed") {
      return order.updatedAt ? new Date(order.updatedAt) : (order.createdAt ? new Date(order.createdAt) : null);
    }
    return null;
  };

  const parseWarrantyPeriod = (value) => {
    // Accepts strings like '1 year', '12 months', or numeric days
    if (!value) return null;
    if (typeof value === "number") return { days: value };
    const v = value.toString().toLowerCase();
    const yearMatch = v.match(/(\d+)\s*year/);
    if (yearMatch) return { days: Number(yearMatch[1]) * 365 };
    const monthMatch = v.match(/(\d+)\s*month/);
    if (monthMatch) return { days: Number(monthMatch[1]) * 30 };
    const daysMatch = v.match(/(\d+)\s*day/);
    if (daysMatch) return { days: Number(daysMatch[1]) };
    const n = Number(v);
    if (!isNaN(n)) return { days: n };
    return null;
  };

  const getWarrantyExpiry = (order) => {
    // Prefer explicit expiry field
    if (!order) return null;
    if (order.warranty_expiry_date) return new Date(order.warranty_expiry_date);
    if (order.warrantyExpiryDate) return new Date(order.warrantyExpiryDate);

    const completed = getCompletionDate(order);
    if (!completed) return null;

    // Check for warranty_period on order or items
    const period = order.warranty_period || order.warranty || order.warrantyPeriod || (order.items && order.items[0] && (order.items[0].warranty_period || order.items[0].warranty));
    const parsed = parseWarrantyPeriod(period);
    if (parsed && parsed.days) {
      const expiry = new Date(completed);
      expiry.setDate(expiry.getDate() + parsed.days);
      return expiry;
    }

    return null;
  };

  const hasWarrantyData = (order) => {
    if (!order) return false;
    return Boolean(
      order.warranty_expiry_date ||
      order.warrantyExpiryDate ||
      order.warranty_period ||
      order.warranty ||
      order.warrantyPeriod ||
      order.warranty_status
    );
  };

  const canCreateWarranty = (order) => isCompletedProject(order) && !hasWarrantyData(order);

  const computeWarrantyExpiryDate = (start, periodValue) => {
    const startDate = start ? new Date(start) : new Date();
    const parsed = parseWarrantyPeriod(periodValue) || { days: 365 };
    const expiry = new Date(startDate);
    expiry.setDate(expiry.getDate() + parsed.days);
    return expiry;
  };

  const openWarrantyModal = (order) => {
    const completionDate = getCompletionDate(order) || new Date();
    const defaultExpiry = order.warranty_expiry_date
      ? new Date(order.warranty_expiry_date)
      : computeWarrantyExpiryDate(completionDate, "1 year");

    setWarrantyOrder(order);
    setWarrantyTerms(order.warranty_terms || "Standard parts and workmanship warranty for one year.");
    setWarrantyStartDate(completionDate.toISOString().slice(0, 10));
    setWarrantyExpiryDate(defaultExpiry.toISOString().slice(0, 10));
    setShowWarrantyModal(true);
  };

  const closeWarrantyModal = () => {
    setShowWarrantyModal(false);
    setWarrantyOrder(null);
    setWarrantySaving(false);
    setWarrantyTerms("Standard parts and workmanship warranty for one year.");
    setWarrantyStartDate("");
    setWarrantyExpiryDate("");
  };

  const handleWarrantyStartDateChange = (value) => {
    setWarrantyStartDate(value);
    if (!warrantyExpiryDate || new Date(value) > new Date(warrantyExpiryDate)) {
      const expiry = computeWarrantyExpiryDate(new Date(value), "1 year");
      setWarrantyExpiryDate(expiry.toISOString().slice(0, 10));
    }
  };

  const handleWarrantyExpiryDateChange = (value) => {
    setWarrantyExpiryDate(value);
  };

  const formatWarrantyPeriodFromDates = (start, expiry) => {
    const startDate = start ? new Date(start) : null;
    const expiryDate = expiry ? new Date(expiry) : null;
    if (!startDate || !expiryDate || expiryDate <= startDate) return "";
    const diffDays = Math.ceil((expiryDate - startDate) / (1000 * 60 * 60 * 24));
    if (diffDays % 365 === 0) return `${diffDays / 365} year${diffDays / 365 === 1 ? "" : "s"}`;
    if (diffDays % 30 === 0) return `${diffDays / 30} month${diffDays / 30 === 1 ? "" : "s"}`;
    return `${diffDays} day${diffDays === 1 ? "" : "s"}`;
  };

  const handleCreateWarranty = async () => {
    if (!warrantyOrder) return;
    setWarrantySaving(true);
    const orderId = warrantyOrder._id || warrantyOrder.id;
    try {
      const start = warrantyStartDate ? new Date(warrantyStartDate) : getCompletionDate(warrantyOrder) || new Date();
      const expiry = warrantyExpiryDate ? new Date(warrantyExpiryDate) : computeWarrantyExpiryDate(start, "1 year");
      if (!isTodayOrFuture(start)) {
        toast.error("Invalid date selection. Please select today or a future date.");
        setWarrantySaving(false);
        return;
      }
      if (!isSameOrAfter(expiry, start) || expiry.getTime() === start.getTime()) {
        toast.error("Warranty End Date must be later than the Warranty Start Date.");
        setWarrantySaving(false);
        return;
      }
      const payload = {
        warranty_period: formatWarrantyPeriodFromDates(start, expiry),
        warranty_start_date: start.toISOString(),
        warranty_expiry_date: expiry.toISOString(),
        warranty_status: "active",
        warranty_terms: warrantyTerms,
      };

      const response = await updateOrderStatus(orderId, payload);
      recordActivity(user, `Created warranty for order ${orderId}.`, "Transactions");
      const updated = response?.order || {};
      updateOrderLocally(orderId, {
        ...updated,
        ...payload,
      });
      toast.success("Warranty created successfully.");
      closeWarrantyModal();
    } catch (error) {
      console.error("Create warranty failed", error);
      toast.error(error?.data?.message || error?.message || "Unable to create warranty.");
    } finally {
      setWarrantySaving(false);
    }
  };

  const openTransactionConfirm = (action, order) => {
    setConfirmModal({ open: true, action, order });
  };

  const closeTransactionConfirm = () => {
    setConfirmModal({ open: false, action: "", order: null });
  };

  const updateOrderLocally = (orderId, patch) => {
    setOrders((prev) =>
      prev.map((order) =>
        order._id === orderId || order.id === orderId
          ? { ...order, ...patch }
          : order
      )
    );
  };

  const handleApproveTransaction = async (orderId) => {
    setActionLoading(true);
    setProcessingOrderId(orderId);
    try {
      const order = orders.find(
        (o) => o._id === orderId || o.id === orderId
      );
      const status = (order?.contract_status || "").toString().toLowerCase();
      if (status !== "accepted") {
        toast.error("Only contracts with status 'Accepted' can be approved.");
        return;
      }
      // Use admin endpoint to change order status (admin has permission)
      // contract_status must match schema enums (pending, sent, accepted, declined)
      const response = await updateOrderStatus(orderId, { status: "approved", contract_status: "accepted" });
      recordActivity(user, `Approved transaction ${orderId}.`, "Transactions");
      const updated = response?.order || {};
      const now = new Date().toISOString();
      updateOrderLocally(orderId, {
        ...updated,
        contract_status: updated.contract_status || "accepted",
        approved_at: updated.approved_at || now,
        status: updated.status || "approved",
      });
      toast.success("Transaction approved successfully. Project has been moved to Progress Monitor.");
    } catch (error) {
      console.error("Approve transaction failed", error);
      toast.error(error?.data?.message || error?.message || "Unable to approve transaction.");
    } finally {
      setActionLoading(false);
      setProcessingOrderId(null);
      closeTransactionConfirm();
    }
  };

  const handleRejectTransaction = async (orderId) => {
    setActionLoading(true);
    setProcessingOrderId(orderId);
    try {
      // Use admin endpoint to mark contract as declined/cancelled
      const response = await updateOrderStatus(orderId, { contract_status: "declined", status: "cancelled" });
      recordActivity(user, `Cancelled transaction ${orderId}.`, "Transactions");
      const updated = response?.order || {};
      const now = new Date().toISOString();
      updateOrderLocally(orderId, {
        ...updated,
        contract_status: updated.contract_status || "declined",
        rejected_at: updated.rejected_at || now,
        status: updated.status || "cancelled",
      });
      toast.success("Transaction cancelled successfully.");
    } catch (error) {
      console.error("Cancel transaction failed", error);
      toast.error(error?.data?.message || error?.message || "Unable to cancel transaction.");
    } finally {
      setActionLoading(false);
      setProcessingOrderId(null);
      closeTransactionConfirm();
    }
  };

  const handleConfirmTransactionAction = async () => {
    if (!confirmModal.order || !confirmModal.action) return;
    const orderId = confirmModal.order._id || confirmModal.order.id;
    if (confirmModal.action === "approve") {
      await handleApproveTransaction(orderId);
    } else if (confirmModal.action === "reject") {
      await handleRejectTransaction(orderId);
    }
  };

  const buildContractDataFromOrder = (order) => {
    if (!order) return null;

    const amount = Number(order.contract_amount || order.total_amount || 0);
    const downPayment = Math.round((amount * 0.5) * 100) / 100;
    const items = (order.items || []).map((item) => ({
      name: item.name || "Item",
      category: item.category || item.product_type || "General",
      quantity: item.quantity || 0,
      width: item.width || "—",
      height: item.height || "—",
      area: item.area || 0,
      unitPrice: Number(item.unit_price || 0),
      amount: Number(item.is_estimate ? item.estimated_price || 0 : (item.quantity || 0) * Number(item.unit_price || 0)),
    }));

    const contractStatus = order.contract_status?.replace(/_/g, " ") || order.status?.replace(/_/g, " ") || "Pending";
    const accepted = (order.contract_status || order.status || "").toString().toLowerCase() === "accepted" || order.status === "contract_accepted";

    return {
      orderNumber: order.tracking || order._id || "N/A",
      contractDate: order.updatedAt ? formatDateToMMDDYYYY(order.updatedAt) : formatDateToMMDDYYYY(order.createdAt),
      orderDate: order.createdAt ? formatDateToMMDDYYYY(order.createdAt) : "N/A",
      status: order.status?.replace(/_/g, " ") || "Pending",
      contractStatus,
      customerName: order.customer?.first_name || order.customer_name || "Customer",
      customerEmail: order.customer?.email || order.customer_email || "N/A",
      customerPhone: order.customer?.phone || order.customer_phone || "N/A",
      projectLocation: order.shipping_address || "N/A",
      siteInspectionDate: order.inspection_date ? formatDateToMMDDYYYY(order.inspection_date) : "TBD",
      paymentTerms: order.payment_terms || "Standard payment terms apply.",
      contractTerms: order.contract_terms || "",
      subtotal: amount,
      totalProjectCost: amount,
      downPayment,
      items,
      accepted,
      acceptanceMethod: accepted ? "Online Acceptance" : null,
      acceptanceDate: accepted && order.updatedAt ? formatDateTimeToMMDDYYYY(order.updatedAt) : null,
      acceptedBy: order.customer?.first_name || order.customer_name || "Customer",
      contractId: order.tracking || order._id || "N/A",
      customerAccountId: order.customer?._id || order.customer || "N/A",
    };
  };

  const openContractModal = (order) => {
    if (!order) return;
    const data = buildContractDataFromOrder(order);
    setContractPreviewOrder(order);
    setContractPreviewData(data);
    setShowContractModal(true);
  };

  const closeContractModal = () => {
    setShowContractModal(false);
    setContractPreviewOrder(null);
    setContractPreviewData(null);
  };

  const createPrintClone = (el) => {
    const clone = el.cloneNode(true);
    clone.style.width = `${el.scrollWidth}px`;
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

  const printContract = async () => {
    const el = document.getElementById("contract-content");
    if (!el) {
      toast.error("Unable to locate contract content for printing.");
      return;
    }

    const { wrapper, clone } = createPrintClone(el);
    try {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const dataUrl = await toPng(clone, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });

      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        toast.error("Please allow popups to print the contract.");
        return;
      }

      printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Contract Print</title><style>html,body{margin:0;padding:0;background:#fff;}body{padding:12mm;}img{width:100%;height:auto;display:block;}@media print{body{padding:0;}.no-print{display:none !important;}}</style></head><body><img src="${dataUrl}" alt="Contract" /></body></html>`);
      printWindow.document.close();
      printWindow.focus();

      printWindow.onload = () => {
        printWindow.print();
      };
    } catch (err) {
      console.error("Failed to prepare contract for printing", err);
      toast.error("Failed to print contract.");
    } finally {
      if (wrapper?.parentNode) document.body.removeChild(wrapper);
    }
  };

  const downloadContractPDF = async () => {
    const el = document.getElementById("contract-content");
    if (!el) {
      toast.error("Unable to locate contract content for PDF export.");
      return;
    }

    const { wrapper, clone } = createPrintClone(el);
    try {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const dataUrl = await toPng(clone, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });

      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(dataUrl);
      const imgWidth = pdfWidth;
      const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(dataUrl, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position -= pdfHeight;
        pdf.addPage();
        pdf.addImage(dataUrl, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`contract-${contractPreviewOrder?.tracking || contractPreviewOrder?._id || "export"}.pdf`);
    } catch (err) {
      console.error("Failed to export contract PDF", err);
      toast.error("Failed to download contract as PDF.");
    } finally {
      if (wrapper.parentNode) document.body.removeChild(wrapper);
    }
  };

  const downloadContractPNG = async () => {
    const el = document.getElementById("contract-content");
    if (!el) {
      toast.error("Unable to locate contract content for PNG export.");
      return;
    }

    const clone = el.cloneNode(true);
    clone.style.width = `${el.scrollWidth}px`;
    clone.style.height = "auto";
    clone.style.overflow = "visible";
    clone.style.position = "relative";
    clone.style.maxHeight = "none";

    const wrapper = document.createElement("div");
    wrapper.style.position = "fixed";
    wrapper.style.left = "-9999px";
    wrapper.style.top = "0";
    wrapper.style.opacity = "0";
    wrapper.style.pointerEvents = "none";
    wrapper.appendChild(clone);

    document.body.appendChild(wrapper);

    try {
      await new Promise((resolve) => setTimeout(resolve, 50));
      const dataUrl = await toPng(clone, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `contract-${contractPreviewOrder?.tracking || contractPreviewOrder?._id || "export"}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to export contract PNG", err);
      toast.error("Failed to download contract as PNG.");
    } finally {
      document.body.removeChild(wrapper);
    }
  };

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      try {
        const res = await getAdminOrders();
        if (res && res.orders) {
          setOrders(res.orders);
        }
      } catch (err) {
        console.error("Failed to fetch orders", err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  // Receipts & Contracts: orders that have a contract and are not cancelled/declined
  const receipts = orders.filter((o) => {
    const status = (o.contract_status || "").toString().toLowerCase();
    const cancelledStatuses = ["declined", "rejected", "cancelled", "contract_declined"];
    return (
      o.contract_status &&
      o.contract_status !== "pending" &&
      !cancelledStatuses.includes(status) &&
      !isCompletedProject(o)
    );
  });

  const filteredReceipts = receipts.filter((o) => {
    if (!tableSearch) return true;
    const q = tableSearch.toLowerCase();
    const customer = (o.customer_name || o.customer?.first_name || "").toString().toLowerCase();
    const project = (o.items?.[0]?.name || "").toString().toLowerCase();
    const tracking = (o.tracking || "").toString().toLowerCase();
    return tracking.includes(q) || customer.includes(q) || project.includes(q);
  });

  const cancelledTransactions = orders.filter((o) => {
    const contractStatus = (o.contract_status || "").toString().toLowerCase();
    const status = (o.status || "").toString().toLowerCase();
    return ["declined", "rejected", "cancelled", "contract_declined"].includes(contractStatus) || status === "cancelled";
  });

  // Completed projects: orders that are completed by status or progress
  const completedProjects = orders.filter((o) => isCompletedProject(o));

  // Warranty classification
  const inWarrantyProjects = orders.filter((o) => {
    const warrantyStatus = (o.warranty_status || "").toString().toLowerCase();
    if (warrantyStatus === "active") return true;
    const expiry = getWarrantyExpiry(o);
    if (!expiry) return false;
    const now = new Date();
    return now <= expiry;
  });

  const outOfWarrantyProjects = orders.filter((o) => {
    const warrantyStatus = (o.warranty_status || "").toString().toLowerCase();
    if (warrantyStatus === "expired") return true;
    const expiry = getWarrantyExpiry(o);
    if (!expiry) return false;
    const now = new Date();
    return now > expiry;
  });

  const receiptLastIndex =
    receiptPage * rowsPerPage;

  const receiptFirstIndex =
    receiptLastIndex - rowsPerPage;

  const currentReceipts = filteredReceipts.slice(
    receiptFirstIndex,
    receiptLastIndex
  );

  const receiptTotalPages = Math.max(1, Math.ceil(
    filteredReceipts.length / rowsPerPage
  ));

  const projectLastIndex =
    projectPage * rowsPerPage;

  const projectFirstIndex =
    projectLastIndex - rowsPerPage;

  const currentProjects =
    completedProjects.slice(
      projectFirstIndex,
      projectLastIndex
    );

  const projectTotalPages = Math.max(1, Math.ceil(
    completedProjects.length / rowsPerPage
  ));

  const filteredCompleted = completedProjects.filter((o) => {
    if (!tableSearch) return true;
    const q = tableSearch.toLowerCase();
    const customer = (o.customer_name || o.customer?.first_name || "").toString().toLowerCase();
    const project = (o.items?.[0]?.name || "").toString().toLowerCase();
    const tracking = (o.tracking || "").toString().toLowerCase();
    return tracking.includes(q) || customer.includes(q) || project.includes(q);
  });

  const currentProjectsFiltered = filteredCompleted.slice(projectFirstIndex, projectLastIndex);

  const projectTotalPagesFiltered = Math.max(1, Math.ceil(filteredCompleted.length / rowsPerPage));

  const warrantyInLastIndex = warrantyInPage * rowsPerPage;
  const warrantyInFirstIndex = warrantyInLastIndex - rowsPerPage;
  const filteredInWarranty = inWarrantyProjects.filter((o) => {
    if (!tableSearch) return true;
    const q = tableSearch.toLowerCase();
    const customer = (o.customer_name || o.customer?.first_name || "").toString().toLowerCase();
    const project = (o.items?.[0]?.name || "").toString().toLowerCase();
    const tracking = (o.tracking || "").toString().toLowerCase();
    return tracking.includes(q) || customer.includes(q) || project.includes(q);
  });
  const currentInWarranty = filteredInWarranty.slice(warrantyInFirstIndex, warrantyInLastIndex);
  const warrantyInTotalPages = Math.max(1, Math.ceil(filteredInWarranty.length / rowsPerPage));

  const warrantyOutLastIndex = warrantyOutPage * rowsPerPage;
  const warrantyOutFirstIndex = warrantyOutLastIndex - rowsPerPage;
  const filteredOutWarranty = outOfWarrantyProjects.filter((o) => {
    if (!tableSearch) return true;
    const q = tableSearch.toLowerCase();
    const customer = (o.customer_name || o.customer?.first_name || "").toString().toLowerCase();
    const project = (o.items?.[0]?.name || "").toString().toLowerCase();
    const tracking = (o.tracking || "").toString().toLowerCase();
    return tracking.includes(q) || customer.includes(q) || project.includes(q);
  });
  const currentOutWarranty = filteredOutWarranty.slice(warrantyOutFirstIndex, warrantyOutLastIndex);
  const warrantyOutTotalPages = Math.max(1, Math.ceil(filteredOutWarranty.length / rowsPerPage));

  const cancelledLastIndex =
    cancelledPage * rowsPerPage;

  const cancelledFirstIndex =
    cancelledLastIndex - rowsPerPage;

  const currentCancelled =
    cancelledTransactions.slice(
      cancelledFirstIndex,
      cancelledLastIndex
    );

  const cancelledTotalPages = Math.max(1, Math.ceil(
    cancelledTransactions.length / rowsPerPage
  ));

  const filteredCancelled = cancelledTransactions.filter((o) => {
    if (!tableSearch) return true;
    const q = tableSearch.toLowerCase();
    const customer = (o.customer_name || o.customer?.first_name || "").toString().toLowerCase();
    const project = (o.items?.[0]?.name || "").toString().toLowerCase();
    const tracking = (o.tracking || "").toString().toLowerCase();
    return tracking.includes(q) || customer.includes(q) || project.includes(q);
  });

  const currentCancelledFiltered = filteredCancelled.slice(cancelledFirstIndex, cancelledLastIndex);

  const cancelledTotalPagesFiltered = Math.max(1, Math.ceil(filteredCancelled.length / rowsPerPage));

  const currentData =
    activeTable === "receipts"
      ? currentReceipts
      : activeTable === "projects"
      ? currentProjectsFiltered
      : activeTable === "warranty_in"
      ? currentInWarranty
      : activeTable === "warranty_out"
      ? currentOutWarranty
      : currentCancelledFiltered;

  const currentFirstIndex =
    activeTable === "receipts"
      ? receiptFirstIndex
      : activeTable === "projects"
      ? projectFirstIndex
      : activeTable === "warranty_in"
      ? warrantyInFirstIndex
      : activeTable === "warranty_out"
      ? warrantyOutFirstIndex
      : cancelledFirstIndex;

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

          <div className="bg-gradient-to-r from-red-700 via-red-600 to-orange-500 text-white rounded-3xl p-8 shadow-lg">
            <h1 className="text-3xl font-bold">
              Transactions
            </h1>

            <p className="mt-2 text-red-100">
              Manage receipts, contracts and
              completed projects.
            </p>
          </div>

          <div className="flex gap-4 mt-6 flex-wrap">

            <button
              onClick={() => setActiveTable("receipts")}
              className={`px-5 py-3 rounded-xl font-medium ${
                activeTable === "receipts" ? "bg-red-600 text-white" : "bg-white border"
              }`}
            >
              <FileText className="inline mr-2" size={18} />
              Receipts & Contracts
            </button>

            <button
              onClick={() => setActiveTable("projects")}
              className={`px-5 py-3 rounded-xl font-medium ${
                activeTable === "projects" ? "bg-red-600 text-white" : "bg-white border"
              }`}
            >
              <CheckCircle className="inline mr-2" size={18} />
              Completed Projects
            </button>

            <button
              onClick={() => setActiveTable("warranty_in")}
              className={`px-5 py-3 rounded-xl font-medium ${
                activeTable === "warranty_in" ? "bg-red-600 text-white" : "bg-white border"
              }`}
            >
              <CheckCircle className="inline mr-2" size={18} />
              In-Warranty
            </button>

            <button
              onClick={() => setActiveTable("warranty_out")}
              className={`px-5 py-3 rounded-xl font-medium ${
                activeTable === "warranty_out" ? "bg-red-600 text-white" : "bg-white border"
              }`}
            >
              <XCircle className="inline mr-2" size={18} />
              Out-of-Warranty
            </button>

           <button
              onClick={() => setActiveTable("cancelled")}
              className={`px-5 py-3 rounded-xl font-medium ${
                activeTable === "cancelled" ? "bg-red-600 text-white" : "bg-white border"
              }`}
            >
              <XCircle className="inline mr-2" size={18} />
              Cancelled Transactions
            </button>

          </div>

          <div className="mt-4">
            <input
              type="text"
              placeholder="Search tracking, customer, project..."
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              className="w-full md:w-1/3 pl-3 pr-3 py-2 border rounded-lg"
            />
          </div>

          <div className="bg-white rounded-3xl shadow mt-6 overflow-hidden">

            <div className="overflow-x-auto">

              <table className="w-full">

                <thead className="bg-gray-50">
                  {activeTable === "warranty_in" || activeTable === "warranty_out" ? (
                    <tr>
                      <th className="w-16 p-4 text-center">No.</th>
                      <th className="p-4 text-left">Tracking ID</th>
                      <th className="p-4 text-left">Customer Name</th>
                      <th className="p-4 text-left">Project Name</th>
                      <th className="p-4 text-left">Completion Date</th>
                      <th className="p-4 text-left">Warranty Expiry</th>
                      <th className="p-4 text-left">{activeTable === "warranty_in" ? "Remaining Days" : "Expired Since"}</th>
                      <th className="p-4 text-left">Status</th>
                      <th className="p-4 text-center">Actions</th>
                    </tr>
                  ) : (
                    <tr>
                      <th className="w-16 p-4 text-center">No.</th>
                      <th className="p-4 text-left">Tracking ID</th>
                      <th className="p-4 text-left">Customer</th>
                      <th className="p-4 text-left">Client Type</th>
                      <th className="p-4 text-left">Inspection</th>
                      <th className="p-4 text-left">Date</th>
                      <th className="p-4 text-left">Amount</th>
                      <th className="p-4 text-left">Status</th>
                      <th className="p-4 text-center">Actions</th>
                    </tr>
                  )}
                </thead>

                <tbody>

                  {currentData.map((order, index) => {
                    const now = new Date();
                    const customerName = order.customer_name || (order.customer ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() : "N/A");
                    const projectName = order.items && order.items.length > 0 ? (order.items[0].name || `${order.items.length} item(s)`) : "N/A";
                    const amountVal = order.contract_amount || order.total_amount || 0;
                    const amount = `₱${Number(amountVal || 0).toLocaleString()}`;
                    const inspectionLabel = order.items && order.items.length > 0 ? (order.items[0].name || `${order.items.length} item(s)`) : "N/A";
                    const orderType = (order.acceptance_method || order.order_type || "Online").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                    const completionDate = getCompletionDate(order);
                    const completionLabel = completionDate ? formatDateToMMDDYYYY(completionDate) : "N/A";
                    const expiry = getWarrantyExpiry(order);
                    const expiryLabel = expiry ? formatDateToMMDDYYYY(expiry) : "N/A";
                    const msPerDay = 1000 * 60 * 60 * 24;
                    const remainingDays = expiry ? Math.ceil((expiry - now) / msPerDay) : null;
                    const expiredDays = expiry ? Math.ceil((now - expiry) / msPerDay) : null;
                    const statusLabel = activeTable === "receipts"
                      ? ((order.status === "contract_accepted" || (order.acceptance_method || "").toString().toLowerCase() === "walk_in_signed_contract") && (order.contract_status || "").toString().toLowerCase() === "accepted")
                        ? "Contract Accepted — Waiting for Transaction Approval"
                        : order.status === "approved"
                        ? "Approved"
                        : order.contract_status?.replace(/_/g, " ") || "Pending"
                      : (order.status?.replace(/_/g, " ") || "N/A");

                    return (
                      <tr key={order._id || index} className="border-t hover:bg-gray-50">
                        <td className="w-16 p-4 text-center font-semibold text-slate-600">{currentFirstIndex + index + 1}</td>

                        { (activeTable === "warranty_in" || activeTable === "warranty_out") ? (
                          <>
                            <td className="p-4">{order.tracking}</td>
                            <td className="p-4">{customerName}</td>
                            <td className="p-4">{projectName}</td>
                            <td className="p-4">{completionLabel}</td>
                            <td className="p-4">{expiryLabel}</td>
                            <td className="p-4">{
                              activeTable === "warranty_in"
                                ? (remainingDays !== null ? `${remainingDays} day${remainingDays === 1 ? '' : 's'} remaining` : 'N/A')
                                : (expiredDays !== null ? `Expired ${expiredDays} day${expiredDays === 1 ? '' : 's'} ago` : 'N/A')
                            }</td>
                            <td className="p-4">
                              <span className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold bg-amber-100 text-amber-700">
                                {activeTable === "warranty_in" ? (
                                  remainingDays !== null ? (
                                    remainingDays > 30 ? 'Active Warranty' : remainingDays > 1 ? 'Warranty Expiring Soon' : remainingDays === 1 ? 'Warranty Ends Tomorrow' : remainingDays === 0 ? 'Ends Today' : 'Active'
                                  ) : (order.warranty_status || 'Active')
                                ) : (
                                  order.warranty_status ? (order.warranty_status.replace(/_/g, ' ') ) : 'Expired'
                                )}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-wrap justify-center gap-2">
                                <button title="View Transaction" onClick={() => openContractModal(order)} className="p-2 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition"><Eye size={18} /></button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="p-4">{order.tracking}</td>
                            <td className="p-4">{customerName}</td>
                            <td className="p-4">{orderType}</td>
                            <td className="p-4">{inspectionLabel}</td>
                            <td className="p-4">{order.createdAt ? formatDateToMMDDYYYY(order.createdAt) : (order.inspection_date ? formatDateToMMDDYYYY(order.inspection_date) : 'N/A')}</td>
                            <td className="p-4 font-semibold text-green-600">{amount}</td>
                            <td className="p-4"><span className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold bg-amber-100 text-amber-700">{statusLabel}</span></td>
                            <td className="p-4"><div className="flex flex-wrap justify-center gap-2">{activeTable === "receipts" && canReviewTransaction(order) && (<><button title="Approve Transaction" onClick={() => openTransactionConfirm("approve", order)} disabled={processingOrderId === (order._id || order.id)} className="p-2 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition disabled:opacity-60 disabled:cursor-not-allowed"><Check size={18} /></button><button title="Cancel Transaction" onClick={() => openTransactionConfirm("reject", order)} disabled={processingOrderId === (order._id || order.id)} className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition disabled:opacity-60 disabled:cursor-not-allowed"><XCircle size={20} /></button></>)}{activeTable === "projects" && canCreateWarranty(order) && (<button title="Create Warranty" onClick={() => openWarrantyModal(order)} className="p-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition"><ShieldCheck size={20} /></button>)}<button title="View Transaction" onClick={() => openContractModal(order)} className="p-2 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition"><Eye size={18} /></button> </div></td>
                          </>
                        )}

                      </tr>
                    );
                  })}

                </tbody>

              </table>

            </div>

            {/* Pagination */}

            <div className="flex justify-center items-center p-4 border-t bg-gray-50 gap-4">

              <span className="text-sm text-gray-600">
                Page {" "}
                {activeTable === "receipts"
                  ? receiptPage
                  : activeTable === "projects"
                  ? projectPage
                  : activeTable === "warranty_in"
                  ? warrantyInPage
                  : activeTable === "warranty_out"
                  ? warrantyOutPage
                  : cancelledPage}
                {" "}of{" "}
                {activeTable === "receipts"
                  ? receiptTotalPages
                  : activeTable === "projects"
                  ? projectTotalPagesFiltered
                  : activeTable === "warranty_in"
                  ? warrantyInTotalPages
                  : activeTable === "warranty_out"
                  ? warrantyOutTotalPages
                  : cancelledTotalPagesFiltered}
              </span>

              <div className="flex gap-2">

                <button
                  disabled={
                    activeTable === "receipts"
                      ? receiptPage === 1
                      : activeTable === "projects"
                      ? projectPage === 1
                      : activeTable === "warranty_in"
                      ? warrantyInPage === 1
                      : activeTable === "warranty_out"
                      ? warrantyOutPage === 1
                      : cancelledPage === 1
                  }
                  onClick={() => {
                    if (activeTable === "receipts") {
                      setReceiptPage(receiptPage - 1);
                    } else if (activeTable === "projects") {
                      setProjectPage(projectPage - 1);
                    } else if (activeTable === "warranty_in") {
                      setWarrantyInPage(warrantyInPage - 1);
                    } else if (activeTable === "warranty_out") {
                      setWarrantyOutPage(warrantyOutPage - 1);
                    } else {
                      setCancelledPage(cancelledPage - 1);
                    }
                  }}
                  className="px-4 py-2 border rounded-lg"
                >
                  Previous
                </button>

                {[...Array(
                  activeTable === "receipts"
                    ? receiptTotalPages
                    : activeTable === "projects"
                    ? projectTotalPagesFiltered
                    : activeTable === "warranty_in"
                    ? warrantyInTotalPages
                    : activeTable === "warranty_out"
                    ? warrantyOutTotalPages
                    : cancelledTotalPagesFiltered
                )].map((_, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      if (activeTable === "receipts") {
                        setReceiptPage(index + 1);
                      } else if (activeTable === "projects") {
                        setProjectPage(index + 1);
                      } else if (activeTable === "warranty_in") {
                        setWarrantyInPage(index + 1);
                      } else if (activeTable === "warranty_out") {
                        setWarrantyOutPage(index + 1);
                      } else {
                        setCancelledPage(index + 1);
                      }
                    }}
                    className={`w-10 h-10 rounded-lg ${
                      (
                        activeTable === "receipts"
                          ? receiptPage
                          : activeTable === "projects"
                          ? projectPage
                          : activeTable === "warranty_in"
                          ? warrantyInPage
                          : activeTable === "warranty_out"
                          ? warrantyOutPage
                          : cancelledPage
                      ) === index + 1
                        ? "bg-red-600 text-white"
                        : "bg-white border"
                    }`}
                  >
                    {index + 1}
                  </button>
                ))}

                <button
                  disabled={
                    activeTable === "receipts"
                      ? receiptPage === receiptTotalPages
                      : activeTable === "projects"
                      ? projectPage === projectTotalPagesFiltered
                      : activeTable === "warranty_in"
                      ? warrantyInPage === warrantyInTotalPages
                      : activeTable === "warranty_out"
                      ? warrantyOutPage === warrantyOutTotalPages
                      : cancelledPage === cancelledTotalPagesFiltered
                  }
                  onClick={() => {
                    if (activeTable === "receipts") {
                      setReceiptPage(receiptPage + 1);
                    } else if (activeTable === "projects") {
                      setProjectPage(projectPage + 1);
                    } else if (activeTable === "warranty_in") {
                      setWarrantyInPage(warrantyInPage + 1);
                    } else if (activeTable === "warranty_out") {
                      setWarrantyOutPage(warrantyOutPage + 1);
                    } else {
                      setCancelledPage(cancelledPage + 1);
                    }
                  }}
                  className="px-4 py-2 border rounded-lg"
                >
                  Next
                </button>

              </div>

            </div>

          </div>

          <Toaster position="bottom-right" />

          {showContractModal && (
            <ContractModal
              isOpen={showContractModal}
              onClose={closeContractModal}
              inspection={contractPreviewOrder}
              contractData={contractPreviewData}
              isLoading={false}
              onDownload={downloadContractPDF}
              onDownloadPNG={downloadContractPNG}
              onPrint={printContract}
            />
          )}

          {showWarrantyModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/40" onClick={closeWarrantyModal} />
              <div className="relative w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl">
                <h2 className="text-2xl font-bold text-slate-900 mb-3">Create Warranty</h2>
                <p className="text-sm text-slate-600 mb-6">
                  Create warranty coverage for this completed project and store the start and expiry dates.
                </p>

                <div className="grid gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Customer</label>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800">
                      {warrantyOrder?.customer_name || `${warrantyOrder?.customer?.first_name || ''} ${warrantyOrder?.customer?.last_name || ''}`.trim() || "N/A"}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Project</label>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800">
                      {warrantyOrder?.items?.[0]?.name || "N/A"}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Warranty Start</label>
                      <input
                        type="date"
                        min={today}
                        value={warrantyStartDate}
                        onChange={(e) => handleWarrantyStartDateChange(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-4 py-2"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Warranty Expiry</label>
                      <input
                        type="date"
                        min={warrantyStartDate || today}
                        value={warrantyExpiryDate}
                        onChange={(e) => handleWarrantyExpiryDateChange(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-4 py-2"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Terms</label>
                    <textarea
                      rows={4}
                      value={warrantyTerms}
                      onChange={(e) => setWarrantyTerms(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3"
                    />
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeWarrantyModal}
                    className="rounded-2xl px-5 py-3 bg-gray-100 text-slate-700 hover:bg-gray-200 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateWarranty}
                    disabled={warrantySaving}
                    className={`rounded-2xl px-5 py-3 text-white transition ${warrantySaving ? "bg-amber-300" : "bg-amber-600 hover:bg-amber-700"}`}
                  >
                    {warrantySaving ? "Saving..." : "Create Warranty"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {confirmModal.open && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/40" onClick={closeTransactionConfirm} />
              <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">
                  {confirmModal.action === "approve" ? "Approve Transaction" : "Cancel Transaction"}
                </h2>
                <p className="text-sm text-slate-600 leading-6">
                  {confirmModal.action === "approve"
                    ? "Are you sure you want to approve this contract/receipt? This action will mark the transaction as approved and proceed to the next stage of the workflow."
                    : "Are you sure you want to cancel this contract/receipt? This action will stop the current transaction process."}
                </p>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeTransactionConfirm}
                    className="rounded-2xl px-4 py-2 bg-gray-100 text-slate-700 hover:bg-gray-200 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmTransactionAction}
                    disabled={actionLoading}
                    className={`rounded-2xl px-4 py-2 disabled:opacity-60 disabled:cursor-not-allowed transition ${
                      confirmModal.action === "reject"
                        ? "bg-red-600 text-white hover:bg-red-700"
                        : "bg-green-600 text-white hover:bg-green-700"
                    }`}
                  >
                    {actionLoading
                      ? confirmModal.action === "approve"
                        ? "Approving..."
                        : "Rejecting..."
                      : confirmModal.action === "approve"
                        ? "Confirm Approve"
                        : "Confirm"}
                  </button>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

export default Transactions;

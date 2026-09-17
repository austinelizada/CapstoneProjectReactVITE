import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardCheck,
  FolderOpen,
  ShieldCheck,
  Package,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { getOrders, getAdminOrders, getAdminOrder, updateOrderStatus } from "@/api/orders";
import { formatDateToMMDDYYYY } from "@/lib/dateUtils";
import { recordActivity } from "@/lib/activityLog";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminTheme } from "@/contexts/AdminThemeContext";

const normalizeAddress = (value) => {
  if (!value) return "";
  const cleaned = value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[,;]+/g, ",")
    .replace(/\s*[.,]\s*/g, ", ")
    .replace(/\s*,\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const canonical = (text) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .replace(/\b(city|province|zip|code|street|st|road|rd)\b/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const parts = cleaned
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const normalizedParts = [];
  const seen = [];

  for (const part of parts) {
    const key = canonical(part);
    if (!key) {
      normalizedParts.push(part);
      continue;
    }
    const isDuplicate = seen.some(
      (existing) => existing === key || existing.includes(key) || key.includes(existing)
    );
    if (!isDuplicate) {
      seen.push(key);
      normalizedParts.push(part);
    }
  }

  return normalizedParts.join(", ");
};

const getCustomerAddress = (customer) => {
  if (!customer) return "";
  return normalizeAddress(
    [customer.street_address, customer.city, customer.province, customer.zip_code]
      .filter(Boolean)
      .join(", ")
  );
};

const formatCurrency = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return `₱${amount.toLocaleString(undefined, {
    minimumFractionDigits: amount % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
};

const titleCase = (value) => {
  if (!value) return "—";
  return String(value)
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

const getOrderItemProduct = (item) => {
  if (!item?.product_id || typeof item.product_id !== "object") return {};
  return item.product_id;
};

const getOrderItemName = (item) => {
  const product = getOrderItemProduct(item);
  return item?.name || product.name || product.product_name || "Project Item";
};

const getOrderItemType = (item) => {
  const product = getOrderItemProduct(item);
  return titleCase(item?.product_type || item?.category || product.product_type || product.category);
};

const getOrderItemDimensions = (item) => {
  const dims = item?.dimensions || {};
  const width = Number(item?.width ?? dims.width) || 0;
  const height = Number(item?.height ?? dims.height) || 0;
  if (!width && !height) return "—";
  const unit = item?.measurement_unit || item?.measurementUnit || dims.unit || "in";
  const customized = Boolean(item?.customized ?? dims.customized);
  const separator = " × ";
  const value = `${width || "—"}${separator}${height || "—"} ${unit}`;
  return customized ? `${value} (Customized)` : value;
};

const getOrderItemUnitRate = (item) => {
  const product = getOrderItemProduct(item);
  const unitPrice = Number(item?.unit_price ?? product.unit_price);
  const unit = item?.unit || product.unit || item?.measurement_unit || item?.measurementUnit || item?.dimensions?.unit || "piece";
  return `${formatCurrency(unitPrice)} / ${unit.replace(/^per_/, "")}`;
};

const getOrderItemTotal = (item) => {
  const estimated = Number(item?.estimated_price) || 0;
  if (item?.is_estimate && estimated > 0) return estimated;
  return (Number(item?.quantity) || 1) * (Number(item?.unit_price) || 0);
};

import Sidebar from "../../components/layout/Sidebar";
import Navbar from "../../components/layout/Navbar";
import AdminPageHeader from "../../components/layout/AdminPageHeader";
import ProgressViewModal from "../../components/ProgressViewModal";

const toProgressProject = (order) => ({
  id: order?._id || order?.id,
  client:
    order?.customer_name ||
    `${order?.customer?.first_name || ""} ${order?.customer?.last_name || ""}`.trim() ||
    order?.customer?.email ||
    "Unknown",
  product:
    order?.items?.[0]?.name ||
    order?.items?.[0]?.category ||
    order?.items?.[0]?.product_id?.name ||
    "Project",
  rawOrder: order,
});

function Dashboard() {
  const { user } = useAuth();
  const { darkMode } = useAdminTheme();
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("sidebarOpen");
    return stored !== null ? JSON.parse(stored) : true;
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedOrderLoading, setSelectedOrderLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [toast, setToast] = useState({
    open: false,
    message: "",
    type: "success",
  });
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    action: "",
    order: null,
  });

  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  const [contractNotifications, setContractNotifications] = useState([]);
  const [contractNotificationsLoading, setContractNotificationsLoading] = useState(false);
  const [contractPage, setContractPage] = useState(1);
  const contractsPerPage = 5;
  const [chartProgress, setChartProgress] = useState(0);
  const [currentDateTime, setCurrentDateTime] = useState(() => new Date());

  useEffect(() => {
    const clock = window.setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => window.clearInterval(clock);
  }, []);

  const showToast = (message, type = "success") => {
    setToast({ open: true, message, type });
    setTimeout(() => {
      setToast((current) =>
        current.message === message ? { ...current, open: false } : current
      );
    }, 3000);
  };

  const navigate = useNavigate();

  const openConfirmModal = (order, action) => {
    setConfirmModal({
      open: true,
      action,
      order,
    });
  };

  

  const handleViewOrder = async (orderId) => {
    if (!orderId) return;
    try {
      setSelectedOrderLoading(true);
      const resp = await getAdminOrder(orderId);
      setSelectedOrder(resp.order || resp);
    } catch (error) {
      console.error("Failed to fetch admin order:", error);
      showToast(error.data?.message || error.message || "Unable to load order details", "error");
    } finally {
      setSelectedOrderLoading(false);
    }
  };

  const handleViewProject = (order) => {
    setSelectedProject(toProgressProject(order));
  };

  const handleTimelineOrderChange = (savedOrder) => {
    if (!savedOrder) return;

    setOrders((currentOrders) =>
      currentOrders.map((order) =>
        (order._id || order.id) === (savedOrder._id || savedOrder.id)
          ? savedOrder
          : order
      )
    );
    setSelectedProject(toProgressProject(savedOrder));
  };

  const closeConfirmModal = () => {
    setConfirmModal({ open: false, action: "", order: null });
  };

  const handleConfirmAction = async () => {
    if (!confirmModal.order) return;

    const order = confirmModal.order;
    const action = confirmModal.action;

    closeConfirmModal();

    if (action === "approve") {
      await handleApproveOrder(order);
    } else if (action === "reject") {
      await handleRejectOrder(order);
    }
  };

  useEffect(() => {
    localStorage.setItem("sidebarOpen", JSON.stringify(isSidebarOpen));
  }, [isSidebarOpen]);

  useEffect(() => {
    let animationFrame;
    const animationStart = performance.now();
    const animationDuration = 1400;

    const animateChart = (timestamp) => {
      const elapsed = Math.min((timestamp - animationStart) / animationDuration, 1);
      const easedProgress = 1 - Math.pow(1 - elapsed, 4);
      setChartProgress(easedProgress);

      if (elapsed < 1) {
        animationFrame = requestAnimationFrame(animateChart);
      }
    };

    setChartProgress(0);
    animationFrame = requestAnimationFrame(animateChart);

    return () => cancelAnimationFrame(animationFrame);
  }, [orders.length]);

  useEffect(() => {
    const fetchOrders = async () => {
      setOrdersLoading(true);
      try {
        const response = await getOrders();
        setOrders(response.orders || []);
      } catch (error) {
        console.error("Failed to load orders:", error);
        setOrders([]);
      } finally {
        setOrdersLoading(false);
      }
    };

    fetchOrders();
    fetchContractNotifications();
  }, []);

  async function fetchContractNotifications() {
    setContractNotificationsLoading(true);
    try {
      const [acceptedResp, declinedResp] = await Promise.all([
        getAdminOrders({ contract_status: "accepted" }),
        getAdminOrders({ contract_status: "declined" }),
      ]);

      const notifications = [
        ...(acceptedResp.orders || []).map((order) => ({
          ...order,
          notificationType: "accepted",
          read: false,
        })),
        ...(declinedResp.orders || []).map((order) => ({
          ...order,
          notificationType: "declined",
          read: false,
        })),
      ].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

      setContractNotifications(notifications);
    } catch (error) {
      console.error("Failed to load contract notifications:", error);
      setContractNotifications([]);
    } finally {
      setContractNotificationsLoading(false);
    }
  };

  const handleApproveOrder = async (order) => {
    setActionLoading(true);
    setActionMessage("");

    try {
      await updateOrderStatus(order._id, { status: "site_inspection" });
      const orderName = order.customer
        ? `${order.customer.first_name || ""} ${order.customer.last_name || ""}`.trim() || order.customer.email || "Customer"
        : "Customer";
      recordActivity(user, `Approved order for ${orderName} and moved it to site inspection.`, "Dashboard");

      setOrders((prev) =>
        prev.map((item) =>
          item._id === order._id ? { ...item, status: "site_inspection" } : item
        )
      );

      const successMessage = "Order approved and moved to Site Inspection.";
      setActionMessage(successMessage);
      showToast(successMessage, "success");
      setTimeout(() => {
        setSelectedOrder(null);
        setActionMessage("");
      }, 2000);
    } catch (error) {
      console.error("Failed to approve order:", error);
      const errorMessage = "Failed to approve order. Please try again.";
      setActionMessage(errorMessage);
      showToast(errorMessage, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectOrder = async (order) => {
    setActionLoading(true);
    setActionMessage("");

    try {
      await updateOrderStatus(order._id, { status: "cancelled" });
      const orderName = order.customer
        ? `${order.customer.first_name || ""} ${order.customer.last_name || ""}`.trim() || order.customer.email || "Customer"
        : "Customer";
      recordActivity(user, `Rejected order for ${orderName}.`, "Dashboard");

      setOrders((prev) =>
        prev.map((item) =>
          item._id === order._id ? { ...item, status: "cancelled" } : item
        )
      );

      const successMessage = "Order rejected and cancelled.";
      setActionMessage(successMessage);
      showToast(successMessage, "success");
      setTimeout(() => {
        setSelectedOrder(null);
        setActionMessage("");
      }, 2000);
    } catch (error) {
      console.error("Failed to reject order:", error);
      const errorMessage = "Failed to reject order. Please try again.";
      setActionMessage(errorMessage);
      showToast(errorMessage, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const ordersPerPage = 5;

  const orderRequests = orders.filter((order) => order.status === "order_submitted");

  const lastIndex = currentPage * ordersPerPage;
  const firstIndex = lastIndex - ordersPerPage;

  const currentOrders = orderRequests.slice(firstIndex, lastIndex);

  const totalPages = Math.max(1, Math.ceil(orderRequests.length / ordersPerPage));
  const activeProjectStatuses = new Set([
    "approved",
    "site_inspection",
    "contract_sent",
    "contract_accepted",
    "in_transaction",
    "processing",
    "cutting",
    "fabrication",
    "installation_scheduling",
    "installation",
  ]);
  const isActiveProject = (order) => {
    const status = String(order.status || "").toLowerCase();
    const progress = Number(order.progress);
    const stages = order.progress_stages || order.stages || [];
    const finalStage = Array.isArray(stages) ? stages[stages.length - 1] : null;
    const isCompleted =
      status === "completed" ||
      status === "cancelled" ||
      progress >= 100 ||
      finalStage?.completed === true;

    return activeProjectStatuses.has(status) && !isCompleted;
  };
  const activeProjectsCount = orders.filter(isActiveProject).length;
  const activeWarrantiesCount = orders.filter(
    (order) => String(order.warranty_status || "").toLowerCase() === "active",
  ).length;
  const pendingInspectionCount = orders.filter(
    (order) => String(order.status || "").toLowerCase() === "site_inspection",
  ).length;
  const activeProjects = orders
    .filter(isActiveProject)
    .slice(0, 5);
  const activeWarranties = orders
    .filter((order) => String(order.warranty_status || "").toLowerCase() === "active")
    .slice(0, 5);
  const orderStatusGroups = [
    {
      label: "In progress",
      value: orders.filter(isActiveProject).length,
      color: "#2563eb",
      softColor: "bg-blue-500",
    },
    {
      label: "Pending inspection",
      value: pendingInspectionCount,
      color: "#f59e0b",
      softColor: "bg-amber-500",
    },
    {
      label: "Completed",
      value: orders.filter((order) => String(order.status || "").toLowerCase() === "completed").length,
      color: "#10b981",
      softColor: "bg-emerald-500",
    },
    {
      label: "Cancelled",
      value: orders.filter((order) => String(order.status || "").toLowerCase() === "cancelled").length,
      color: "#ef4444",
      softColor: "bg-red-500",
    },
    {
      label: "Other",
      value: Math.max(
        0,
        orders.length - activeProjectsCount - pendingInspectionCount -
          orders.filter((order) => String(order.status || "").toLowerCase() === "completed").length -
          orders.filter((order) => String(order.status || "").toLowerCase() === "cancelled").length,
      ),
      color: "#64748b",
      softColor: "bg-slate-500",
    },
  ];
  const orderStatusTotal = orderStatusGroups.reduce((total, group) => total + group.value, 0);
  const chartRadius = 78;
  const chartCircumference = 2 * Math.PI * chartRadius;
  let chartOffset = 0;
  const dashboardDate = currentDateTime.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const dashboardTime = currentDateTime.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
  const dashboardDay = currentDateTime.toLocaleDateString(undefined, {
    weekday: "long",
  });
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
          {toast.open && (
            <div className="fixed right-6 top-6 z-50 w-full max-w-sm rounded-2xl border px-4 py-3 shadow-xl transition duration-200 ease-out bg-white"
              role="status"
            >
              <div className="flex items-center gap-3">
                <div className={`h-2.5 w-2.5 rounded-full ${toast.type === "error" ? "bg-red-600" : "bg-emerald-600"}`} />
                <span className={`font-semibold ${toast.type === "error" ? "text-red-700" : "text-emerald-700"}`}>
                  {toast.type === "error" ? "Error" : "Success"}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-700">{toast.message}</p>
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 items-stretch gap-6 xl:grid-cols-2">
            <AdminPageHeader
              title="Dashboard"
              description="Manage inspections, projects, warranties and products from one administrative workspace."
              className="h-full min-h-[250px]"
              statsClassName="grid-cols-2 [&>*:last-child]:col-span-2"
              stats={[
                { label: "Date", value: dashboardDate, color: "text-blue-100" },
                { label: "Time", value: dashboardTime, color: "text-emerald-300" },
                { label: "Day", value: dashboardDay, color: "text-amber-300" },
              ]}
            />

            <div className={`h-full rounded-3xl p-6 shadow-lg ${darkMode ? "bg-slate-800 text-slate-100" : "bg-white text-gray-900"}`}>
              <h2 className="text-lg font-bold">Quick Actions</h2>
              <p className={`mb-4 mt-1 text-sm ${darkMode ? "text-slate-300" : "text-gray-500"}`}>Shortcuts</p>

              <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                <button
                  type="button"
                  onClick={() => navigate("/site-inspection")}
                  className={`rounded-2xl border p-3 text-left transition ${darkMode ? "border-red-400/80 bg-red-950/50 hover:bg-red-900/70" : "border-red-500 bg-red-50/50 hover:bg-red-100"}`}
                >
                  <ClipboardCheck className="mb-2 text-red-600" size={20} />
                  <h3 className="text-xs font-bold leading-tight">New Inspection</h3>
                  <p className={`mt-1 text-[11px] ${darkMode ? "text-slate-300" : "text-gray-500"}`}>Site inspection</p>
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/progress-monitor")}
                  className={`rounded-2xl border p-3 text-left transition ${darkMode ? "border-blue-400/80 bg-blue-950/50 hover:bg-blue-900/70" : "border-blue-500 bg-blue-50/50 hover:bg-blue-100"}`}
                >
                  <FolderOpen className="mb-2 text-blue-600" size={20} />
                  <h3 className="text-xs font-bold leading-tight">View Projects</h3>
                  <p className={`mt-1 text-[11px] ${darkMode ? "text-slate-300" : "text-gray-500"}`}>Progress monitor</p>
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/transactions", { state: { activeTable: "warranty_in" } })}
                  className={`rounded-2xl border p-3 text-left transition ${darkMode ? "border-green-400/80 bg-green-950/50 hover:bg-green-900/70" : "border-green-500 bg-green-50/50 hover:bg-green-100"}`}
                >
                  <ShieldCheck className="mb-2 text-green-600" size={20} />
                  <h3 className="text-xs font-bold leading-tight">View Warranty</h3>
                  <p className={`mt-1 text-[11px] ${darkMode ? "text-slate-300" : "text-gray-500"}`}>Warranties</p>
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/product")}
                  className={`rounded-2xl border p-3 text-left transition ${darkMode ? "border-fuchsia-400/80 bg-fuchsia-950/50 hover:bg-fuchsia-900/70" : "border-purple-500 bg-purple-50 hover:bg-purple-100"}`}
                >
                  <Package className="mb-2 text-purple-600" size={20} />
                  <h3 className="text-xs font-bold leading-tight">Add Product</h3>
                  <p className={`mt-1 text-[11px] ${darkMode ? "text-slate-300" : "text-gray-500"}`}>Inventory</p>
                </button>
              </div>
            </div>
          </div>

          {/* Statistics */}

          <div className="grid grid-cols-1 gap-5 mt-6 md:grid-cols-3">

            <button
              type="button"
              onClick={() => navigate("/progress-monitor")}
              className="group rounded-3xl bg-white p-6 text-left shadow transition duration-200 hover:-translate-y-1 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <p className="text-gray-500">
                Active Projects
              </p>

              <h2 className="mt-2 text-4xl font-bold text-gray-900">
                {activeProjectsCount}
              </h2>

              <p className="mt-2 text-sm text-blue-500 transition group-hover:text-blue-700">
                View projects →
              </p>
            </button>

            <button
              type="button"
              onClick={() => navigate("/transactions", { state: { activeTable: "warranty_in" } })}
              className="group rounded-3xl bg-white p-6 text-left shadow transition duration-200 hover:-translate-y-1 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <p className="text-gray-500">
                Active Warranties
              </p>

              <h2 className="mt-2 text-4xl font-bold text-gray-900">
                {activeWarrantiesCount}
              </h2>

              <p className="mt-2 text-sm text-green-500 transition group-hover:text-green-700">
                View warranties →
              </p>
            </button>

            <button
              type="button"
              onClick={() => navigate("/site-inspection")}
              className="group rounded-3xl bg-white p-6 text-left shadow transition duration-200 hover:-translate-y-1 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <p className="text-gray-500">
                Pending Inspection
              </p>

              <h2 className="mt-2 text-4xl font-bold text-gray-900">
                {pendingInspectionCount}
              </h2>

              <p className="mt-2 text-sm text-red-500 transition group-hover:text-red-700">
                View inspections →
              </p>
            </button>

          </div>

          <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_55px_-28px_rgba(15,23,42,0.45)]">
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-7 text-white lg:px-8">
              <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full border border-white/10" />
              <div className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full border border-white/10" />
              <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-red-300">Portfolio intelligence</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">Order status overview</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
                  A live view of how orders are moving through your operation.
                </p>
              </div>
              <div className="flex items-center gap-8 rounded-2xl border border-white/10 bg-white/10 px-6 py-4 shadow-xl shadow-black/10 backdrop-blur-sm">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Total orders</p>
                  <p className="mt-1 text-3xl font-bold tabular-nums">{orderStatusTotal}</p>
                </div>
                <div className="h-10 w-px bg-white/15" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Live feed</p>
                  <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-emerald-300">
                    <span className="animate-pulse h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                    Updated now
                  </p>
                </div>
              </div>
              </div>
            </div>

            <div className="grid items-center gap-8 border-t border-slate-100 px-6 py-8 md:grid-cols-[minmax(240px,0.8fr)_1fr] lg:px-8">
              <div className="relative mx-auto h-64 w-64">
                <div className="absolute inset-5 rounded-full bg-slate-50 shadow-inner" />
                <svg className="dashboard-pie-chart relative h-full w-full -rotate-90" viewBox="0 0 200 200" role="img" aria-label="Order status distribution">
                  <defs>
                    <filter id="pieChartShadow" x="-30%" y="-30%" width="160%" height="160%">
                      <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#0f172a" floodOpacity="0.16" />
                    </filter>
                  </defs>
                  <circle cx="100" cy="100" r={chartRadius} fill="none" stroke="#e2e8f0" strokeWidth="25" />
                  {orderStatusTotal > 0 && orderStatusGroups.map((group) => {
                    const targetSegmentLength = (group.value / orderStatusTotal) * chartCircumference;
                    const segmentLength = targetSegmentLength * chartProgress;
                    const segment = (
                      <circle
                        key={group.label}
                        className="dashboard-pie-segment"
                        cx="100"
                        cy="100"
                        r={chartRadius}
                        fill="none"
                        stroke={group.color}
                        strokeDasharray={`${segmentLength} ${chartCircumference - segmentLength}`}
                        strokeDashoffset={-chartOffset * chartProgress}
                        strokeLinecap="butt"
                        strokeWidth="25"
                        filter="url(#pieChartShadow)"
                      />
                    );
                    chartOffset += targetSegmentLength;
                    return segment;
                  })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-5xl font-bold tracking-tight text-slate-950">{orderStatusTotal}</span>
                  <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">Total orders</span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {orderStatusGroups.map((group) => {
                  const percentage = orderStatusTotal ? Math.round((group.value / orderStatusTotal) * 100) : 0;
                  return (
                    <div key={group.label} className="group rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.5)] transition duration-200 hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-md">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${group.softColor} ring-4 ring-slate-50 transition group-hover:ring-slate-100`} />
                          <span className="truncate text-sm font-semibold text-slate-600">{group.label}</span>
                        </div>
                        <span className="text-xs font-bold text-slate-400">{percentage}%</span>
                      </div>
                      <div className="mt-3 flex items-end justify-between">
                        <p className="text-3xl font-bold tracking-tight text-slate-950">{group.value}</p>
                        <span className="text-xs font-medium text-slate-400">orders</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Order Requests */}

          <div className="bg-white rounded-3xl shadow mt-6 overflow-hidden">

            <div className="p-6 border-b">

              <h2 className="text-xl font-bold">
                Order Requests
              </h2>

              <p className="text-gray-500 text-sm mt-1">
                Incoming client requests
              </p>

            </div>

            <div className="overflow-x-auto">

              <table className="w-full">

                <thead className="bg-gray-50">

                  <tr>

                    <th className="w-16 p-4 text-center">
                      No.
                    </th>

                    <th className="p-4 text-left">
                      Client
                    </th>

                    <th className="p-4 text-left">
                      Phone
                    </th>

                    <th className="p-4 text-left">
                      Product
                    </th>

                    <th className="p-4 text-left">
                      Order Type
                    </th>

                    <th className="p-4 text-left">
                      Site Address
                    </th>

                    <th className="p-4 text-left">
                      Date Submitted
                    </th>

                    <th className="p-4 text-left">
                      Estimation
                    </th>

                    <th className="p-4 text-center">
                      Actions
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {ordersLoading ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500">
                        Loading order requests...
                      </td>
                    </tr>
                  ) : currentOrders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500">
                        No order requests available.
                      </td>
                    </tr>
                  ) : (
                    currentOrders.map((order, index) => {
                      const customerName = order.customer
                        ? `${order.customer.first_name || ""} ${order.customer.last_name || ""}`.trim() || order.customer.email || "Customer"
                        : "Customer";
                      const phone = order.customer?.phone || "—";
                      const productName = order.items?.[0]?.name || order.items?.[0]?.product_id?.name || "Project Item";
                      const orderType = order.order_type === "walk_in_customer" ? "Walk-in" : "Online";
                      const address = order.customer
                        ? getCustomerAddress(order.customer) || "—"
                        : "—";
                      const date = order.createdAt ? formatDateToMMDDYYYY(order.createdAt) : "—";
                      const estimation = order.total_amount ? `₱${order.total_amount.toLocaleString()}` : "—";

                      return (
                        <tr
                          key={order._id || order.tracking || index}
                          className="border-t hover:bg-gray-50"
                        >
                          <td className="w-16 p-4 text-center font-semibold text-slate-600">
                            {firstIndex + index + 1}
                          </td>

                          <td className="p-4 font-medium">{customerName}</td>

                          <td className="p-4">{phone}</td>

                          <td className="p-4">{productName}</td>

                          <td className="p-4">{orderType}</td>

                          <td className="p-4 max-w-xs break-words">{address}</td>

                          <td className="p-4">{date}</td>

                          <td className="p-4 font-semibold text-green-500">{estimation}</td>

                          <td className="p-4">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => handleViewOrder(order._id || order.id)}
                                disabled={selectedOrderLoading}
                                className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {selectedOrderLoading ? "..." : "View"}
                              </button>

                              <button
                                onClick={() => openConfirmModal(order, "approve")}
                                disabled={actionLoading}
                                className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                              >
                                {actionLoading ? "..." : "Approve"}
                              </button>

                              <button
                                onClick={() => openConfirmModal(order, "reject")}
                                disabled={actionLoading}
                                className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                              >
                                {actionLoading ? "..." : "Reject"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}

                </tbody>

              </table>

            </div>

            {/* Pagination */}

            <div className="flex justify-center items-center p-4 border-t bg-gray-50 gap-4">

              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>

              <div className="flex gap-2">

                <button
                  disabled={currentPage === 1}
                  onClick={() =>
                    setCurrentPage(currentPage - 1)
                  }
                  className={`px-4 py-2 rounded-lg ${
                    currentPage === 1
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-white border hover:bg-gray-100"
                  }`}
                >
                  Previous
                </button>

                {[...Array(totalPages)].map(
                  (_, index) => (
                    <button
                      key={index}
                      onClick={() =>
                        setCurrentPage(index + 1)
                      }
                      className={`w-10 h-10 rounded-lg ${
                        currentPage === index + 1
                          ? "bg-red-600 text-white"
                          : "bg-white border hover:bg-gray-100"
                      }`}
                    >
                      {index + 1}
                    </button>
                  )
                )}

                <button
                  disabled={
                    currentPage === totalPages
                  }
                  onClick={() =>
                    setCurrentPage(currentPage + 1)
                  }
                  className={`px-4 py-2 rounded-lg ${
                    currentPage === totalPages
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-white border hover:bg-gray-100"
                  }`}
                >
                  Next
                </button>

              </div>

            </div>

          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Active Projects</h2>
                  <p className="mt-1 text-sm text-gray-400">
                    {activeProjectsCount} projects currently in progress
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/progress-monitor")}
                  className="text-sm font-semibold text-red-600 hover:text-red-700"
                >
                  View all
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {activeProjects.length > 0 ? activeProjects.map((order) => {
                  const customerName = order.customer
                    ? `${order.customer.first_name || ""} ${order.customer.last_name || ""}`.trim() || order.customer.email || "Customer"
                    : "Customer";
                  const productName = order.items?.[0]?.name || order.items?.[0]?.product_id?.name || "Project";
                  const status = titleCase(order.status);
                  return (
                    <button
                      type="button"
                      key={order._id || order.id}
                      onClick={() => handleViewProject(order)}
                      className="flex w-full items-center justify-between gap-4 rounded-2xl border border-gray-100 p-4 text-left transition hover:border-blue-200 hover:bg-blue-50/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-800">{productName}</p>
                        <p className="mt-1 truncate text-sm text-gray-400">{customerName}</p>
                      </div>
                      <span className="shrink-0 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white">
                        {status}
                      </span>
                    </button>
                  );
                }) : (
                  <p className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
                    No active projects.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Active Warranties</h2>
                  <p className="mt-1 text-sm text-gray-400">
                    {activeWarrantiesCount} warranties currently active
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/transactions", { state: { activeTable: "warranty_in" } })}
                  className="text-sm font-semibold text-red-600 hover:text-red-700"
                >
                  View all
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {activeWarranties.length > 0 ? activeWarranties.map((order) => {
                  const customerName = order.customer
                    ? `${order.customer.first_name || ""} ${order.customer.last_name || ""}`.trim() || order.customer.email || "Customer"
                    : "Customer";
                  const productName = order.items?.[0]?.name || order.items?.[0]?.product_id?.name || "Warranty";
                  return (
                    <button
                      type="button"
                      key={order._id || order.id}
                      onClick={() => navigate("/transactions", { state: { activeTable: "warranty_in" } })}
                      className="flex w-full items-center justify-between gap-4 rounded-2xl border border-gray-100 p-4 text-left transition hover:border-green-200 hover:bg-green-50/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-800">{productName}</p>
                        <p className="mt-1 truncate text-sm text-gray-400">{customerName}</p>
                      </div>
                      <span className="shrink-0 rounded-lg bg-green-500 px-3 py-1.5 text-xs font-semibold text-white">
                        Active
                      </span>
                    </button>
                  );
                }) : (
                  <p className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
                    No active warranties.
                  </p>
                )}
              </div>
            </section>
          </div>

        </main>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedOrder(null)} />
          <div className="relative bg-white rounded-3xl shadow-lg p-8 w-full max-w-2xl max-h-120 overflow-y-auto">
            <button
              onClick={() => setSelectedOrder(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-2xl"
            >
              ×
            </button>

            <h2 className="text-2xl font-bold text-slate-950 mb-6">
              {selectedOrder.status === "order_submitted" ? "Order Details" : "Project Details"}
            </h2>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400">Customer Name</p>
                <p className="text-lg font-semibold text-slate-950 mt-1">
                  {selectedOrder.customer
                    ? `${selectedOrder.customer.first_name || ""} ${selectedOrder.customer.last_name || ""}`.trim() || selectedOrder.customer.email || "—"
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400">Phone</p>
                <p className="text-lg font-semibold text-slate-950 mt-1">{selectedOrder.customer?.phone || "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400">Tracking ID</p>
                <p className="text-lg font-semibold text-slate-950 mt-1">{selectedOrder.tracking || "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400">Order Type</p>
                <p className="text-lg font-semibold text-slate-950 mt-1">
                  {selectedOrder.order_type === "walk_in_customer" ? "Walk-in" : "Online"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400">Product</p>
                <p className="text-lg font-semibold text-slate-950 mt-1">
                  {selectedOrder.items?.[0]?.name || selectedOrder.items?.[0]?.product_id?.name || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400">Total Amount</p>
                <p className="text-lg font-semibold text-green-600 mt-1">₱{selectedOrder.total_amount?.toLocaleString() || "—"}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs uppercase tracking-widest text-slate-400">Full Address</p>
                <p className="text-lg font-semibold text-slate-950 mt-1 whitespace-normal break-words">
                  {selectedOrder.customer
                    ? getCustomerAddress(selectedOrder.customer) || "—"
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400">Status</p>
                <p className="text-lg font-semibold text-slate-950 mt-1">
                  {selectedOrder.status?.replace(/_/g, " ").toUpperCase() || "—"}
                </p>
              </div>
            </div>

            

            <div className="mb-6">
              <p className="text-xs uppercase tracking-widest text-slate-400 mb-3">Ordered Items</p>
              {Array.isArray(selectedOrder.items) && selectedOrder.items.length > 0 ? (
                <div className="space-y-3">
                  {selectedOrder.items.map((item, index) => (
                    <div
                      key={`${item.product_id?._id || item.product_id || item.name || "item"}-${index}`}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-base font-bold text-slate-950">
                            {index + 1}. {getOrderItemName(item)}
                          </p>
                          {item.notes && (
                            <p className="mt-1 text-sm text-slate-500">{item.notes}</p>
                          )}
                        </div>
                        <p className="text-lg font-bold text-green-600">{formatCurrency(getOrderItemTotal(item))}</p>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <p className="text-xs uppercase tracking-widest text-slate-400">Type</p>
                          <p className="mt-1 font-semibold text-slate-900">{getOrderItemType(item)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-widest text-slate-400">Dimensions</p>
                          <p className="mt-1 font-semibold text-slate-900">{getOrderItemDimensions(item)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-widest text-slate-400">Quantity</p>
                          <p className="mt-1 font-semibold text-slate-900">{item.quantity || 1}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-widest text-slate-400">Unit Rate</p>
                          <p className="mt-1 font-semibold text-slate-900">{getOrderItemUnitRate(item)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-500">
                  No item details available.
                </div>
              )}
            </div>

            {actionMessage && (
              <div className={`mb-4 p-3 rounded-lg ${
                actionMessage.includes("success") || actionMessage.includes("approved") || actionMessage.includes("rejected")
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}>
                {actionMessage}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
              >
                Close
              </button>
              {selectedOrder.status === "order_submitted" && (
                <>
                  <button
                    onClick={() => openConfirmModal(selectedOrder, "approve")}
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {actionLoading ? "Processing..." : "Approve"}
                  </button>
                  <button
                    onClick={() => openConfirmModal(selectedOrder, "reject")}
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {actionLoading ? "Processing..." : "Reject"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedProject && (
        <ProgressViewModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onOrderChange={handleTimelineOrderChange}
        />
      )}

      {confirmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeConfirmModal} />
          <div className="relative bg-white rounded-3xl shadow-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">
              {confirmModal.action === "approve"
                ? "Confirm Approval"
                : "Confirm Rejection"}
            </h2>
            <p className="text-sm text-slate-600 mb-6">
              {confirmModal.action === "approve"
                ? "Are you sure you want to approve this order request and move it to Site Inspection?"
                : "Are you sure you want to reject this order request?"}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={closeConfirmModal}
                className="px-4 py-2 rounded-lg bg-gray-100 text-slate-700 hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {actionLoading ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;

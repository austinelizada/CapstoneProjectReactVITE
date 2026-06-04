import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardCheck,
  FolderOpen,
  ShieldCheck,
  Package,
} from "lucide-react";
import { getOrders, updateOrderStatus } from "@/api/orders";

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

import Sidebar from "../../components/layout/Sidebar";
import Navbar from "../../components/layout/Navbar";

function Dashboard() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("sidebarOpen");
    return stored !== null ? JSON.parse(stored) : true;
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
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
  }, []);

  const handleApproveOrder = async (order) => {
    setActionLoading(true);
    setActionMessage("");

    try {
      await updateOrderStatus(order._id, { status: "site_inspection" });

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
    if (!window.confirm("Are you sure you want to reject this order?")) return;
    setActionLoading(true);
    setActionMessage("");
    try {
      console.log("Rejecting order:", order._id);
      const successMessage = "Order rejected.";
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

          {/* Welcome */}

          <div className="bg-gradient-to-r from-red-700 via-red-600 to-orange-500 text-white rounded-3xl p-8 shadow-lg">
            <h1 className="text-3xl font-bold">
              Welcome to ACGC Admin Dashboard
            </h1>

            <p className="mt-2 text-red-100">
              Manage inspections, projects,
              warranties and products.
            </p>
          </div>

          {/* Statistics */}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">

            <div className="bg-white rounded-3xl p-6 shadow">
              <p className="text-gray-500">
                Active Projects
              </p>

              <h2 className="text-4xl font-bold mt-2">
                0
              </h2>

              <p className="text-green-600 text-sm mt-2">
                ↑ 2 this month
              </p>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow">
              <p className="text-gray-500">
                Active Warranties
              </p>

              <h2 className="text-4xl font-bold mt-2">
                1
              </h2>

              <p className="text-blue-600 text-sm mt-2">
                1 currently active
              </p>
            </div>

          </div>

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
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        Loading order requests...
                      </td>
                    </tr>
                  ) : currentOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
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
                      const date = order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "—";
                      const estimation = order.total_amount ? `₱${order.total_amount.toLocaleString()}` : "—";

                      return (
                        <tr
                          key={order._id || order.tracking || index}
                          className="border-t hover:bg-gray-50"
                        >
                          <td className="p-4 font-medium">{customerName}</td>

                          <td className="p-4">{phone}</td>

                          <td className="p-4">{productName}</td>

                          <td className="p-4">{orderType}</td>

                          <td className="p-4 max-w-xs break-words">{address}</td>

                          <td className="p-4">{date}</td>

                          <td className="p-4 font-semibold text-green-600">{estimation}</td>

                          <td className="p-4">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => setSelectedOrder(order)}
                                className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                              >
                                View
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

          {/* Quick Actions */}

          <div className="bg-white rounded-3xl shadow mt-6 p-6">

            <h2 className="text-xl font-bold mb-6">
              Quick Actions
            </h2>

            <p className="text-gray-500 mb-6">
              Shortcuts
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">

              <button
                onClick={() =>
                  navigate("/site-inspection")
                }
                className="bg-red-50 border border-red-200 rounded-2xl p-6 text-left hover:bg-red-100 transition"
              >
                <ClipboardCheck
                  className="text-red-600 mb-3"
                  size={32}
                />

                <h3 className="font-bold">
                  New Inspection
                </h3>

                <p className="text-gray-500 text-sm mt-2">
                  Site inspection
                </p>
              </button>

              <button className="bg-blue-50 border border-blue-200 rounded-2xl p-6 text-left hover:bg-blue-100 transition">
                <FolderOpen
                  className="text-blue-600 mb-3"
                  size={32}
                />

                <h3 className="font-bold">
                  View Projects
                </h3>

                <p className="text-gray-500 text-sm mt-2">
                  Progress monitor
                </p>
              </button>

              <button className="bg-green-50 border border-green-200 rounded-2xl p-6 text-left hover:bg-green-100 transition">
                <ShieldCheck
                  className="text-green-600 mb-3"
                  size={32}
                />

                <h3 className="font-bold">
                  View Warranty
                </h3>

                <p className="text-gray-500 text-sm mt-2">
                  Warranties
                </p>
              </button>

              <button className="bg-purple-50 border border-purple-200 rounded-2xl p-6 text-left hover:bg-purple-100 transition">
                <Package
                  className="text-purple-600 mb-3"
                  size={32}
                />

                <h3 className="font-bold">
                  Add Product
                </h3>

                <p className="text-gray-500 text-sm mt-2">
                  Inventory
                </p>
              </button>

            </div>

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

            <h2 className="text-2xl font-bold text-slate-950 mb-6">Order Details</h2>

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
            </div>
          </div>
        </div>
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
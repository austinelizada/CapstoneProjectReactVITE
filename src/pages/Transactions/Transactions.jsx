import { useEffect, useState } from "react";
import {
  FileText,
  CheckCircle,
  Eye,
  Download,
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

function Transactions() {
  const [isSidebarOpen, setIsSidebarOpen] =
    useState(() => {
      if (typeof window === "undefined") return true;
      const stored = localStorage.getItem("sidebarOpen");
      return stored !== null ? JSON.parse(stored) : true;
    });

  const [activeTable, setActiveTable] =
    useState("receipts");

  useEffect(() => {
    localStorage.setItem("sidebarOpen", JSON.stringify(isSidebarOpen));
  }, [isSidebarOpen]);

  const [receiptPage, setReceiptPage] =
    useState(1);

  const [projectPage, setProjectPage] =
    useState(1);
  const [cancelledPage, setCancelledPage] =
    useState(1);

  useEffect(() => {
    setReceiptPage(1);
    setProjectPage(1);
    setCancelledPage(1);
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

  const canReviewTransaction = (order) => {
    const status = (order.contract_status || "").toString().toLowerCase();
    return status === "accepted";
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
      const response = await updateOrderStatus(orderId, { status: "site_inspection", contract_status: "accepted" });
      const updated = response?.order || {};
      const now = new Date().toISOString();
      updateOrderLocally(orderId, {
        ...updated,
        contract_status: updated.contract_status || "approved",
        approved_at: updated.approved_at || now,
        status: updated.status || "site_inspection",
      });
      toast.success("Transaction approved successfully.");
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
      const updated = response?.order || {};
      const now = new Date().toISOString();
      updateOrderLocally(orderId, {
        ...updated,
        contract_status: updated.contract_status || "declined",
        rejected_at: updated.rejected_at || now,
        status: updated.status || "cancelled",
      });
      toast.success("Transaction rejected successfully.");
    } catch (error) {
      console.error("Reject transaction failed", error);
      toast.error(error?.data?.message || error?.message || "Unable to reject transaction.");
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
      contractDate: order.updatedAt ? new Date(order.updatedAt).toLocaleDateString() : new Date(order.createdAt).toLocaleDateString(),
      orderDate: order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "N/A",
      status: order.status?.replace(/_/g, " ") || "Pending",
      contractStatus,
      customerName: order.customer?.first_name || order.customer_name || "Customer",
      customerEmail: order.customer?.email || order.customer_email || "N/A",
      customerPhone: order.customer?.phone || order.customer_phone || "N/A",
      projectLocation: order.shipping_address || "N/A",
      siteInspectionDate: order.inspection_date ? new Date(order.inspection_date).toLocaleDateString() : "TBD",
      paymentTerms: order.payment_terms || "Standard payment terms apply.",
      contractTerms: order.contract_terms || "",
      subtotal: amount,
      totalProjectCost: amount,
      downPayment,
      items,
      accepted,
      acceptanceMethod: accepted ? "Online Acceptance" : null,
      acceptanceDate: accepted && order.updatedAt ? new Date(order.updatedAt).toLocaleString() : null,
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
    return o.contract_status && o.contract_status !== "pending" && !cancelledStatuses.includes(status);
  });

  const cancelledTransactions = orders.filter((o) => {
    const contractStatus = (o.contract_status || "").toString().toLowerCase();
    const status = (o.status || "").toString().toLowerCase();
    return ["declined", "rejected", "cancelled", "contract_declined"].includes(contractStatus) || status === "cancelled";
  });

  // Completed projects: orders with status 'completed'
  const completedProjects = orders.filter((o) => o.status === "completed");

  const receiptLastIndex =
    receiptPage * rowsPerPage;

  const receiptFirstIndex =
    receiptLastIndex - rowsPerPage;

  const currentReceipts = receipts.slice(
    receiptFirstIndex,
    receiptLastIndex
  );

  const receiptTotalPages = Math.max(1, Math.ceil(
    receipts.length / rowsPerPage
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

  const currentData =
    activeTable === "receipts"
      ? currentReceipts
      : activeTable === "projects"
      ? currentProjects
      : currentCancelled;

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
              onClick={() =>
                setActiveTable("receipts")
              }
              className={`px-5 py-3 rounded-xl font-medium ${
                activeTable === "receipts"
                  ? "bg-red-600 text-white"
                  : "bg-white border"
              }`}
            >
              <FileText
                className="inline mr-2"
                size={18}
              />
              Receipts & Contracts
            </button>

            <button
              onClick={() =>
                setActiveTable("projects")
              }
              className={`px-5 py-3 rounded-xl font-medium ${
                activeTable === "projects"
                  ? "bg-red-600 text-white"
                  : "bg-white border"
              }`}
            >
              <CheckCircle
                className="inline mr-2"
                size={18}
              />
              Completed Projects
            </button>

            <button
              onClick={() =>
                setActiveTable("cancelled")
              }
              className={`px-5 py-3 rounded-xl font-medium ${
                activeTable === "cancelled"
                  ? "bg-red-600 text-white"
                  : "bg-white border"
              }`}
            >
              <XCircle
                className="inline mr-2"
                size={18}
              />
              Cancelled Transactions
            </button>

          </div>

          <div className="bg-white rounded-3xl shadow mt-6 overflow-hidden">

            <div className="overflow-x-auto">

              <table className="w-full">

                <thead className="bg-gray-50">

                  <tr>
                    <th className="p-4 text-left">
                      Tracking ID
                    </th>

                    <th className="p-4 text-left">
                      Customer
                    </th>

                    <th className="p-4 text-left">
                      Inspection
                    </th>

                    <th className="p-4 text-left">
                      Date
                    </th>

                    <th className="p-4 text-left">
                      Amount
                    </th>

                    <th className="p-4 text-left">
                      Status
                    </th>

                    <th className="p-4 text-center">
                      Actions
                    </th>
                  </tr>

                </thead>

                <tbody>

                  {currentData.map((order, index) => {
                    const customerName = order.customer_name || (order.customer ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() : "N/A");
                    const inspectionLabel = order.items && order.items.length > 0 ? (order.items[0].name || `${order.items.length} item(s)`) : "N/A";
                    const date = order.createdAt ? new Date(order.createdAt).toLocaleDateString() : (order.inspection_date ? new Date(order.inspection_date).toLocaleDateString() : "N/A");
                    const amountVal = order.contract_amount || order.total_amount || 0;
                    const amount = `₱${Number(amountVal || 0).toLocaleString()}`;
                    const statusLabel = activeTable === "receipts" ? (order.contract_status?.replace(/_/g, " ") || "Pending") : (order.status?.replace(/_/g, " ") || "N/A");

                    return (
                      <tr key={order._id || index} className="border-t hover:bg-gray-50">
                        <td className="p-4">{order.tracking}</td>

                        <td className="p-4">{customerName}</td>

                        <td className="p-4">{inspectionLabel}</td>

                        <td className="p-4">{date}</td>

                        <td className="p-4 font-semibold text-green-600">{amount}</td>

                        <td className="p-4">
                          <span className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold bg-amber-100 text-amber-700">
                            {statusLabel}
                          </span>
                        </td>

                        <td className="p-4">
                          <div className="flex flex-wrap justify-center gap-2">
                            {activeTable === "receipts" && canReviewTransaction(order) && (
                              <>
                                <button
                                  title="Approve Transaction"
                                  onClick={() => openTransactionConfirm("approve", order)}
                                  disabled={processingOrderId === (order._id || order.id)}
                                  className="p-2 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                  <Check size={18} />
                                </button>
                                <button
                                  title="Reject Transaction"
                                  onClick={() => openTransactionConfirm("reject", order)}
                                  disabled={processingOrderId === (order._id || order.id)}
                                  className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                  <XCircle size={18} />
                                </button>
                              </>
                            )}
                            <button
                              title="View Transaction"
                              onClick={() => openContractModal(order)}
                              className="p-2 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition"
                            >
                              <Eye size={18} />
                            </button>

                            <button
                              title="Download Receipt"
                              onClick={() => window.open(`/orders/track/${encodeURIComponent(order.tracking)}`, "_blank")}
                              className="p-2 rounded-lg bg-green-100 text-green-600 hover:bg-green-200 transition"
                            >
                              <Download size={18} />
                            </button>

                          </div>
                        </td>
                      </tr>
                    );
                  })}

                </tbody>

              </table>

            </div>

            {/* Pagination */}

            <div className="flex justify-center items-center p-4 border-t bg-gray-50 gap-4">

              <span className="text-sm text-gray-600">
                Page{" "}
                {activeTable === "receipts"
                  ? receiptPage
                  : activeTable === "projects"
                  ? projectPage
                  : cancelledPage}
                {" "}of{" "}
                {activeTable === "receipts"
                  ? receiptTotalPages
                  : activeTable === "projects"
                  ? projectTotalPages
                  : cancelledTotalPages}
              </span>

              <div className="flex gap-2">

                <button
                  disabled={
                    activeTable === "receipts"
                      ? receiptPage === 1
                      : activeTable === "projects"
                      ? projectPage === 1
                      : cancelledPage === 1
                  }
                  onClick={() => {
                    if (activeTable === "receipts") {
                      setReceiptPage(receiptPage - 1);
                    } else if (activeTable === "projects") {
                      setProjectPage(projectPage - 1);
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
                    ? projectTotalPages
                    : cancelledTotalPages
                )].map((_, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      if (activeTable === "receipts") {
                        setReceiptPage(index + 1);
                      } else if (activeTable === "projects") {
                        setProjectPage(index + 1);
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
                          : cancelledPage
                      ) ===
                      index + 1
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
                      ? projectPage === projectTotalPages
                      : cancelledPage === cancelledTotalPages
                  }
                  onClick={() => {
                    if (activeTable === "receipts") {
                      setReceiptPage(receiptPage + 1);
                    } else if (activeTable === "projects") {
                      setProjectPage(projectPage + 1);
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

          {confirmModal.open && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/40" onClick={closeTransactionConfirm} />
              <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">
                  {confirmModal.action === "approve" ? "Approve Transaction" : "Reject Transaction"}
                </h2>
                <p className="text-sm text-slate-600 leading-6">
                  {confirmModal.action === "approve"
                    ? "Are you sure you want to approve this contract/receipt? This action will mark the transaction as approved and proceed to the next stage of the workflow."
                    : "Are you sure you want to reject this contract/receipt? This action will stop the current transaction process."}
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
                        : "Confirm Reject"}
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
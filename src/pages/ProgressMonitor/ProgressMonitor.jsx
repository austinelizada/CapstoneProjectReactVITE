import { useEffect, useState } from "react";
import {
  Search,
  Eye,
  Pencil,
  X,
} from "lucide-react";

import { getAdminOrders, updateOrderProgress, updateOrderStatus } from "@/api/orders";
import { formatDateToMMDDYYYY } from "@/lib/dateUtils";
import toast, { Toaster } from "react-hot-toast";
import { uploadFiles } from "@/api/uploads";
import ProgressViewModal from "../../components/ProgressViewModal";
import ProgressEditModal from "../../components/ProgressEditModal";

import Sidebar from "../../components/layout/Sidebar";
import Navbar from "../../components/layout/Navbar";

const hasDelayedStage = (stages = []) =>
  Array.isArray(stages) &&
  stages.some(
    (stage) =>
      (!stage.completed && stage.status === "delayed") ||
      (Array.isArray(stage.subStages) &&
        stage.subStages.some((sub) => !sub.completed && sub.status === "delayed"))
  );

const formatOrderStatus = (status, contractStatus) => {
  if (status === "completed") return "Completed";
  if (status === "site_inspection") return "Installation";
  if (status === "processing") return "Fabrication";
  if (status === "approved") return "Pending";
  if (status === "contract_accepted") return "Accepted";
  if (status === "contract_sent") return "Pending";
  if (status === "admin_review") return "Pending";
  if (status === "order_submitted") return "Pending";
  if (status === "cancelled") return "Cancelled";
  return contractStatus === "accepted" ? "Accepted" : "Pending";
};

const getProjectStatus = (order) => {
  if (hasDelayedStage(order.progress_stages)) return "Delayed";

  const scheduleStage = Array.isArray(order.progress_stages)
    ? order.progress_stages.find((stage) =>
        ["installation_scheduling", "installation_scheduled", "installation_agreement"].includes(
          (stage.key || "").toString().toLowerCase()
        )
      )
    : null;

  if (scheduleStage?.customerResponse === "reschedule_requested") {
    return "Installation Reschedule Requested";
  }

  return formatOrderStatus(order.status, order.contract_status);
};

const mapProgressFromStatus = (status, progress) => {
  if (typeof progress === "number") return progress;
  if (status === "completed") return 100;
  if (status === "site_inspection") return 70;
  if (status === "processing") return 65;
  if (status === "approved") return 25;
  if (status === "contract_accepted") return 50;
  if (status === "contract_sent") return 25;
  return 15;
};

const hasFinalStageCompleted = (stages = []) =>
  Array.isArray(stages) &&
  stages.length > 0 &&
  stages[stages.length - 1].completed === true;

const canCancelProject = (project) => {
  const progress = Number(project.progress) || 0;
  const status = String(project.status || "").toLowerCase();

  if (progress >= 100) return false;
  if (status === "completed") return false;
  if (status === "cancelled") return false;
  if (hasFinalStageCompleted(project.stages)) return false;

  return true;
};

function ProgressMonitor() {
  const [isSidebarOpen, setIsSidebarOpen] =
    useState(() => {
      if (typeof window === "undefined") return true;
      const stored = localStorage.getItem("sidebarOpen");
      return stored !== null ? JSON.parse(stored) : true;
    });

  const [currentPage, setCurrentPage] =
    useState(1);

  useEffect(() => {
    localStorage.setItem("sidebarOpen", JSON.stringify(isSidebarOpen));
  }, [isSidebarOpen]);

  const [statusFilter, setStatusFilter] =
    useState("Pending");

  const [search, setSearch] =
    useState("");

  const [showEditModal, setShowEditModal] =
    useState(false);

  const [showViewModal, setShowViewModal] = useState(false);

  const [selectedProject, setSelectedProject] =
    useState(null);

  const [cancelConfirm, setCancelConfirm] = useState({ open: false, id: null });
  const [cancellingId, setCancellingId] = useState(null);

  const rowsPerPage = 5;

  const [projectList, setProjectList] = useState([]);
  const [projectLoading, setProjectLoading] = useState(false);

  const filteredProjects =
    projectList.filter((project) => {
      const matchSearch =
        project.client
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        project.product
          .toLowerCase()
          .includes(search.toLowerCase());

      const matchStatus =
        statusFilter === "All"
          ? true
          : statusFilter === "Pending"
          ? ["Pending", "Installation Reschedule Requested", "Accepted"].includes(project.status)
          : statusFilter === "Installation Reschedule Requested"
          ? project.status === "Installation Reschedule Requested"
          : project.status === statusFilter;

      return matchSearch && matchStatus;
    });

  const lastIndex =
    currentPage * rowsPerPage;

  const firstIndex =
    lastIndex - rowsPerPage;

  const currentProjects =
    filteredProjects.slice(
      firstIndex,
      lastIndex
    );

  const totalPages = Math.ceil(
    filteredProjects.length / rowsPerPage
  );

  useEffect(() => {
    const fetchProjects = async () => {
      setProjectLoading(true);
      try {
        const response = await getAdminOrders();
        const orders = response.orders || [];
        const projects = orders
          .filter((order) =>
            [
              "approved",
              "admin_review",
              "contract_sent",
              "contract_accepted",
              "site_inspection",
              "processing",
              "completed",
            ].includes(order.status)
          )
          .map((order) => ({
            id: order._id || order.id,
            client:
              order.customer_name ||
              `${order.customer?.first_name || ""} ${order.customer?.last_name || ""}`.trim() ||
              "Unknown",
            product:
              order.items && order.items.length > 0
                ? order.items[0].name || order.items[0].category || "Project"
                : "Project",
            inspection:
              order.inspection_status && order.inspection_status !== "pending"
                ? order.inspection_status.charAt(0).toUpperCase() + order.inspection_status.slice(1)
                : order.inspection_date
                ? formatDateToMMDDYYYY(order.inspection_date)
                : "TBD",
            installation:
              order.inspection_date
                ? formatDateToMMDDYYYY(order.inspection_date)
                : "TBD",
            progress: mapProgressFromStatus(order.status, order.progress),
            stages: order.progress_stages || [],
            status: getProjectStatus(order),
            statusKey: order.status,
            contract_status: order.contract_status,
            payment_status: order.payment_status,
            inspection_status: order.inspection_status,
            inspection_date: order.inspection_date,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
            contract_terms: order.contract_terms,
            rawOrder: order,
          }));
        setProjectList(projects);
      } catch (error) {
        console.error("Failed to load progress monitor projects", error);
        setProjectList([]);
      } finally {
        setProjectLoading(false);
      }
    };

    fetchProjects();
  }, []);

  const handleSave = async (updated, fileContexts = [], onUploadProgress) => {
    let updatedProject = { ...updated };
    try {
      if (fileContexts && fileContexts.length > 0) {
        const files = fileContexts.map((ctx) => ctx.file);
        const res = await uploadFiles(files, onUploadProgress);
        const uploadedUrls = (res.files || []).map((f) => f.url).filter(Boolean);

        uploadedUrls.forEach((url, index) => {
          const context = fileContexts[index];
          if (typeof context.subIndex === "number") {
            updatedProject.stages[context.stageIndex].subStages[context.subIndex].images = [
              ...(updatedProject.stages[context.stageIndex].subStages[context.subIndex].images || []),
              url,
            ];
          } else {
            updatedProject.stages[context.stageIndex].images = [
              ...(updatedProject.stages[context.stageIndex].images || []),
              url,
            ];
          }
        });
      }

      if (updatedProject.id) {
        const response = await updateOrderProgress(updatedProject.id, {
          progress: updatedProject.progress,
          status: updatedProject.status,
          installation_date: updatedProject.installation,
          stages: updatedProject.stages,
          proof_images: [],
        });

        if (response?.order) {
          const savedOrder = response.order;
          updatedProject = {
            ...updatedProject,
            rawOrder: savedOrder,
            statusKey: savedOrder.status,
            contract_status: savedOrder.contract_status,
            payment_status: savedOrder.payment_status,
            inspection_status: savedOrder.inspection_status,
            inspection_date: savedOrder.inspection_date,
            createdAt: savedOrder.createdAt,
            updatedAt: savedOrder.updatedAt,
            contract_terms: savedOrder.contract_terms,
            progress: mapProgressFromStatus(savedOrder.status, savedOrder.progress),
            stages: savedOrder.progress_stages || [],
            progress_stages: savedOrder.progress_stages || [],
            status: getProjectStatus(savedOrder),
          };
        }
      }

      setProjectList((items) =>
        items.map((item) => (item.id === updatedProject.id ? updatedProject : item))
      );
      setSelectedProject(updatedProject);
    } catch (err) {
      console.error("Failed to save progress", err);
      throw err;
    }
  };

  const handleTimelineOrderChange = (savedOrder) => {
    if (!savedOrder) return;
    const updatedProject = {
      ...(selectedProject || {}),
      id: savedOrder._id || savedOrder.id || selectedProject?.id,
      client:
        savedOrder.customer_name ||
        `${savedOrder.customer?.first_name || ""} ${savedOrder.customer?.last_name || ""}`.trim() ||
        selectedProject?.client ||
        "Unknown",
      product:
        savedOrder.items && savedOrder.items.length > 0
          ? savedOrder.items[0].name || savedOrder.items[0].category || "Project"
          : selectedProject?.product || "Project",
      inspection:
        savedOrder.inspection_status && savedOrder.inspection_status !== "pending"
          ? savedOrder.inspection_status.charAt(0).toUpperCase() + savedOrder.inspection_status.slice(1)
          : savedOrder.inspection_date
          ? formatDateToMMDDYYYY(savedOrder.inspection_date)
          : "TBD",
      installation: savedOrder.inspection_date ? formatDateToMMDDYYYY(savedOrder.inspection_date) : "TBD",
      progress: mapProgressFromStatus(savedOrder.status, savedOrder.progress),
      stages: savedOrder.progress_stages || [],
      progress_stages: savedOrder.progress_stages || [],
      status: getProjectStatus(savedOrder),
      statusKey: savedOrder.status,
      contract_status: savedOrder.contract_status,
      payment_status: savedOrder.payment_status,
      inspection_status: savedOrder.inspection_status,
      inspection_date: savedOrder.inspection_date,
      createdAt: savedOrder.createdAt,
      updatedAt: savedOrder.updatedAt,
      contract_terms: savedOrder.contract_terms,
      rawOrder: savedOrder,
    };

    setProjectList((items) =>
      items.map((item) => (item.id === updatedProject.id ? updatedProject : item))
    );
    setSelectedProject(updatedProject);
  };

  const requestCancel = (orderId) => {
    setCancelConfirm({ open: true, id: orderId });
  };

  const closeCancelModal = () => setCancelConfirm({ open: false, id: null });

  const handleConfirmCancel = async () => {
    const orderId = cancelConfirm.id;
    setCancelConfirm({ open: false, id: null });
    if (!orderId) return;
    const prev = projectList.find((p) => p.id === orderId);
    const prevStatus = prev?.statusKey || prev?.status || null;
    try {
      setCancellingId(orderId);
      const res = await updateOrderStatus(orderId, { status: "cancelled" });
      if (res && res.order) {
        const saved = res.order;
        setProjectList((prevList) =>
          prevList.map((p) =>
            p.id === orderId
              ? {
                  ...p,
                  rawOrder: saved,
                  statusKey: saved.status,
                  contract_status: saved.contract_status,
                  payment_status: saved.payment_status,
                  inspection_status: saved.inspection_status,
                  inspection_date: saved.inspection_date,
                  createdAt: saved.createdAt,
                  updatedAt: saved.updatedAt,
                  contract_terms: saved.contract_terms,
                  progress: mapProgressFromStatus(saved.status, saved.progress),
                  stages: saved.progress_stages || [],
                  progress_stages: saved.progress_stages || [],
                  status: getProjectStatus(saved),
                }
              : p
          )
        );

        toast((t) => (
          <div className="flex items-center justify-between gap-4">
            <div>Order cancelled</div>
            <div className="flex items-center gap-2">
              {prevStatus && (
                <button
                  onClick={async () => {
                    toast.dismiss(t.id);
                    try {
                      const undoRes = await updateOrderStatus(orderId, { status: prevStatus });
                      if (undoRes && undoRes.order) {
                        const restored = undoRes.order;
                        setProjectList((prevList) =>
                          prevList.map((p) =>
                            p.id === orderId
                              ? {
                                  ...p,
                                  rawOrder: restored,
                                  statusKey: restored.status,
                                  contract_status: restored.contract_status,
                                  payment_status: restored.payment_status,
                                  inspection_status: restored.inspection_status,
                                  inspection_date: restored.inspection_date,
                                  createdAt: restored.createdAt,
                                  updatedAt: restored.updatedAt,
                                  contract_terms: restored.contract_terms,
                                  progress: mapProgressFromStatus(restored.status, restored.progress),
                                  stages: restored.progress_stages || [],
                                  progress_stages: restored.progress_stages || [],
                                  status: getProjectStatus(restored),
                                }
                              : p
                          )
                        );
                        toast.success("Order restored");
                      }
                    } catch (e) {
                      console.error("Failed to restore order", e);
                      toast.error("Failed to restore order");
                    }
                  }}
                  className="text-sm text-blue-600"
                >
                  Undo
                </button>
              )}
            </div>
          </div>
        ), { duration: 6000 });
      } else {
        // fallback: mark locally
        setProjectList((prevList) => prevList.map((p) => (p.id === orderId ? { ...p, status: "Cancelled", statusKey: "cancelled" } : p)));
        toast((t) => (
          <div className="flex items-center justify-between gap-4">
            <div>Order cancelled</div>
            <div className="flex items-center gap-2">
              {prevStatus && (
                <button
                  onClick={async () => {
                    toast.dismiss(t.id);
                    try {
                      const undoRes = await updateOrderStatus(orderId, { status: prevStatus });
                      if (undoRes && undoRes.order) {
                        const restored = undoRes.order;
                        setProjectList((prevList) =>
                          prevList.map((p) =>
                            p.id === orderId
                              ? {
                                  ...p,
                                  rawOrder: restored,
                                  statusKey: restored.status,
                                  contract_status: restored.contract_status,
                                  payment_status: restored.payment_status,
                                  inspection_status: restored.inspection_status,
                                  inspection_date: restored.inspection_date,
                                  createdAt: restored.createdAt,
                                  updatedAt: restored.updatedAt,
                                  contract_terms: restored.contract_terms,
                                  progress: mapProgressFromStatus(restored.status, restored.progress),
                                  stages: restored.progress_stages || [],
                                  progress_stages: restored.progress_stages || [],
                                  status: getProjectStatus(restored),
                                }
                              : p
                          )
                        );
                        toast.success("Order restored");
                      }
                    } catch (e) {
                      console.error("Failed to restore order", e);
                      toast.error("Failed to restore order");
                    }
                  }}
                  className="text-sm text-blue-600"
                >
                  Undo
                </button>
              )}
            </div>
          </div>
        ), { duration: 6000 });
      }
    } catch (err) {
      console.error("Failed to cancel order", err);
      toast.error(err?.data?.message || err?.message || "Failed to cancel order.");
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      <Toaster position="bottom-right" />
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
            <h1 className="text-3xl font-bold">
              Progress Monitor
            </h1>

            <p className="mt-2 text-red-100">
              Monitor fabrication and installation progress.
            </p>
          </div>

          {/* FILTERS */}

          <div className="bg-white rounded-3xl shadow mt-6 p-6">

            <div className="relative">
              <Search
                size={18}
                className="absolute left-4 top-4 text-gray-400"
              />

              <input
                type="text"
                placeholder="Search client or product..."
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                className="w-full pl-12 pr-4 py-3 border rounded-xl"
              />
            </div>

            <div className="flex flex-wrap gap-3 mt-4">
              {[
                "All",
                "Pending",
                "Cutting",
                "Fabrication",
                "Installation",
                "Installation Reschedule Requested",
                "Completed",
                "Delayed",
              ].map((status) => (
                <button
                  key={status}
                  onClick={() =>
                    setStatusFilter(status)
                  }
                  className={`px-4 py-2 rounded-xl ${
                    statusFilter === status
                      ? "bg-red-600 text-white"
                      : "bg-gray-100"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

          </div>

          {/* TABLE */}

          <div className="bg-white rounded-3xl shadow mt-6 overflow-hidden">

            <div className="overflow-x-auto">

              <table className="w-full">

                <thead className="bg-gray-50">

                  <tr>
                    <th className="w-16 p-4 text-center">No.</th>
                    <th className="p-4 text-left">Client</th>
                    <th className="p-4 text-left">Product</th>
                    <th className="p-4 text-left">Site Inspection</th>
                    <th className="p-4 text-left">Est. Installation</th>
                    <th className="p-4 text-left">Progress</th>
                    <th className="p-4 text-left">Status</th>
                    <th className="p-4 text-center">Actions</th>
                  </tr>

                </thead>

                <tbody>
                  {projectLoading && (
                    <tr>
                      <td className="p-6 text-center text-gray-500" colSpan={8}>
                        Loading projects...
                      </td>
                    </tr>
                  )}

                  {!projectLoading && currentProjects.map(
                    (project, index) => (
                      <tr
                        key={index}
                        className="border-t hover:bg-gray-50"
                      >
                        <td className="w-16 p-4 text-center font-semibold text-slate-600">
                          {firstIndex + index + 1}
                        </td>

                        <td className="p-4">
                          {project.client}
                        </td>

                        <td className="p-4">
                          {project.product}
                        </td>

                        <td className="p-4">
                          {project.inspection}
                        </td>

                        <td className="p-4">
                          {project.installation}
                        </td>

                        <td className="p-4">

                          <div className="w-full bg-gray-200 rounded-full h-3">

                            <div
                              className={`h-3 rounded-full ${
                                project.progress <= 25
                                  ? "bg-red-500"
                                  : project.progress <= 50
                                  ? "bg-orange-500"
                                  : project.progress <= 75
                                  ? "bg-yellow-500"
                                  : project.progress < 100
                                  ? "bg-blue-500"
                                  : "bg-green-600"
                              }`}
                              style={{
                                width: `${project.progress}%`,
                              }}
                            />

                          </div>

                          <span className="font-semibold text-sm">
                            {project.progress}%
                          </span>

                        </td>

                        <td className="p-4">
                          <span className="px-3 py-1 rounded-full bg-gray-100">
                            {project.status}
                          </span>
                        </td>

                        <td className="p-4">

                          <div className="flex justify-center gap-2">

                            <button className="bg-blue-100 text-blue-600 p-2 rounded-lg">
                                <Eye size={18} onClick={() => {
                                  setSelectedProject(project);
                                  setShowViewModal(true);
                                }} />
                            </button>

                            <button
                              onClick={() => {
                                setSelectedProject(project);
                                setShowEditModal(true);
                              }}
                              className="bg-yellow-100 text-yellow-600 p-2 rounded-lg"
                            >
                              <Pencil size={18} />
                            </button>

                            {canCancelProject(project) && (
                              <button
                                onClick={() => {
                                  setSelectedProject(project);
                                  requestCancel(project.id);
                                }}
                                disabled={cancellingId === project.id}
                                className={`p-2 rounded-lg ${cancellingId === project.id ? "bg-red-200 text-red-300" : "bg-red-100 text-red-600"}`}
                                title="Cancel project"
                              >
                                <X size={18} />
                              </button>
                            )}

                          </div>

                        </td>

                      </tr>
                    )
                  )}

                  {!projectLoading && currentProjects.length === 0 && (
                    <tr>
                      <td className="p-6 text-center text-gray-500" colSpan={8}>
                        No projects found.
                      </td>
                    </tr>
                  )}

                </tbody>

              </table>

            </div>

            {/* PAGINATION */}

            <div className="flex justify-center items-center p-4 border-t bg-gray-50 gap-4">

              <span>
                Page {currentPage} of {totalPages}
              </span>

              <div className="flex gap-2">

                <button
                  disabled={currentPage === 1}
                  onClick={() =>
                    setCurrentPage(currentPage - 1)
                  }
                  className="px-4 py-2 border rounded-lg"
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
                          : "border"
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
                  className="px-4 py-2 border rounded-lg"
                >
                  Next
                </button>

              </div>

            </div>

          </div>

          {showViewModal && selectedProject && (
            <ProgressViewModal
              project={selectedProject}
              onClose={() => setShowViewModal(false)}
              onOrderChange={handleTimelineOrderChange}
            />
          )}

          {showEditModal && selectedProject && (
            <ProgressEditModal project={selectedProject} onClose={() => setShowEditModal(false)} onSave={handleSave} />
          )}

          {cancelConfirm.open && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="absolute inset-0" onClick={closeCancelModal} />
              <div className="relative bg-white rounded-3xl shadow-lg p-6 w-full max-w-md">
                <h2 className="text-2xl font-bold mb-2">Confirm Cancel</h2>
                <p className="text-sm text-slate-600 mb-6">Are you sure you want to cancel this project/order? This action will mark the order as cancelled.</p>
                <div className="flex justify-end gap-3">
                  <button onClick={closeCancelModal} className="px-4 py-2 rounded-lg bg-gray-100 text-slate-700 hover:bg-gray-200 transition">Close</button>
                  <button onClick={handleConfirmCancel} disabled={cancellingId === cancelConfirm.id} className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                    {cancellingId === cancelConfirm.id ? "Cancelling..." : "Confirm Cancel"}
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

export default ProgressMonitor;

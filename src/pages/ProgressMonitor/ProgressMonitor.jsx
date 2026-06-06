import { useEffect, useState } from "react";
import {
  Search,
  Eye,
  Pencil,
} from "lucide-react";

import { getAdminOrders } from "@/api/orders";

import Sidebar from "../../components/layout/Sidebar";
import Navbar from "../../components/layout/Navbar";

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
    useState("All");

  const [search, setSearch] =
    useState("");

  const [showEditModal, setShowEditModal] =
    useState(false);

  const [selectedProject, setSelectedProject] =
    useState(null);

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

  const formatOrderStatus = (status, contractStatus) => {
    if (status === "completed") return "Completed";
    if (status === "site_inspection") return "Installation";
    if (status === "processing") return "Fabrication";
    if (status === "contract_accepted") return "Accepted";
    if (status === "contract_sent") return "Pending";
    if (status === "admin_review") return "Pending";
    if (status === "order_submitted") return "Pending";
    if (status === "cancelled") return "Cancelled";
    return contractStatus === "accepted" ? "Accepted" : "Pending";
  };

  const mapProgressFromStatus = (status) => {
    if (status === "completed") return 100;
    if (status === "site_inspection") return 70;
    if (status === "processing") return 65;
    if (status === "contract_accepted") return 50;
    if (status === "contract_sent") return 25;
    return 15;
  };

  useEffect(() => {
    const fetchProjects = async () => {
      setProjectLoading(true);
      try {
        const response = await getAdminOrders();
        const orders = response.orders || [];
        const projects = orders
          .filter((order) =>
            [
              "contract_accepted",
              "site_inspection",
              "processing",
              "completed",
            ].includes(order.status) ||
            order.contract_status === "accepted"
          )
          .map((order) => ({
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
                ? new Date(order.inspection_date).toLocaleDateString()
                : "TBD",
            installation:
              order.inspection_date
                ? new Date(order.inspection_date).toLocaleDateString()
                : "TBD",
            progress: mapProgressFromStatus(order.status),
            status: formatOrderStatus(order.status, order.contract_status),
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

                  {currentProjects.map(
                    (project, index) => (
                      <tr
                        key={index}
                        className="border-t hover:bg-gray-50"
                      >
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
                              <Eye size={18} />
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

                          </div>

                        </td>

                      </tr>
                    )
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

          {/* EDIT MODAL */}

          {showEditModal && selectedProject && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">

              <div className="bg-white rounded-3xl p-6 w-full max-w-lg">

                <h2 className="text-2xl font-bold mb-6">
                  Edit Project
                </h2>

                <input
                  type="number"
                  value={selectedProject.progress}
                  onChange={(e) =>
                    setSelectedProject({
                      ...selectedProject,
                      progress: Number(e.target.value),
                    })
                  }
                  className="w-full border p-3 rounded-xl mb-4"
                />

                <select
                  value={selectedProject.status}
                  onChange={(e) =>
                    setSelectedProject({
                      ...selectedProject,
                      status: e.target.value,
                    })
                  }
                  className="w-full border p-3 rounded-xl"
                >
                  <option>Pending</option>
                  <option>Cutting</option>
                  <option>Fabrication</option>
                  <option>Installation</option>
                  <option>Completed</option>
                  <option>Delayed</option>
                </select>

                <div className="flex justify-end gap-3 mt-6">

                  <button
                    onClick={() =>
                      setShowEditModal(false)
                    }
                    className="px-4 py-2 bg-gray-200 rounded-xl"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={() => {
                      setProjectList(
                        projectList.map((item) =>
                          item.client ===
                          selectedProject.client
                            ? selectedProject
                            : item
                        )
                      );

                      setShowEditModal(false);
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-xl"
                  >
                    Save Changes
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
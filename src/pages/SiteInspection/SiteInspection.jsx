import { useEffect, useState } from "react";
import {
  Search,
  Plus,
  Eye,
  Pencil,
  Trash2,
} from "lucide-react";

import { getAdminOrders } from "@/api/orders";
import Sidebar from "../../components/layout/Sidebar";
import Navbar from "../../components/layout/Navbar";

function SiteInspection() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("sidebarOpen");
    return stored !== null ? JSON.parse(stored) : true;
  });
  const [showModal, setShowModal] = useState(false);
  const [inspections, setInspections] = useState([]);
  const [inspectionsLoading, setInspectionsLoading] = useState(false);

  useEffect(() => {
    const fetchSiteInspections = async () => {
      setInspectionsLoading(true);
      try {
        const response = await getAdminOrders({ status: "site_inspection" });
        setInspections(response.orders || []);
      } catch (error) {
        console.error("Failed to load site inspection records:", error);
        setInspections([]);
      } finally {
        setInspectionsLoading(false);
      }
    };

    fetchSiteInspections();
  }, []);

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
                  placeholder="Search inspections..."
                  className="w-full pl-12 pr-4 py-3 border rounded-xl focus:outline-none focus:border-red-500"
                />
              </div>

              <button
                onClick={() => setShowModal(true)}
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
                        Loading site inspections...
                      </td>
                    </tr>
                  ) : inspections.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500">
                        No site inspections available.
                      </td>
                    </tr>
                  ) : (
                    inspections.map((inspection) => {
                      const clientName = inspection.customer
                        ? `${inspection.customer.first_name || ""} ${inspection.customer.last_name || ""}`.trim() || inspection.customer.email || "Customer"
                        : "Customer";
                      const phone = inspection.customer?.phone || "—";
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
                              <button className="text-blue-600 hover:text-blue-800">
                                <Eye size={18} />
                              </button>
                              <button className="text-orange-500 hover:text-orange-700">
                                <Pencil size={18} />
                              </button>
                              <button className="text-red-600 hover:text-red-800">
                                <Trash2 size={18} />
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

                  <input
                    type="text"
                    placeholder="Client Name"
                    className="border rounded-xl p-3"
                  />

                  <input
                    type="text"
                    placeholder="Phone Number"
                    className="border rounded-xl p-3"
                  />

                  <input
                    type="text"
                    placeholder="Product"
                    className="border rounded-xl p-3"
                  />

                  <select className="border rounded-xl p-3">

                    <option>
                      Residential
                    </option>

                    <option>
                      Commercial
                    </option>

                  </select>

                </div>

                <textarea
                  rows="4"
                  placeholder="Site Address"
                  className="w-full border rounded-xl p-3 mt-6"
                />

                <div className="grid md:grid-cols-2 gap-6 mt-6">

                  <input
                    type="date"
                    className="border rounded-xl p-3"
                  />

                  <input
                    type="text"
                    placeholder="Estimated Cost"
                    className="border rounded-xl p-3"
                  />

                </div>

                <textarea
                  rows="4"
                  placeholder="Inspection Notes"
                  className="w-full border rounded-xl p-3 mt-6"
                />

                <input
                  type="file"
                  multiple
                  className="w-full border rounded-xl p-3 mt-6"
                />

                <div className="flex justify-end gap-3 mt-8">

                  <button
                    onClick={() => setShowModal(false)}
                    className="px-6 py-3 bg-gray-200 rounded-xl"
                  >
                    Cancel
                  </button>

                  <button className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700">
                    Save Inspection
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

export default SiteInspection;
import { useEffect, useState } from "react";
import {
  FileText,
  CheckCircle,
  Eye,
  Download,
} from "lucide-react";

import Sidebar from "../../components/layout/Sidebar";
import Navbar from "../../components/layout/Navbar";

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

  const rowsPerPage = 5;

  const receipts = [
    {
      trackingId: "TRX-1001",
      customer: "Juan Dela Cruz",
      inspection: "Sliding Window",
      date: "2026-01-10",
      amount: "₱25,000",
      status: "Paid",
    },
    {
      trackingId: "TRX-1002",
      customer: "Maria Santos",
      inspection: "Glass Door",
      date: "2026-01-12",
      amount: "₱45,000",
      status: "Paid",
    },
    {
      trackingId: "TRX-1003",
      customer: "Mark Reyes",
      inspection: "Storefront",
      date: "2026-01-13",
      amount: "₱80,000",
      status: "Pending",
    },
    {
      trackingId: "TRX-1004",
      customer: "Ana Cruz",
      inspection: "Casement Window",
      date: "2026-01-15",
      amount: "₱30,000",
      status: "Paid",
    },
    {
      trackingId: "TRX-1005",
      customer: "Pedro Garcia",
      inspection: "Sliding Door",
      date: "2026-01-16",
      amount: "₱50,000",
      status: "Paid",
    },
    {
      trackingId: "TRX-1006",
      customer: "John Smith",
      inspection: "Tempered Glass",
      date: "2026-01-18",
      amount: "₱90,000",
      status: "Pending",
    },
  ];

  const completedProjects = [
    {
      trackingId: "PRJ-2001",
      customer: "Michael Tan",
      inspection: "Storefront",
      date: "2026-02-01",
      amount: "₱150,000",
      status: "Completed",
    },
    {
      trackingId: "PRJ-2002",
      customer: "Sarah Lim",
      inspection: "Glass Door",
      date: "2026-02-05",
      amount: "₱80,000",
      status: "Completed",
    },
    {
      trackingId: "PRJ-2003",
      customer: "Robert Cruz",
      inspection: "Window System",
      date: "2026-02-10",
      amount: "₱55,000",
      status: "Completed",
    },
    {
      trackingId: "PRJ-2004",
      customer: "Joseph Garcia",
      inspection: "Sliding Door",
      date: "2026-02-12",
      amount: "₱100,000",
      status: "Completed",
    },
    {
      trackingId: "PRJ-2005",
      customer: "Kim Reyes",
      inspection: "Glass Wall",
      date: "2026-02-15",
      amount: "₱130,000",
      status: "Completed",
    },
    {
      trackingId: "PRJ-2006",
      customer: "James Santos",
      inspection: "Tempered Glass",
      date: "2026-02-18",
      amount: "₱170,000",
      status: "Completed",
    },
  ];

  const receiptLastIndex =
    receiptPage * rowsPerPage;

  const receiptFirstIndex =
    receiptLastIndex - rowsPerPage;

  const currentReceipts = receipts.slice(
    receiptFirstIndex,
    receiptLastIndex
  );

  const receiptTotalPages = Math.ceil(
    receipts.length / rowsPerPage
  );

  const projectLastIndex =
    projectPage * rowsPerPage;

  const projectFirstIndex =
    projectLastIndex - rowsPerPage;

  const currentProjects =
    completedProjects.slice(
      projectFirstIndex,
      projectLastIndex
    );

  const projectTotalPages = Math.ceil(
    completedProjects.length / rowsPerPage
  );

  const currentData =
    activeTable === "receipts"
      ? currentReceipts
      : currentProjects;

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

          <div className="bg-gradient-to-r from-red-700 via-red-600 to-orange-500 text-white rounded-3xl p-8 shadow-lg">
            <h1 className="text-3xl font-bold">
              Transactions
            </h1>

            <p className="mt-2 text-red-100">
              Manage receipts, contracts and
              completed projects.
            </p>
          </div>

          <div className="flex gap-4 mt-6">

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

                  {currentData.map(
                    (item, index) => (
                      <tr
                        key={index}
                        className="border-t hover:bg-gray-50"
                      >
                        <td className="p-4">
                          {item.trackingId}
                        </td>

                        <td className="p-4">
                          {item.customer}
                        </td>

                        <td className="p-4">
                          {item.inspection}
                        </td>

                        <td className="p-4">
                          {item.date}
                        </td>

                        <td className="p-4 font-semibold text-green-600">
                          {item.amount}
                        </td>

                        <td className="p-4">
                          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm">
                            {item.status}
                          </span>
                        </td>

                        <td className="p-4">
                          <div className="flex justify-center gap-2">

                            <button className="p-2 rounded-lg bg-blue-100 text-blue-600">
                              <Eye size={18} />
                            </button>

                            <button className="p-2 rounded-lg bg-green-100 text-green-600">
                              <Download size={18} />
                            </button>

                          </div>
                        </td>
                      </tr>
                    )
                  )}

                </tbody>

              </table>

            </div>

            {/* Pagination */}

            <div className="flex justify-center items-center p-4 border-t bg-gray-50 gap-4">

              <span className="text-sm text-gray-600">
                Page{" "}
                {activeTable === "receipts"
                  ? receiptPage
                  : projectPage}
                {" "}of{" "}
                {activeTable === "receipts"
                  ? receiptTotalPages
                  : projectTotalPages}
              </span>

              <div className="flex gap-2">

                <button
                  disabled={
                    activeTable === "receipts"
                      ? receiptPage === 1
                      : projectPage === 1
                  }
                  onClick={() => {
                    if (
                      activeTable === "receipts"
                    ) {
                      setReceiptPage(
                        receiptPage - 1
                      );
                    } else {
                      setProjectPage(
                        projectPage - 1
                      );
                    }
                  }}
                  className="px-4 py-2 border rounded-lg"
                >
                  Previous
                </button>

                {[...Array(
                  activeTable === "receipts"
                    ? receiptTotalPages
                    : projectTotalPages
                )].map((_, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      if (
                        activeTable ===
                        "receipts"
                      ) {
                        setReceiptPage(
                          index + 1
                        );
                      } else {
                        setProjectPage(
                          index + 1
                        );
                      }
                    }}
                    className={`w-10 h-10 rounded-lg ${
                      (
                        activeTable ===
                        "receipts"
                          ? receiptPage
                          : projectPage
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
                      ? receiptPage ===
                        receiptTotalPages
                      : projectPage ===
                        projectTotalPages
                  }
                  onClick={() => {
                    if (
                      activeTable === "receipts"
                    ) {
                      setReceiptPage(
                        receiptPage + 1
                      );
                    } else {
                      setProjectPage(
                        projectPage + 1
                      );
                    }
                  }}
                  className="px-4 py-2 border rounded-lg"
                >
                  Next
                </button>

              </div>

            </div>

          </div>

        </main>
      </div>
    </div>
  );
}

export default Transactions;
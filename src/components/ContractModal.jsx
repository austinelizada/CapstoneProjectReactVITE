import { X, Download, Printer } from "lucide-react";
import logo from "@/assets/images/ACGCLOGO1.png";

function ContractModal({ isOpen, onClose, inspection, contractData }) {
  if (!isOpen || !inspection || !contractData) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const element = document.getElementById("contract-content");
    if (!element) return;
    
    const printWindow = window.open("", "", "height=1000,width=1200");
    printWindow.document.write(element.innerHTML);
    printWindow.document.close();
    printWindow.print();
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(value || 0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-5xl max-h-[90vh] overflow-auto bg-white rounded-2xl shadow-2xl flex flex-col">
        {/* Header with controls */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Generated Contract</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
            >
              <Printer size={18} />
              Print
            </button>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition"
            >
              <Download size={18} />
              Download
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Contract content */}
        <div id="contract-content" className="flex-1 overflow-auto p-8 bg-white">
          {/* Header Section */}
          <div className="grid grid-cols-3 items-start mb-8 pb-8 border-b-2 border-gray-800">
            <div className="flex items-center gap-2">
              <img src={logo} alt="ACGC" className="w-16 h-12 object-contain" />
              <div>
                <h1 className="font-bold text-lg">ACGC</h1>
                <p className="text-xs text-gray-600">Glass & Aluminum Services</p>
              </div>
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold tracking-wide">CUSTOMER ORDER CONTRACT</h2>
            </div>
            <div className="text-right space-y-1 text-sm">
              <div>
                <span className="font-semibold">CONTRACT NO:</span>
                <span className="ml-2">{contractData.contractNumber}</span>
              </div>
              <div>
                <span className="font-semibold">TRACKING NO:</span>
                <span className="ml-2">{contractData.trackingNumber}</span>
              </div>
              <div>
                <span className="font-semibold">DATE:</span>
                <span className="ml-2">{contractData.contractDate}</span>
              </div>
              <div className="mt-2">
                <span className="inline-block bg-amber-700 text-white px-3 py-1 text-xs font-bold rounded">
                  {contractData.status}
                </span>
              </div>
            </div>
          </div>

          {/* Customer Information */}
          <div className="mb-8">
            <h3 className="text-sm font-bold uppercase tracking-wide mb-4 pb-2 border-b border-gray-300">
              CUSTOMER INFORMATION
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="border border-gray-300 rounded p-4">
                <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Customer Name</div>
                <div className="font-semibold text-gray-900">{inspection.customer_name || "N/A"}</div>
              </div>
              <div className="border border-gray-300 rounded p-4">
                <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Email Address</div>
                <div className="font-semibold text-gray-900">{inspection.customer_email || "N/A"}</div>
              </div>
              <div className="border border-gray-300 rounded p-4">
                <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Contact Number</div>
                <div className="font-semibold text-gray-900">{inspection.phone || "N/A"}</div>
              </div>
              <div className="border border-gray-300 rounded p-4">
                <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Order Type</div>
                <div className="font-semibold text-gray-900">
                  {inspection.order_type === "online_order" ? "Online Order" : "Custom Fabrication"}
                </div>
              </div>
            </div>
            <div className="mt-4 border border-gray-300 rounded p-4">
              <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Project Address</div>
              <div className="font-semibold text-gray-900">{inspection.site_address || "N/A"}</div>
            </div>
          </div>

          {/* Order Details Table */}
          <div className="mb-8">
            <h3 className="text-sm font-bold uppercase tracking-wide mb-4 pb-2 border-b border-gray-300">
              ORDER DETAILS
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead className="bg-gray-900 text-white">
                  <tr>
                    <th className="border border-gray-300 px-4 py-3 text-left font-bold">PRODUCT / DESCRIPTION</th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-bold">QTY</th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-bold">WIDTH</th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-bold">HEIGHT (MM)</th>
                    <th className="border border-gray-300 px-4 py-3 text-right font-bold">UNIT PRICE</th>
                    <th className="border border-gray-300 px-4 py-3 text-right font-bold">AMOUNT</th>
                  </tr>
                </thead>
                <tbody>
                  {inspection.items && inspection.items.length > 0 ? (
                    inspection.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="border border-gray-300 px-4 py-3">{item.name || "Item"}</td>
                        <td className="border border-gray-300 px-4 py-3 text-center">{item.qty || 0}</td>
                        <td className="border border-gray-300 px-4 py-3 text-center">{item.width || "—"}</td>
                        <td className="border border-gray-300 px-4 py-3 text-center">{item.height || "—"}</td>
                        <td className="border border-gray-300 px-4 py-3 text-right">
                          {formatCurrency(item.unit_price)}
                        </td>
                        <td className="border border-gray-300 px-4 py-3 text-right font-semibold">
                          {formatCurrency((item.unit_price || 0) * (item.qty || 1))}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="border border-gray-300 px-4 py-3 text-center text-gray-500">
                        No items added
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <div className="w-64">
                <div className="flex justify-between py-2 border-b border-amber-700 font-bold text-amber-700">
                  <span>SUBTOTAL</span>
                  <span>{formatCurrency(contractData.subtotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="mb-8 grid grid-cols-2 gap-8">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide mb-4 pb-2 border-b border-gray-300">
                PAYMENT SUMMARY
              </h3>
              <div className="bg-gray-900 text-white p-6 rounded">
                <h4 className="text-xs font-bold uppercase tracking-wide mb-4">FINANCIAL OVERVIEW</h4>
                <div className="mb-4">
                  <div className="text-xs text-gray-300 uppercase mb-2">Total Project Cost</div>
                  <div className="text-3xl font-bold">₱ {(contractData.subtotal / 1000).toFixed(1)}K</div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Required Down Payment (50%)</span>
                    <span className="font-bold">{formatCurrency(contractData.subtotal * 0.5)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Remaining Balance</span>
                    <span className="font-bold">{formatCurrency(contractData.subtotal * 0.5)}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-3">
                    Balance Due Upon Completion & Installation
                  </div>
                </div>
              </div>
            </div>

            {/* Customer Agreement */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide mb-4 pb-2 border-b border-gray-300">
                CUSTOMER AGREEMENT
              </h3>
              <ul className="space-y-3 text-xs text-gray-700">
                <li className="flex gap-3">
                  <span className="text-amber-700 font-bold">•</span>
                  <span>
                    This contract confirms the customers approval of the products, specifications, and quantities listed above as agreed with ACGC Glass & Aluminum Services.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-amber-700 font-bold">•</span>
                  <span>
                    A down payment of 50% is required to commence production. The remaining balance is due upon completion and delivery of the state.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-amber-700 font-bold">•</span>
                  <span>
                    Changes to the order after production begins may incur additional charges. Cancellations after production commencement are non-refundable.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-amber-700 font-bold">•</span>
                  <span>
                    ACGC provides a 1-year workmanship warranty. Glass breakage due to external cause or misuse is not covered under warranty.
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Authorization & Signatures */}
          <div className="mt-12 pt-8 border-t-2 border-gray-300">
            <h3 className="text-sm font-bold uppercase tracking-wide mb-6 pb-2 border-b border-gray-300">
              AUTHORIZATION & SIGNATURES
            </h3>
            <div className="grid grid-cols-2 gap-12">
              <div>
                <h4 className="text-xs font-bold uppercase mb-8">PREPARED BY - ACGC REPRESENTATIVE</h4>
                <div className="mb-12 h-16 border-b border-gray-800"></div>
                <div className="text-xs">
                  <p className="font-semibold">ACGC Sales Representative</p>
                  <p className="text-gray-600">ACGC Glass & Aluminum Services</p>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase mb-8">CUSTOMER APPROVAL</h4>
                <div className="mb-12 h-16 border-b border-gray-800"></div>
                <div className="text-xs">
                  <p className="font-semibold">{inspection.customer_name || "Customer Name"}</p>
                  <p className="text-gray-600">Date: ___________________</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-8 border-t border-gray-200 text-center text-xs text-gray-600">
            <p>This document is a legally binding agreement. Please keep a copy for your records.</p>
            <p className="mt-2">ACGC GLASS & ALUMINUM SERVICES</p>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          #contract-content {
            margin: 0;
            padding: 0;
            background: white;
          }
        }
      `}</style>
    </div>
  );
}

export default ContractModal;

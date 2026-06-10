import { X } from "lucide-react";
import logo from "@/assets/images/ACGCLOGO1.png";
import approvedStamp from "@/assets/approved.png";

function ContractModal({ isOpen, onClose, inspection, contractData, onAccept, onDecline, isLoading, actionError, onDownload, onDownloadPNG, onPrint }) {
  if (!isOpen || !inspection || !contractData) return null;

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(value || 0);
  };

  const orderStatusRaw = (contractData?.orderStatus || contractData?.status || "").toString().toLowerCase();
  const contractStatusRaw = (contractData?.rawContractStatus || contractData?.contractStatus || "").toString().toLowerCase();
  const isAccepted = orderStatusRaw === "contract_accepted" || contractStatusRaw === "accepted";
  const isAwaitingCustomerResponse = orderStatusRaw === "contract_sent" || contractStatusRaw === "sent";
  const actionsAllowed = Boolean(onAccept || onDecline) && isAwaitingCustomerResponse && !isAccepted;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-5xl max-h-[90vh] overflow-auto bg-white rounded-2xl shadow-2xl flex flex-col">
        {/* Header with controls */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex flex-wrap items-center justify-between gap-3 z-10">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-gray-900">Generated Contract</h2>
            {contractData?.status && (
              <p className="mt-2 text-sm text-slate-500">
                Status: <span className="font-semibold">{contractData.contractStatus || contractData.status.replace(/_/g, " ")}</span>
              </p>
            )}
            {actionError && (
              <p className="mt-2 text-sm font-medium text-red-600">{actionError}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {onDownload && (
              <button
                type="button"
                onClick={onDownload}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border text-slate-700 hover:bg-gray-50 transition"
              >
                Download PDF
              </button>
            )}
            {onDownloadPNG && (
              <button
                type="button"
                onClick={onDownloadPNG}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border text-slate-700 hover:bg-gray-50 transition"
              >
                Download PNG
              </button>
            )}
            {onPrint && (
              <button
                type="button"
                onClick={onPrint}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border text-slate-700 hover:bg-gray-50 transition"
              >
                Print Contract
              </button>
            )}
            {actionsAllowed && onAccept && (
              <button
                type="button"
                onClick={onAccept}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? "Accepting..." : "Accept Contract"}
              </button>
            )}
            {actionsAllowed && onDecline && (
              <button
                type="button"
                onClick={onDecline}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-300 bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? "Declining..." : "Decline Contract"}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Contract content */}
        <div id="contract-content" className="relative flex-1 overflow-auto p-8 bg-white">
          {isAccepted && (
            <div className="">
            </div>
          )}

          {isAccepted && (
            <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
              <img
                src={approvedStamp}
                alt="Approved stamp overlay"
                style={{ transform: "rotate(-20deg)", width: "85%", maxWidth: 1000, opacity: 0.22 }}
              />
            </div>
          )}
          {/* Header Section */}
          <div className="grid grid-cols-3 items-start mb-8 pb-8 border-b-2 border-gray-800">
            <div className="flex items-center gap-2">
              <img src={logo} alt="ACGC" className="w-16 h-12 object-contain" />
              <div>
                <h1 className="font-bold text-lg">ACGC</h1>
                <p className="text-sm text-gray-900">Glass & Aluminum Services</p>
              </div>
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold tracking-wide">ORDER CONTRACT AGREEMENT</h2>
            </div>
            <div className="text-right space-y-1 text-sm">
              <div>
                <span className="font-semibold">TRACKING ID:</span>
                <span className="ml-2">{contractData.orderNumber}</span>
              </div>
              <div>
                <span className="font-semibold">DATE:</span>
                <span className="ml-2">{contractData.contractDate}</span>
              </div>
              <div>
                <span className="font-semibold">ORDER DATE:</span>
                <span className="ml-2">{contractData.orderDate}</span>
              </div>
            </div>
          </div>

          {isAccepted && (
            <div className="mb-8 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 relative">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Contract Status</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-900">Accepted</p>
                </div>
                <div className="inline-flex items-center rounded-full border border-emerald-700 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 uppercase tracking-[0.15em] shadow-sm">
                  Online Acceptance
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-2xl border border-emerald-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Accepted By</p>
                  <p className="mt-2 font-semibold text-gray-900">{contractData.acceptedBy || contractData.customerName}</p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Acceptance Date</p>
                  <p className="mt-2 font-semibold text-gray-900">{contractData.acceptanceDate || "N/A"}</p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Contract ID</p>
                  <p className="mt-2 font-semibold text-gray-900">{contractData.contractId || contractData.orderNumber}</p>
                </div>
              </div>
            </div>
          )}

          <h3 className="text-sm font-bold uppercase tracking-wide mb-4 pb-2 border-b border-gray-300">
            CUSTOMER INFORMATION
          </h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="border border-gray-300 rounded p-4">
                <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Customer Name</div>
                <div className="font-semibold text-gray-900">{contractData.customerName || inspection.customer_name || "N/A"}</div>
              </div>
              <div className="border border-gray-300 rounded p-4">
                <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Email Address</div>
                <div className="font-semibold text-gray-900">{contractData.customerEmail || inspection.customer_email || "N/A"}</div>
              </div>
              <div className="border border-gray-300 rounded p-4">
                <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Contact Number</div>
                <div className="font-semibold text-gray-900">{contractData.customerPhone || inspection.customer_phone || "N/A"}</div>
              </div>
              <div className="border border-gray-300 rounded p-4">
                <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Order Type</div>
                <div className="font-semibold text-gray-900">{inspection.order_type === "walk_in_customer" ? "Walk-in Customer" : "Online Customer"}</div>
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="border border-gray-300 rounded p-4">
                <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Site Address</div>
                <div className="font-semibold text-gray-900">{contractData.projectLocation || inspection.shipping_address || "N/A"}</div>
              </div>
              <div className="border border-gray-300 rounded p-4">
                <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Site Inspection Date</div>
                <div className="font-semibold text-gray-900">{contractData.siteInspectionDate || "TBD"}</div>
              </div>
            </div>

            <div className="mt-4 border border-gray-300 rounded p-4 bg-slate-50">
              <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Payment Terms</div>
              <div className="font-semibold text-gray-900">{contractData.paymentTerms || "Standard payment terms apply."}</div>
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
                    <th className="border border-gray-300 px-4 py-3 text-left font-bold">CATEGORY</th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-bold">QTY</th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-bold">WIDTH</th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-bold">HEIGHT</th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-bold">AREA</th>
                    <th className="border border-gray-300 px-4 py-3 text-right font-bold">UNIT PRICE</th>
                    <th className="border border-gray-300 px-4 py-3 text-right font-bold">SUBTOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {contractData.items && contractData.items.length > 0 ? (
                    contractData.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="border border-gray-300 px-4 py-3">{item.name || "Item"}</td>
                        <td className="border border-gray-300 px-4 py-3 text-sm text-slate-600">{item.category || "N/A"}</td>
                        <td className="border border-gray-300 px-4 py-3 text-center">{item.quantity || 0}</td>
                        <td className="border border-gray-300 px-4 py-3 text-center">{item.width || "—"}</td>
                        <td className="border border-gray-300 px-4 py-3 text-center">{item.height || "—"}</td>
                        <td className="border border-gray-300 px-4 py-3 text-center">{item.area || "—"}</td>
                        <td className="border border-gray-300 px-4 py-3 text-right">{formatCurrency(item.unitPrice)}</td>
                        <td className="border border-gray-300 px-4 py-3 text-right font-semibold">{formatCurrency(item.amount)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="8" className="border border-gray-300 px-4 py-3 text-center text-gray-500">
                        No items added
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <div className="w-64">
                <div className="flex justify-between py-2 border-b border-amber-700 font-bold text-yellow-600">
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
                  <div className="text-3xl font-bold">{formatCurrency(contractData.totalProjectCost)}</div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Required Down Payment (50%)</span>
                    <span className="font-bold">{formatCurrency(contractData.downPayment)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Remaining Balance</span>
                    <span className="font-bold">{formatCurrency(contractData.totalProjectCost - contractData.downPayment)}</span>
                  </div>
                  <div className="text-xs text-yellow-400 mt-3">
                    {contractData.paymentTerms || "Balance due upon project completion unless otherwise agreed."}
                  </div>
                </div>
                  <div className="text-xs text-yellow-400 mt-3">
                    Balance Due Upon Completion & Installation
                  </div>
                </div>
              </div>
            
            {/* Customer Agreement */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide mb-4 pb-2 border-b border-gray-300">
                CUSTOMER AGREEMENT
              </h3>
              <ul className="space-y-3 text-sm text-gray-700">
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
              {isAccepted ? "ONLINE ACCEPTANCE RECORD" : "AUTHORIZATION & SIGNATURES"}
            </h3>
            {isAccepted ? (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
                <p className="text-sm font-semibold text-emerald-900">This contract was approved digitally through the customer portal.</p>
                <p className="mt-2 text-sm text-slate-700">No handwritten signature, signature image, or physical signature field is required. This approval record is the official proof of customer acceptance.</p>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-emerald-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Acceptance Method</p>
                    <p className="mt-2 font-semibold text-gray-900">{contractData.acceptanceMethod || "Online Acceptance"}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Accepted By</p>
                    <p className="mt-2 font-semibold text-gray-900">{contractData.acceptedBy || contractData.customerName}</p>
                  </div>
                </div>
              </div>
            ) : (
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
                {/* small approved stamp inside the accepted block */}
                <div className="absolute top-4 right-4">
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-8 pt-8 border-t border-gray-200 text-center text-xs text-gray-600">
            <p>This document is a legally binding agreement. Please keep a copy for your records.</p>
            <p className="mt-2">ACGC GLASS & ALUMINUM SERVICES</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ContractModal;

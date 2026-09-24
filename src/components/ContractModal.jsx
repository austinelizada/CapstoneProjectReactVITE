import { X } from "lucide-react";
import logo from "@/assets/images/ACGCLOGO1.png";
import approvedStamp from "@/assets/approved.png";

function ContractModal({ isOpen, onClose, inspection, contractData, onAccept, onDecline, isLoading, actionError, onDownload, onDownloadPNG, onPrint }) {
  if (!isOpen || !inspection || !contractData) return null;

  const formatCurrency = (value) => new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(Number(value) || 0);

  const formatDate = (value, fallback = "N/A") => {
    if (!value) return fallback;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const orderStatus = String(contractData.orderStatus || contractData.status || "").toLowerCase();
  const contractStatus = String(contractData.rawContractStatus || contractData.contractStatus || "").toLowerCase();
  const isAccepted = orderStatus === "contract_accepted" || contractStatus === "accepted";
  const isAwaitingCustomerResponse = orderStatus === "contract_sent" || contractStatus === "sent";
  const actionsAllowed = Boolean(onAccept || onDecline) && isAwaitingCustomerResponse && !isAccepted;
  const totalAmount = Number(contractData.totalProjectCost || inspection.total_amount || 0);
  const downPayment = Number(contractData.downPayment || totalAmount * 0.5);
  const warrantyPeriod = inspection.warranty_period || 90;
  const inspectionDate = contractData.siteInspectionDate || formatDate(inspection.inspection_date, "TBD");
  const installationDate = formatDate(inspection.estimated_installation_date, "TBD");
  const customerName = contractData.customerName || inspection.customer_name || "Customer";
  const customerEmail = contractData.customerEmail || inspection.customer_email || "N/A";
  const customerPhone = contractData.customerPhone || inspection.customer_phone || "N/A";
  const siteAddress = contractData.projectLocation || inspection.shipping_address || "N/A";
  const paymentTerms = contractData.paymentTerms || inspection.payment_terms || "50% downpayment, 50% upon completion";
  const siteNotes = inspection.inspection_notes || inspection.site_notes || "No additional site notes provided.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-slate-100 shadow-2xl">
        <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Service Contract</h2>
            {actionError && <p className="mt-1 text-sm font-medium text-red-600">{actionError}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onDownload && <button type="button" onClick={onDownload} className="rounded-lg border bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Download PDF</button>}
            {onDownloadPNG && <button type="button" onClick={onDownloadPNG} className="rounded-lg border bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Download PNG</button>}
            {onPrint && <button type="button" onClick={onPrint} className="rounded-lg border bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Print Contract</button>}
            {actionsAllowed && onAccept && <button type="button" onClick={onAccept} disabled={isLoading} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">{isLoading ? "Accepting..." : "Accept & Signed Contract"}</button>}
            {actionsAllowed && onDecline && <button type="button" onClick={onDecline} disabled={isLoading} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">{isLoading ? "Declining..." : "Decline Contract"}</button>}
            <button type="button" onClick={onClose} aria-label="Close contract" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><X size={22} /></button>
          </div>
        </div>

        <div id="contract-content" className="relative mx-auto my-5 w-full max-w-[820px] overflow-y-auto bg-white px-6 py-7 text-[12px] text-slate-800 shadow-sm sm:px-10">
          {isAccepted && <img src={approvedStamp} alt="Approved stamp" className="pointer-events-none absolute left-1/2 top-1/2 z-10 w-4/5 -translate-x-1/2 -translate-y-1/2 rotate-[-18deg] opacity-20" />}

          <header className="grid grid-cols-[1.35fr_1fr_1.35fr] items-start gap-3 border-b-2 border-[#5c1118] pb-4">
            <div className="flex items-center gap-2">
              <img src={logo} alt="ACGC" className="h-12 w-12 object-contain" />
              <div>
                <p className="font-black text-red-700">ACGC Glass &amp; Aluminum Services</p>
                <p className="text-[10px] font-bold text-slate-500">Glass and Aluminum Specialists</p>
              </div>
            </div>
            <h1 className="text-center text-lg font-black uppercase tracking-wide text-[#3f78b5]">Service Contract</h1>
            <div className="text-right text-[10px] text-slate-500">
              <p><span className="font-bold">Contract No:</span> {contractData.orderNumber || "N/A"}</p>
              <p><span className="font-bold">Date:</span> {contractData.contractDate || formatDate(new Date())}</p>
            </div>
          </header>

          <section className="mt-5 grid grid-cols-2 gap-6 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5c1118]">Service Provider</h2>
              <p className="mt-2 font-bold text-red-700"> ACGC Glass &amp; Aluminum Services</p>
              <p className="text-[10px] text-slate-700">Olongapo City, Zambales</p>
            </div>
            <div>
              <h2 className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5c1118]">Client</h2>
              <p className="mt-2 font-bold">{customerName}</p>
              <p className="text-[10px] font-bold text-slate-600">{customerEmail} | {customerPhone}</p>
              <p className="text-[10px] font-bold text-slate-500">{siteAddress}</p>
            </div>
          </section>

          <section className="mt-5">
            <h2 className="border-b border-slate-200 pb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#5c1118]">Scope of Work</h2>
            <p className="mt-2 text-[10px]"><span className="font-bold">Site Address:</span> {siteAddress}</p>
            <p className="mt-1 whitespace-pre-wrap text-[10px] text-slate-600">{siteNotes}</p>
            <div className="mt-4 grid grid-cols-2 gap-4 border-b border-slate-200 pb-3 text-[10px] sm:grid-cols-4">
              <p><span className="font-bold">Inspection Date:</span> {inspectionDate}</p>
              <p><span className="font-bold">Est. Install Date:</span> {installationDate}</p>
              <p><span className="font-bold">Client Type:</span> {inspection.order_type === "walk_in_customer" ? "Walk-in" : "Online"}</p>
              <p><span className="font-bold">Warranty:</span> {warrantyPeriod} days</p>
            </div>
          </section>

          <section className="mt-4">
            <table className="w-full border-collapse text-[10px]">
              <thead className="bg-[#5c1118] text-left uppercase text-white">
                <tr>
                  <th className="px-2 py-2">#</th>
                  <th className="px-2 py-2">Product / Description</th>
                  <th className="px-2 py-2 text-center">W x H (Unit)</th>
                  <th className="px-2 py-2 text-center">Qty</th>
                  <th className="px-2 py-2 text-right">Rate</th>
                  <th className="px-2 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(contractData.items || []).map((item, index) => (
                  <tr key={`${item.name || "item"}-${index}`} className="border-b border-slate-200">
                    <td className="px-2 py-2">{index + 1}</td>
                    <td className="px-2 py-2 font-medium">{item.name || "Item"}</td>
                    <td className="px-2 py-2 text-center">{item.width || 0} x {item.height || 0} ({item.unit || "in"})</td>
                    <td className="px-2 py-2 text-center">{item.quantity || 1}</td>
                    <td className="px-2 py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-2 py-2 text-right font-semibold">{formatCurrency(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-black">
                  <td colSpan="5" className="px-2 py-2 text-right uppercase">Total Contract Amount</td>
                  <td className="px-2 py-2 text-right text-[#3f78b5]">{formatCurrency(totalAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </section>

          <section className="mt-5 rounded border border-[#e3b7b7] p-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5c1118]">Payment Terms</h2>
            <p className="mt-3 text-[10px]">{paymentTerms}</p>
            <div className="mt-2 grid grid-cols-2 gap-4 text-[10px]">
              <p><span className="font-bold">50% Downpayment Required:</span> {formatCurrency(downPayment)}</p>
              <p><span className="font-bold">Balance Upon Completion:</span> {formatCurrency(totalAmount - downPayment)}</p>
            </div>
          </section>

          <section className="mt-5">
            <h2 className="border-b border-slate-200 pb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#5c1118]">Warranty</h2>
            <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 p-3 text-[10px]">
              <span className="mr-2">🛡️</span>
              <span className="font-bold">{warrantyPeriod}-Day Warranty:</span> ACGC Glass &amp; Aluminum Services provides a {warrantyPeriod}-day warranty on installed products and workmanship starting from the installation date.
            </div>
            <div className="mt-3 rounded bg-yellow-400 px-3 py-2 text-[10px] font-bold">⚠ 50% downpayment is required to start the project based on the stated policy.</div>
          </section>

          <section className="mt-6 border-t border-slate-300 pt-4">
            <h2 className="border-b border-slate-200 pb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#5c1118]">Client Acknowledgment</h2>
            {isAccepted ? (
              <div className="mt-4 flex items-end justify-between gap-6 text-[10px]">
                <div className="flex-1">
                  <p className="border-b border-slate-500 pb-5 text-center">Electronically Signed by: {contractData.acceptedBy || customerName}</p>
                  <p className="mt-2 font-semibold text-emerald-700">✓ Electronically Signed</p>
                  <p className="text-slate-600">Date: {contractData.acceptanceDate || formatDate(new Date())}</p>
                </div>
                <div className="w-2/5 rounded bg-slate-50 p-3 text-[9px] text-slate-500">Admin Note: This contract is officially issued by ACGC Glass &amp; Aluminum Services. Signature is implicit upon customer acceptance.</div>
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-2 gap-10 text-[10px]">
                <div><p className="border-b border-slate-500 pb-5 text-center">ACGC Representative</p><p className="mt-2 font-semibold">Prepared by ACGC Glass &amp; Aluminum Services</p></div>
                <div><p className="border-b border-slate-500 pb-5 text-center">Client Signature &amp; Printed Name</p><p className="mt-2 font-semibold">{customerName}</p><p className="text-slate-500">Date: __________________</p></div>
              </div>
            )}
          </section>

          <footer className="mt-6 border-t border-slate-200 pt-4 text-center text-[9px] text-slate-500">
            ACGC GLASS &amp; ALUMINUM SERVICES | This document is based on the customer site inspection details.
          </footer>
        </div>
      </div>
    </div>
  );
}

export default ContractModal;

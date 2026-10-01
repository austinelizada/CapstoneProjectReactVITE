import { useState } from "react";
import {
  Camera,
  ClipboardList,
  CreditCard,
  Check,
  AlertTriangle,
  FileText,
  Package,
  Scissors,
  Star,
  Truck,
  Wrench,
  X,
} from "lucide-react";
import { API_BASE } from "@/api/client";
import { buildBatchProductTimelineStages } from "@/lib/orderTimeline";

export const getOrderItemImageSource = (item) => {
  const product = item?.product_id && typeof item.product_id === "object"
    ? item.product_id
    : item?.product || {};
  const productImages = product?.images;
  const imageCollection = Array.isArray(productImages)
    ? productImages
    : productImages && typeof productImages === "object"
      ? Object.values(productImages)
      : [];
  const nestedImage = imageCollection
    .flatMap((image) => Array.isArray(image) ? image : [image])
    .map((image) => typeof image === "string" ? image : image?.url)
    .find(Boolean);

  return item?.image_url || item?.image || product?.image_url || product?.image || nestedImage || "";
};

export const normalizeOrderImageUrl = (url) => {
  if (!url || typeof url !== "string" || url.startsWith("file:")) return "";
  if (/^(https?:|data:|blob:)/i.test(url)) return url;

  const path = url.startsWith("/") ? url : `/${url}`;
  const apiOrigin = API_BASE.replace(/\/api\/?$/, "");
  if (apiOrigin) return `${apiOrigin}${path}`;

  if (import.meta.env.DEV && path.startsWith("/uploads/") && typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:5000${path}`;
  }

  return path;
};

export const formatOrderItemMeasurements = (item) => {
  const product = item?.product_id && typeof item.product_id === "object"
    ? item.product_id
    : item?.product || {};
  const dimensions = item?.dimensions || {};
  const productDimensions = product?.dimensions || {};
  const firstPositiveNumber = (...values) => values
    .map(Number)
    .find((value) => Number.isFinite(value) && value > 0) || 0;
  const width = firstPositiveNumber(dimensions.width, item?.width, productDimensions.width, product?.width);
  const height = firstPositiveNumber(dimensions.height, item?.height, productDimensions.height, product?.height);
  const standardSize = item?.standard_size || product?.standard_size || product?.size || "";

  if (!(width > 0 && height > 0)) {
    return standardSize ? `Size: ${standardSize}` : "Measurements not provided";
  }

  const unit = String(
    dimensions.unit || item?.measurementUnit || item?.measurement_unit ||
    productDimensions.unit || product?.measurementUnit || product?.measurement_unit || "in"
  ).toLowerCase();
  const quantity = Math.max(1, Number(item?.quantity || item?.qty) || 1);
  const area = firstPositiveNumber(item?.area, dimensions.area) || (
    unit === "in"
      ? (width * height * quantity) / 144
      : unit === "ft"
        ? width * height * quantity
        : unit === "cm"
          ? (width * height * quantity) / 929.0304
          : unit === "m"
            ? width * height * quantity * 10.7639
            : width * height * quantity
  );
  const unitSymbol = unit === "in" ? '"' : unit;
  const formattedWidth = width.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const formattedHeight = height.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const formattedArea = area.toLocaleString(undefined, { maximumFractionDigits: 2 });

  return `Size: ${formattedWidth}${unitSymbol} x ${formattedHeight}${unitSymbol} (${formattedArea} sq ft)`;
};

export const getVisibleCompletedStageSubStages = (step) =>
  step?.status === "completed" && Array.isArray(step.subStages) ? step.subStages : [];

export const buildCustomerOrderTimelineSteps = (order, item = null, itemIndex = 0) => {
  const itemForProgress = item ?? (Array.isArray(order?.items) ? order.items[0] : null);
  const hasItemProgressStages = Array.isArray(itemForProgress?.progress_stages) && itemForProgress.progress_stages.length > 0;
  const hasOrderProgressStages = Array.isArray(order?.progress_stages) && order.progress_stages.length > 0;
  const sourceProgressItem = itemForProgress && (hasItemProgressStages || hasOrderProgressStages)
    ? itemForProgress
    : hasOrderProgressStages
      ? { progress_stages: order.progress_stages }
      : null;

  if (sourceProgressItem) {
    return buildBatchProductTimelineStages(order, sourceProgressItem, itemIndex)
      .filter((step) => !step.key.endsWith("_admin_review"))
      .map((step) => ({
        ...step,
        done: step.status === "completed",
        active: ["in-progress", "delayed"].includes(step.status),
        future: !["completed", "cancelled", "in-progress", "delayed"].includes(step.status),
      }));
  }

  const contractAccepted = String(order?.contract_status || "").toLowerCase() === "accepted" || String(order?.status || "").toLowerCase() === "contract_accepted";
  const steps = contractAccepted
    ? [
        { key: "cutting", label: "Cutting" },
        { key: "assembly", label: "Assembly" },
        { key: "fabrication", label: "Fabrication" },
        { key: "installation", label: "Installation" },
        { key: "completed", label: "Completed" },
      ]
    : [
        { key: "order_submitted", label: "Order Submitted" },
        { key: "site_inspection", label: "Site Inspection" },
        { key: "contract_sent", label: "Contract Sent" },
        { key: "contract_accepted", label: "Contract Accepted" },
      ];

  const statusKey = String(order?.status || "").trim();
  const statusStepMap = {
    order_submitted: 0,
    admin_review: 0,
    site_inspection: 1,
    contract_sent: 2,
    contract_accepted: 3,
  };
  const activeIndex = contractAccepted ? 0 : statusStepMap[statusKey.toLowerCase()] ?? 0;

  if (statusKey === "cancelled") {
    return steps.map((step) => ({ ...step, done: false, active: false, future: true }));
  }

  return steps.map((step, index) => ({
    ...step,
    done: index < activeIndex,
    active: index === activeIndex && activeIndex < steps.length - 1,
    future: index > activeIndex,
  }));
};

const getStepIcon = (stepKey, isCompleted, isActive) => {
  const normalizedKey = String(stepKey || "").replace(/^batch_\d+_/, "").trim();
  const iconMap = {
    order_submitted: ClipboardList,
    admin_review: ClipboardList,
    site_inspection: Camera,
    contract_sent: FileText,
    contract_accepted: CreditCard,
    cutting: Scissors,
    assembly: Wrench,
    fabrication: Package,
    installation: Truck,
    completed: Star,
  };
  const Icon = iconMap[normalizedKey] || (isCompleted ? Star : ClipboardList);
  return <Icon size={12} aria-hidden="true" className={isActive || isCompleted ? "text-white" : "text-slate-500"} />;
};

export default function OrderProgressTimeline({
  order,
  darkMode = false,
  getItemImage,
  getItemDimension,
  fallbackImage = "",
}) {
  const [photoGallery, setPhotoGallery] = useState(null);
  const items = Array.isArray(order?.items) ? order.items : [];
  const normalizedStatus = String(order?.status || "").toLowerCase();

  if (items.length === 0) {
    return (
      <div className={`rounded-xl border border-dashed p-8 text-center text-sm ${darkMode ? "border-slate-700 text-slate-400" : "border-slate-300 text-slate-500"}`}>
        No items are listed for this order.
      </div>
    );
  }

  return (
    <div className={`divide-y overflow-hidden rounded-xl border ${darkMode ? "divide-slate-700 border-slate-700 bg-slate-900" : "divide-slate-200 border-slate-200 bg-white"}`}>
      {items.map((item, itemIndex) => {
        const productName = item?.name || item?.product_name || `Product ${itemIndex + 1}`;
        const productSize = getItemDimension?.(item) || formatOrderItemMeasurements(item);
        const isBatchOrder = items.length > 1;
        const progressSteps = buildCustomerOrderTimelineSteps(order, item, itemIndex);
        const delayedSteps = progressSteps.filter((step) => step.status === "delayed");
        const image = normalizeOrderImageUrl(
          getItemImage?.(item) || getOrderItemImageSource(item) || fallbackImage
        );

        return (
          <article key={`${order?._id || order?.id || "order"}-detail-${itemIndex}`} className="p-2.5 sm:p-3">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border ${darkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-slate-100"}`}>
                  {image ? (
                    <img src={image} alt={productName} className="h-full w-full object-cover" onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = fallbackImage;
                    }} />
                  ) : (
                    <Package size={16} aria-hidden="true" className="text-slate-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className={`truncate text-sm font-semibold ${darkMode ? "text-white" : "text-slate-900"}`}>{productName}</p>
                  <p className={`mt-0.5 truncate text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{productSize}</p>
                </div>
              </div>
            </div>

            <div className={`mt-2 overflow-x-auto rounded-xl border p-2.5 sm:p-3 ${darkMode ? "border-slate-700 bg-slate-800/70" : "border-slate-200 bg-slate-50"}`}>
              <div className="flex w-max items-start gap-3 px-3">
                {progressSteps.map((step, stepIndex) => {
                  const isCompleted = step.done || (!isBatchOrder && normalizedStatus === "completed" && step.key === "completed");
                  const isCancelled = normalizedStatus === "cancelled";
                  const visibleSubStages = getVisibleCompletedStageSubStages(step);
                  const stagePhotos = Array.isArray(step.images)
                    ? step.images.map(normalizeOrderImageUrl).filter(Boolean)
                    : [];
                  const circleClass = isCancelled && stepIndex === 0
                    ? "border-red-600 bg-red-600 text-white shadow-red-200"
                    : step.status === "delayed"
                      ? "border-rose-600 bg-rose-600 text-white shadow-rose-200"
                    : isCompleted
                      ? "border-emerald-600 bg-emerald-600 text-white shadow-emerald-100"
                      : step.active
                        ? "border-amber-500 bg-amber-500 text-white shadow-amber-100"
                        : darkMode
                          ? "border-slate-600 bg-slate-900 text-slate-400"
                          : "border-slate-300 bg-white text-slate-500 shadow-slate-100";
                  const labelClass = isCancelled && stepIndex === 0
                    ? "text-red-600"
                    : step.status === "delayed"
                      ? "text-rose-700"
                    : isCompleted
                      ? "text-emerald-700"
                      : step.active
                        ? "text-amber-700"
                        : darkMode
                          ? "text-slate-400"
                          : "text-slate-500";

                  return (
                    <div key={`${productName}-${step.key}`} className="flex shrink-0 items-start" aria-current={step.active ? "step" : undefined}>
                      <div className="flex w-[68px] flex-col items-center gap-1 text-center">
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-[9px] font-bold shadow-sm ${circleClass}`}>
                          {step.status === "delayed"
                            ? <AlertTriangle size={12} aria-hidden="true" className="text-white" />
                            : getStepIcon(step.key, isCompleted, step.active)}
                        </span>
                        <span className={`text-[9px] font-semibold leading-tight ${labelClass}`}>{step.label}</span>
                        {step.status === "delayed" && (
                          <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[8px] font-bold text-rose-800">Delayed</span>
                        )}
                        {stagePhotos.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setPhotoGallery({ title: step.label, images: stagePhotos })}
                            className="relative mt-1 h-9 w-9 overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm transition hover:ring-2 hover:ring-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                            aria-label={`View ${stagePhotos.length} ${step.label} proof photo${stagePhotos.length === 1 ? "" : "s"}`}
                            title={`${stagePhotos.length} proof photo${stagePhotos.length === 1 ? "" : "s"}`}
                          >
                            <img src={stagePhotos[0]} alt={`${step.label} proof`} className="h-full w-full object-cover" />
                            {stagePhotos.length > 1 && (
                              <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-[10px] font-bold text-white">
                                +{stagePhotos.length - 1}
                              </span>
                            )}
                          </button>
                        )}
                      </div>

                      {visibleSubStages.length > 0 && (
                        <div className="mt-5 flex items-start gap-2">
                          {visibleSubStages.map((sub, subIndex) => {
                            const normalizedSubStatus = String(sub.status || "pending").toLowerCase();
                            const isSubCompleted = ["completed", "done"].includes(normalizedSubStatus);
                            const isSubDelayed = normalizedSubStatus === "delayed";
                            const subStatusClass = isSubCompleted
                              ? "border-emerald-600 bg-emerald-600 text-white"
                              : isSubDelayed
                                ? "border-rose-600 bg-rose-600 text-white"
                                : ["in-progress", "in_progress", "active"].includes(normalizedSubStatus)
                                  ? "border-amber-500 bg-amber-500 text-white"
                                  : darkMode
                                    ? "border-slate-600 bg-slate-900 text-slate-400"
                                    : "border-slate-300 bg-white text-slate-500";
                            const subPhotoUrls = Array.isArray(sub.images)
                              ? sub.images.map(normalizeOrderImageUrl).filter(Boolean)
                              : [];

                            return (
                              <div key={`${step.key}-sub-${subIndex}`} className="flex w-[68px] shrink-0 flex-col items-center gap-1 text-center">
                                <span className={`flex h-5 w-5 items-center justify-center rounded-full border text-[8px] font-bold shadow-sm ${subStatusClass}`}>
                                  {isSubCompleted
                                    ? <Check size={10} aria-hidden="true" />
                                    : isSubDelayed
                                      ? <AlertTriangle size={10} aria-hidden="true" />
                                      : subIndex + 1}
                                </span>
                                <span className={`text-[8px] font-semibold leading-tight ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
                                  {sub.name || `Sub-stage ${subIndex + 1}`}
                                </span>
                                {subPhotoUrls.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setPhotoGallery({ title: `${step.label} · ${sub.name || `Sub-stage ${subIndex + 1}`}`, images: subPhotoUrls })}
                                    className="relative mt-0.5 h-7 w-7 overflow-hidden rounded border border-slate-300 bg-white"
                                    aria-label={`View ${subPhotoUrls.length} ${sub.name || `sub-stage ${subIndex + 1}`} proof photo${subPhotoUrls.length === 1 ? "" : "s"}`}
                                  >
                                    <img src={subPhotoUrls[0]} alt="" className="h-full w-full object-cover" />
                                    {subPhotoUrls.length > 1 && <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-[8px] font-bold text-white">+{subPhotoUrls.length - 1}</span>}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {delayedSteps.length > 0 && (
                <div className="mt-3 space-y-2">
                  {delayedSteps.map((step) => (
                    <div key={`${step.key}-delay`} className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${darkMode ? "border-rose-900 bg-rose-950/40 text-rose-100" : "border-rose-200 bg-rose-50 text-rose-950"}`}>
                      <AlertTriangle size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-rose-600" />
                      <div className="min-w-0">
                        <p className="font-semibold">{step.label} is delayed</p>
                        <p className={`mt-1 break-words ${darkMode ? "text-rose-200" : "text-rose-800"}`}>{step.delayReason || step.notes || "A delay has been reported."}</p>
                        <p className={`mt-1 ${darkMode ? "text-rose-300" : "text-rose-700"}`}>Expected resolution: {step.delayExpectedResolution || "Not set"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </article>
        );
      })}
      {photoGallery && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setPhotoGallery(null)}
          role="presentation"
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-stage-gallery-title"
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white p-4">
              <h3 id="order-stage-gallery-title" className="text-base font-semibold text-slate-900">
                {photoGallery.title} proof photos
              </h3>
              <button
                type="button"
                onClick={() => setPhotoGallery(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close photo gallery"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
              {photoGallery.images.map((src, index) => (
                <img
                  key={`${photoGallery.title}-proof-${index}`}
                  src={src}
                  alt={`${photoGallery.title} proof photo ${index + 1}`}
                  className="max-h-[65vh] w-full rounded-lg bg-slate-100 object-contain"
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
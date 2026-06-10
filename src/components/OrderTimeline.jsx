import { useEffect, useRef, useState } from "react";
import { buildOrderTimelineStages, getOrderTimelineStatusClass, getOrderTimelineLineClass } from "@/lib/orderTimeline";
import { respondToInstallationSchedule } from "@/api/orders";
import { Check, X, Image } from "lucide-react";

export default function OrderTimeline({ order, onOrderChange, audience = "customer" }) {
  const [photoGallery, setPhotoGallery] = useState(null);
  const [scheduleActionLoading, setScheduleActionLoading] = useState(false);
  const [scheduleActionError, setScheduleActionError] = useState("");
  const [scheduleActionMessage, setScheduleActionMessage] = useState("");
  const [agreementModal, setAgreementModal] = useState(null);
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [rescheduleNotes, setRescheduleNotes] = useState("");
  const canRespondToSchedule = audience === "customer" && typeof onOrderChange === "function";
  const steps = buildOrderTimelineStages(order).filter(
    (step) => audience === "customer" || step.key !== "installation_agreement"
  );
  const [selectedStepIndex, setSelectedStepIndex] = useState(0);
  const stageRefs = useRef([]);
  const hasAutoScrolled = useRef(false);
  const selectedStep = steps[selectedStepIndex] || steps[0] || null;
  const completedCount = steps.filter((step) => step.status === "completed").length;
  const totalCount = steps.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const getDotClass = (step, index) => {
    const isCompleted = step.status === "completed";
    const isActive = index === selectedStepIndex;
    if (isCompleted) return "border-emerald-600 bg-emerald-600 text-white";
    if (isActive) return "border-emerald-600 bg-white text-emerald-600";
    return "border-slate-300 bg-slate-100 text-slate-500";
  };

  const getConnectorClass = (step, nextStep) =>
    step.status === "completed" && nextStep?.status === "completed"
      ? "bg-emerald-600"
      : "bg-slate-200";

  const selectedStepPhotoCount = selectedStep
    ? (selectedStep.images?.length || 0) + (selectedStep.subStages?.reduce((sum, sub) => sum + (sub.images?.length || 0), 0) || 0)
    : 0;

  const determineDefaultSelectedStepIndex = () => {
    if (!steps || steps.length === 0) return 0;

    const currentOrderStatus = order?.status?.toLowerCase();

    if (currentOrderStatus === "processing" && Array.isArray(order?.progress_stages) && order.progress_stages.length > 0) {
      const inProgressProgressStage = order.progress_stages.find((ps) => ps.status === "in_progress");
      if (inProgressProgressStage) {
        const progressKey = inProgressProgressStage.key || inProgressProgressStage.name?.toLowerCase().replace(/\s+/g, "_");
        const progressStageIndex = steps.findIndex((step) => step.key === progressKey);
        if (progressStageIndex !== -1) return progressStageIndex;
      }

      const lastProgressStage = order.progress_stages[order.progress_stages.length - 1];
      const lastProgressKey = lastProgressStage.key || lastProgressStage.name?.toLowerCase().replace(/\s+/g, "_");
      const lastProgressIndex = steps.findIndex((step) => step.key === lastProgressKey);
      if (lastProgressIndex !== -1) return lastProgressIndex;
    }

    const statusToKeyMap = {
      order_submitted: "order_submitted",
      admin_review: "admin_review",
      site_inspection: "site_inspection_scheduled",
      contract_sent: "contract_sent",
      contract_accepted: "contract_accepted",
      completed: "project_completed",
    };

    const targetStageKey = statusToKeyMap[currentOrderStatus];
    if (targetStageKey) {
      const currentStatusIndex = steps.findIndex((step) => step.key === targetStageKey);
      if (currentStatusIndex !== -1) return currentStatusIndex;
    }

    const inProgressIndex = steps.findIndex((step) => step.status === "in-progress");
    if (inProgressIndex !== -1) return inProgressIndex;

    const waitingActionIndex = steps.findIndex((step) => {
      if (step.key === "contract_sent" && step.status !== "completed") return true;
      if (
        step.key === "installation_scheduling" &&
        step.proposedInstallationDate &&
        step.proposedInstallationTime &&
        step.customerResponse !== "accepted"
      )
        return true;
      if (
        step.key === "installation_agreement" &&
        step.proposedInstallationDate &&
        step.proposedInstallationTime &&
        step.customerResponse !== "accepted"
      )
        return true;
      return false;
    });
    if (waitingActionIndex !== -1) return waitingActionIndex;

    const completedIndexes = steps
      .map((step, index) => (step.status === "completed" ? index : -1))
      .filter((index) => index !== -1);
    if (completedIndexes.length > 0) return completedIndexes[completedIndexes.length - 1];

    return 0;
  };

  useEffect(() => {
    hasAutoScrolled.current = false;
    const defaultIndex = determineDefaultSelectedStepIndex();
    setSelectedStepIndex(defaultIndex);
  }, [order?._id, order?.status, order?.contract_status, order?.inspection_status, order?.inspection_date, order?.updatedAt, steps.length]);

  useEffect(() => {
    if (hasAutoScrolled.current || !steps.length) return;
    const defaultIndex = determineDefaultSelectedStepIndex();
    const targetElement = stageRefs.current[defaultIndex];
    if (targetElement?.scrollIntoView) {
      targetElement.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      hasAutoScrolled.current = true;
    }
  }, [steps]);

  const handleStageSelect = (index) => {
    setSelectedStepIndex(index);
  };

  const handleScheduleResponse = async (action, payload = {}) => {
    if (!order || (!order._id && !order.id)) return;
    setScheduleActionLoading(true);
    setScheduleActionError("");
    setScheduleActionMessage("");

    try {
      const response = await respondToInstallationSchedule(order._id || order.id, {
        action,
        ...payload,
      });
      if (response?.order) {
        const successText =
          action === "accept"
            ? "accepted"
            : action === "reschedule"
            ? "reschedule request submitted"
            : "updated";
        setScheduleActionMessage(`Schedule ${successText} successfully.`);
        if (typeof onOrderChange === "function") {
          onOrderChange(response.order);
        }
        setAgreementModal(null);
        setRescheduleReason("");
        setPreferredDate("");
        setPreferredTime("");
        setRescheduleNotes("");
      }
    } catch (error) {
      setScheduleActionError(error.data?.message || error.message || "Unable to respond to installation schedule.");
    } finally {
      setScheduleActionLoading(false);
    }
  };

  const openRescheduleModal = () => {
    setAgreementModal("reschedule");
    setScheduleActionError("");
    setScheduleActionMessage("");
  };

  const closeAgreementModal = () => {
    setAgreementModal(null);
    setRescheduleReason("");
    setPreferredDate("");
    setPreferredTime("");
    setRescheduleNotes("");
    setScheduleActionError("");
  };

  return (
    <>
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <h5 className="text-sm font-semibold text-slate-900 uppercase tracking-[0.3em]">Order Timeline</h5>
        <p className="text-sm text-slate-500 mt-1">Status history for this order.</p>

        <div className="mt-6 space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Progress</p>
                <p className="mt-1 text-sm text-slate-500">{completedCount} of {totalCount} stages completed</p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                {progressPercent}% Complete
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full transition-all ${
                  progressPercent === 100
                    ? "bg-emerald-600"
                    : progressPercent >= 50
                    ? "bg-amber-500"
                    : "bg-slate-400"
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="overflow-x-auto pb-3">
            <div className="min-w-[850px]">
              <div className="relative flex items-center gap-8 px-3">
                {steps.map((step, index) => (
                  <div
                key={step.key}
                ref={(el) => {
                  stageRefs.current[index] = el;
                }}
                className={`relative flex min-w-[160px] flex-col items-center text-center rounded-3xl border px-4 py-4 transition ${
                  selectedStepIndex === index
                    ? "border-emerald-200 bg-emerald-50 shadow-sm"
                    : "border-transparent bg-white"
                }`}
              >
                    <button
                      type="button"
                      onClick={() => handleStageSelect(index)}
                      className={`group relative z-10 flex h-12 w-12 items-center justify-center rounded-full border text-sm font-semibold transition ${getDotClass(
                        step,
                        index
                      )}`}
                    >
                      {step.status === "completed" ? <Check size={18} aria-hidden="true" /> : index + 1}
                    </button>
                    <div className="mt-3 w-full">
                      <p className="text-xs font-semibold text-slate-900">{step.label}</p>
                      <p className="mt-1 text-xs text-slate-500">{step.date || "Pending"}</p>
                    </div>
                    {index < steps.length - 1 && (
                      <div
                        className={`absolute left-1/2 top-6 h-0.5 w-full translate-x-6 ${getConnectorClass(step, steps[index + 1])}`}
                        aria-hidden="true"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            {selectedStep ? (
              <>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{selectedStep.label}</p>
                    <p className="mt-1 text-sm text-slate-500">{selectedStep.description || selectedStep.statusText}</p>
                  </div>
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getOrderTimelineStatusClass(
                    selectedStep.status
                  )}`}>{selectedStep.statusText}</span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Stage Date</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{selectedStep.date || "Pending"}</p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Assigned</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{selectedStep.assignedTo || "TBD"}</p>
                  </div>
                </div>

                {selectedStep.notes && (
                  <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">Notes</p>
                    <p className="mt-2 text-sm text-slate-600">{selectedStep.notes}</p>
                  </div>
                )}

                {selectedStep.key === "installation_scheduling" && selectedStep.proposedInstallationDate && selectedStep.proposedInstallationTime && (
                  <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">Installation Schedule Proposal</p>
                    <p className="mt-2 text-sm text-slate-600">
                      Proposed time: <span className="font-semibold text-slate-900">{selectedStep.proposedInstallationDate}</span> at <span className="font-semibold text-slate-900">{selectedStep.proposedInstallationTime}</span>
                    </p>
                    {selectedStep.customerResponse === "accepted" ? (
                      <p className="mt-3 text-sm text-emerald-700">Customer agreed to this schedule.</p>
                    ) : selectedStep.customerResponse === "reschedule_requested" ? (
                      <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-slate-700">
                        <p className="font-semibold text-amber-800">Reschedule Requested</p>
                        <p className="mt-2">Preferred date: <span className="font-semibold text-slate-900">{selectedStep.customerPreferredInstallationDate || "TBD"}</span></p>
                        <p>Preferred time: <span className="font-semibold text-slate-900">{selectedStep.customerPreferredInstallationTime || "TBD"}</span></p>
                        {selectedStep.customerRescheduleNotes && <p className="mt-2">Notes: {selectedStep.customerRescheduleNotes}</p>}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-600">Awaiting customer agreement on this proposed schedule.</p>
                    )}
                  </div>
                )}

                {canRespondToSchedule && selectedStep.key === "installation_agreement" && selectedStep.proposedInstallationDate && selectedStep.proposedInstallationTime && (
                  <div className="mt-4 rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Installation Agreement</p>
                        <p className="mt-1 text-sm text-slate-600">
                          Proposed appointment: <span className="font-semibold text-slate-900">{selectedStep.proposedInstallationDate}</span> at <span className="font-semibold text-slate-900">{selectedStep.proposedInstallationTime}</span>
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        selectedStep.customerResponse === "accepted"
                          ? "bg-emerald-50 text-emerald-700"
                          : selectedStep.customerResponse === "reschedule_requested"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-slate-100 text-slate-600"
                      }`}>{
                        selectedStep.customerResponse === "accepted"
                          ? "Accepted"
                          : selectedStep.customerResponse === "reschedule_requested"
                          ? "Reschedule Requested"
                          : "Action Needed"
                      }</span>
                    </div>

                    {selectedStep.customerResponse === "accepted" ? (
                      <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        Your installation schedule has been confirmed. No further action is needed.
                      </div>
                    ) : selectedStep.customerResponse === "reschedule_requested" ? (
                      <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-slate-700">
                        <p className="font-semibold text-amber-800">Reschedule Requested</p>
                        <p className="mt-2">Preferred date: <span className="font-semibold text-slate-900">{selectedStep.customerPreferredInstallationDate || "TBD"}</span></p>
                        <p>Preferred time: <span className="font-semibold text-slate-900">{selectedStep.customerPreferredInstallationTime || "TBD"}</span></p>
                        {selectedStep.customerRescheduleNotes && <p className="mt-2">Notes: {selectedStep.customerRescheduleNotes}</p>}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-600">Please review the proposed installation schedule.</p>
                    )}

                    {selectedStep.customerResponse !== "accepted" && (
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          disabled={scheduleActionLoading}
                          onClick={() => handleScheduleResponse("accept")}
                          className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {scheduleActionLoading ? "Processing..." : "Accept Schedule"}
                        </button>
                        <button
                          type="button"
                          disabled={scheduleActionLoading}
                          onClick={openRescheduleModal}
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Request Reschedule
                        </button>
                      </div>
                    )}

                    {scheduleActionError && <p className="mt-3 text-sm text-red-600">{scheduleActionError}</p>}
                    {scheduleActionMessage && <p className="mt-3 text-sm text-emerald-700">{scheduleActionMessage}</p>}
                  </div>
                )}

                {selectedStep.subStages?.length > 0 && (
                  <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">Sub-Stages</p>
                    <div className="mt-4 space-y-3">
                      {selectedStep.subStages.map((sub, subIndex) => (
                        <div key={`${selectedStep.key}-sub-${subIndex}`} className="rounded-3xl border border-slate-200 bg-white p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{sub.name}</p>
                              {sub.date && <p className="mt-1 text-xs text-slate-500">{sub.date}</p>}
                            </div>
                            <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${getOrderTimelineStatusClass(sub.status)}`}>
                              {sub.status === "completed"
                                ? "Done"
                                : sub.status === "in-progress"
                                ? "In Progress"
                                : sub.status === "delayed"
                                ? "Delayed"
                                : "Pending"}
                            </span>
                          </div>
                          {sub.description && <p className="mt-3 text-sm text-slate-600">{sub.description}</p>}
                          {sub.images?.length > 0 && (
                            <button
                              onClick={() =>
                                setPhotoGallery({
                                  title: sub.name,
                                  images: sub.images,
                                })
                              }
                              className="mt-4 inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100"
                            >
                              <Image size={14} />
                              {sub.images.length} Photo{sub.images.length !== 1 ? "s" : ""}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedStep.images?.length > 0 && (
                  <div className="mt-4">
                    <button
                      onClick={() =>
                        setPhotoGallery({
                          title: selectedStep.label,
                          images: selectedStep.images,
                        })
                      }
                      className="inline-flex items-center gap-2 rounded-2xl bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                    >
                      <Image size={14} />
                      {selectedStep.images.length} Photo{selectedStep.images.length !== 1 ? "s" : ""}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-500">No timeline details available for this order.</p>
            )}
          </div>
        </div>
      </div>

      {/* Photo Gallery Modal */}
      {photoGallery && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setPhotoGallery(null)}
          role="presentation"
        >
          <div
            className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="gallery-title"
          >
            <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between">
              <h3 id="gallery-title" className="text-lg font-semibold text-slate-900">
                {photoGallery.title} - Photos
              </h3>
              <button
                onClick={() => setPhotoGallery(null)}
                className="p-2 text-gray-500 hover:text-gray-700"
                aria-label="Close photo gallery"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {photoGallery.images.map((src, idx) => (
                <div key={idx} className="rounded-lg overflow-hidden bg-slate-100">
                  <img
                    src={src}
                    alt={`${photoGallery.title} photo ${idx + 1}`}
                    className="w-full h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {agreementModal === "reschedule" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-6 shadow-xl" role="dialog" aria-modal="true">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Request Installation Reschedule</h3>
                <p className="text-sm text-slate-500">Tell us your preferred date and time for the installation.</p>
              </div>
              <button
                onClick={closeAgreementModal}
                className="text-slate-500 hover:text-slate-700"
                aria-label="Close reschedule form"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Reason for reschedule</label>
                <textarea
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900"
                  rows={3}
                  placeholder="Why do you need to change the installation date?"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-700">Preferred date</label>
                  <input
                    type="date"
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Preferred time</label>
                  <input
                    type="time"
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Additional notes (optional)</label>
                <textarea
                  value={rescheduleNotes}
                  onChange={(e) => setRescheduleNotes(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900"
                  rows={3}
                  placeholder="Add any details for the team."
                />
              </div>

              {scheduleActionError && <p className="text-sm text-red-600">{scheduleActionError}</p>}

              <div className="flex flex-wrap items-center gap-3 pt-3">
                <button
                  type="button"
                  disabled={scheduleActionLoading}
                  onClick={() =>
                    handleScheduleResponse("reschedule", {
                      reason: rescheduleReason,
                      preferredInstallationDate: preferredDate,
                      preferredInstallationTime: preferredTime,
                      notes: rescheduleNotes,
                    })
                  }
                  className="rounded-2xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {scheduleActionLoading ? "Submitting..." : "Submit Reschedule Request"}
                </button>
                <button
                  type="button"
                  onClick={closeAgreementModal}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import { useState, useEffect, useRef, useCallback } from "react";
import { X, UploadCloud, Plus, CheckCircle2, Lock, Trash2 } from "lucide-react";
import { formatDateToMMDDYYYY, formatDateTimeToMMDDYYYY, getTodayIso } from "@/lib/dateUtils";

const focusableSelectors = [
  "button",
  "a[href]",
  "input",
  "select",
  "textarea",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const PARENT_STAGE_DEFINITIONS = [
  { key: "cutting", name: "Cutting" },
  { key: "fabrication", name: "Fabrication" },
  { key: "installation_scheduling", name: "Installation Scheduling" },
  { key: "installation", name: "Installation" },
];

const VALID_STAGE_STATUSES = ["pending", "in_progress", "done", "delayed", "on_hold"];


const normalizeStage = (source = {}, key, name) => {
  const status = source.status && VALID_STAGE_STATUSES.includes(source.status)
    ? source.status
    : source.completed
    ? "done"
    : "pending";

  const acceptedSchedule = source.customerResponse === "accepted";
  const effectiveStatus = acceptedSchedule ? "done" : status;
  const completed = !!source.completed || effectiveStatus === "done" || acceptedSchedule;
  return {
    key,
    name,
    status: effectiveStatus,
    completed,
    saved: completed,
    canUndoCompletion: false,
    previousStatus: null,
    date: source.date ? new Date(source.date) : null,
    images: Array.isArray(source.images) ? source.images : [],
    newFiles: [],
    imagePreviews: Array.isArray(source.images) ? source.images : [],
    delayReason: source.delayReason || "",
    delayExpectedResolution: source.delayExpectedResolution ? new Date(source.delayExpectedResolution) : null,
    delayNotes: source.delayNotes || "",
    delayReportedAt: source.delayReportedAt ? new Date(source.delayReportedAt) : null,
    delayReportedBy: source.delayReportedBy || "",
    delayHistory: Array.isArray(source.delayHistory)
      ? source.delayHistory.map((entry) => ({
          reason: entry.reason || "",
          expectedResolution: entry.expectedResolution ? new Date(entry.expectedResolution) : null,
          notes: entry.notes || "",
          reportedAt: entry.reportedAt ? new Date(entry.reportedAt) : null,
          reportedBy: entry.reportedBy || "",
          status: entry.status || "",
          resolvedAt: entry.resolvedAt ? new Date(entry.resolvedAt) : null,
        }))
      : [],
    subStages: Array.isArray(source.subStages)
      ? source.subStages.map((sub) => ({
          name: sub.name || "",
          description: sub.description || "",
          status: sub.status && VALID_STAGE_STATUSES.includes(sub.status)
            ? sub.status
            : sub.completed
            ? "done"
            : "pending",
          completed: !!sub.completed || sub.status === "done",
          saved: !!sub.completed,
          previousStatus: null,
          date: sub.date ? new Date(sub.date) : null,
          images: Array.isArray(sub.images) ? sub.images : [],
          newFiles: [],
          imagePreviews: Array.isArray(sub.images) ? sub.images : [],
        }))
      : [],
    proposedInstallationDate: source.proposedInstallationDate ? new Date(source.proposedInstallationDate) : null,
    proposedInstallationTime: source.proposedInstallationTime || "",
    contactMethods: Array.isArray(source.contactMethods) ? source.contactMethods : [],
    schedulingNotes: source.schedulingNotes || "",
    contactAttempts: Array.isArray(source.contactAttempts) ? source.contactAttempts : [],
    customerResponse: source.customerResponse || "pending",
    customerResponseAt: source.customerResponseAt ? new Date(source.customerResponseAt) : null,
    customerDeclineReason: source.customerDeclineReason || "",
    customerPreferredInstallationDate: source.customerPreferredInstallationDate ? new Date(source.customerPreferredInstallationDate) : null,
    customerPreferredInstallationTime: source.customerPreferredInstallationTime || "",
    customerRescheduleNotes: source.customerRescheduleNotes || "",
  };
};

const findStageSource = (stageRows = []) => {
  const result = {};
  stageRows.forEach((stage) => {
    const candidate = (stage.key || stage.name || "").toString().toLowerCase();
    if (candidate.includes("cutting")) result.cutting = stage;
    if (candidate.includes("fabrication") || candidate.includes("processing")) result.fabrication = stage;
    if (candidate.includes("installation_scheduling") || candidate.includes("installation scheduled") || candidate.includes("installation scheduling")) result.installation_scheduling = stage;
    if (candidate.includes("installation") || candidate.includes("site_inspection")) result.installation = stage;
  });
  return result;
};

const initialStages = [];

export default function ProgressEditModal({ project, onClose, onSave }) {
  const [progress, setProgress] = useState(project.progress || 0);
  const [status, setStatus] = useState(project.status || "Pending");
  const [installationDate, setInstallationDate] = useState(
    project.installation ? new Date(project.installation) : null
  );
  const [stages, setStages] = useState(initialStages);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [modalErrorMessage, setModalErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [newSubStageName, setNewSubStageName] = useState("");
  const [newSubStageDescription, setNewSubStageDescription] = useState("");
  const [newSubStageStatus, setNewSubStageStatus] = useState("pending");
  const [newSubStageFiles, setNewSubStageFiles] = useState([]);
  const [newSubStagePreviews, setNewSubStagePreviews] = useState([]);
  const [showSubStageModal, setShowSubStageModal] = useState(false);
  const [subStageModalParentIndex, setSubStageModalParentIndex] = useState(null);
  const [showDelayModal, setShowDelayModal] = useState(false);
  const [delayStageIndex, setDelayStageIndex] = useState(null);
  const [delayReason, setDelayReason] = useState("");
  const [delayExpectedResolution, setDelayExpectedResolution] = useState("");
  const [delayNotes, setDelayNotes] = useState("");
  const [delayModalError, setDelayModalError] = useState("");
  const [showRemoveSubStageModal, setShowRemoveSubStageModal] = useState(false);
  const [removeStageIndex, setRemoveStageIndex] = useState(null);
  const [removeSubStageIndex, setRemoveSubStageIndex] = useState(null);
  const [removeModalError, setRemoveModalError] = useState("");
  const [showMarkDoneConfirmation, setShowMarkDoneConfirmation] = useState(false);
  const [stagePendingCompletion, setStagePendingCompletion] = useState(null);
  const [markDoneValidationError, setMarkDoneValidationError] = useState("");
  const modalRef = useRef(null);
  const previousActiveElement = useRef(null);

  useEffect(() => {
    const projectStages = project.stages || project.progress_stages || [];
    const sourceMap = findStageSource(projectStages);
    const mapped = PARENT_STAGE_DEFINITIONS.map(({ key, name }) =>
      normalizeStage(sourceMap[key], key, name)
    );
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStages(mapped);
  }, [project.stages, project.progress_stages]);

  useEffect(() => {
    previousActiveElement.current = document.activeElement;
    const focusable = modalRef.current?.querySelectorAll(focusableSelectors);
    if (focusable && focusable.length > 0) {
      focusable[0].focus();
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "Tab") {
        const nodes = modalRef.current?.querySelectorAll(focusableSelectors);
        if (!nodes || nodes.length === 0) return;
        const firstNode = nodes[0];
        const lastNode = nodes[nodes.length - 1];
        if (event.shiftKey) {
          if (document.activeElement === firstNode) {
            event.preventDefault();
            lastNode.focus();
          }
        } else if (document.activeElement === lastNode) {
          event.preventDefault();
          firstNode.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previousActiveElement.current?.focus) {
        previousActiveElement.current.focus();
      }
    };
  }, [onClose]);

  const isStageLocked = (index) => {
    const stage = stages[index];
    return stage?.completed && stage?.saved && !stage?.canUndoCompletion;
  };

  const currentStageIndex = stages.findIndex(
    (stage) => !(stage.completed && stage.saved && !stage.canUndoCompletion)
  );
  const activeStageIndex = currentStageIndex === -1 ? stages.length - 1 : currentStageIndex;

  const isStageEditable = (index) => {
    const stage = stages[index];
    return index === activeStageIndex && !(stage?.completed && stage?.saved && !stage?.canUndoCompletion);
  };

  const canAcceptSubStages = (index) => {
    const stage = stages[index];
    return index === activeStageIndex && !(stage?.completed && stage?.saved && !stage?.canUndoCompletion);
  };


  const openAddSubStageModal = (stageIndex) => {
    if (!canAcceptSubStages(stageIndex)) return;
    setSubStageModalParentIndex(stageIndex);
    setNewSubStageName("");
    setNewSubStageDescription("");
    setNewSubStageStatus("pending");
    setNewSubStageFiles([]);
    setNewSubStagePreviews([]);
    setShowSubStageModal(true);
    setModalErrorMessage("");
  };

  const closeAddSubStageModal = () => {
    setShowSubStageModal(false);
    setSubStageModalParentIndex(null);
    setNewSubStageName("");
    setNewSubStageDescription("");
    setNewSubStageStatus("pending");
    setNewSubStageFiles([]);
    setNewSubStagePreviews([]);
    setModalErrorMessage("");
  };

  const closeDelayModal = () => {
    setShowDelayModal(false);
    setDelayStageIndex(null);
    setDelayReason("");
    setDelayExpectedResolution("");
    setDelayNotes("");
    setDelayModalError("");
  };

  const openDelayReasonModal = (stageIndex) => {
    setDelayStageIndex(stageIndex);
    setDelayReason("");
    setDelayExpectedResolution("");
    setDelayNotes("");
    setDelayModalError("");
    setShowDelayModal(true);
  };

  const handleStageStatusChange = (stageIndex, nextStatus) => {
    const stage = stages[stageIndex];
    if (!stage) return;
    if (nextStatus === "delayed") {
      if (stage.status === "delayed") return;
      openDelayReasonModal(stageIndex);
      return;
    }
    updateStage(stageIndex, { status: nextStatus });
  };

  const handleDelayReasonSave = () => {
    if (!delayReason.trim() || delayReason.trim().length < 10) {
      setDelayModalError("Please provide a reason for the delay before saving.");
      return;
    }

    const now = new Date();
    const index = delayStageIndex;
    if (index === null || typeof index === "undefined") {
      setDelayModalError("Invalid stage selected for delay.");
      return;
    }

    const stage = stages[index];
    if (!stage) {
      setDelayModalError("Invalid stage selected for delay.");
      return;
    }

    const historyEntry = {
      reason: delayReason.trim(),
      expectedResolution: delayExpectedResolution ? new Date(delayExpectedResolution) : null,
      notes: delayNotes.trim(),
      reportedAt: now,
      reportedBy: "",
      status: "delayed",
      resolvedAt: null,
    };

    const nextHistory = [...(stage.delayHistory || []), historyEntry];

    updateStage(index, {
      status: "delayed",
      delayReason: delayReason.trim(),
      delayExpectedResolution: delayExpectedResolution ? new Date(delayExpectedResolution) : null,
      delayNotes: delayNotes.trim(),
      delayReportedAt: now,
      delayReportedBy: "",
      delayHistory: nextHistory,
    });

    closeDelayModal();
  };

  const handleSubStageModalFiles = (e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;
    const previews = selected.map((file) => URL.createObjectURL(file));
    setNewSubStageFiles([...newSubStageFiles, ...selected]);
    setNewSubStagePreviews([...newSubStagePreviews, ...previews]);
    e.target.value = "";
  };

  const removeSubStageModalFile = (index) => {
    if (newSubStagePreviews[index]) {
      URL.revokeObjectURL(newSubStagePreviews[index]);
    }
    setNewSubStageFiles((prev) => prev.filter((_, i) => i !== index));
    setNewSubStagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const getCompletedSubStageFraction = (stage) => {
    if (!Array.isArray(stage.subStages) || stage.subStages.length === 0) return 0;
    const completedCount = stage.subStages.filter((sub) => sub.completed).length;
    return completedCount / stage.subStages.length;
  };

  const calculateProgress = useCallback(() => {
    if (!Array.isArray(stages) || stages.length === 0) return 0;
    const stageProgress = stages.reduce((sum, stage) => {
      if (stage.completed) return sum + 1;
      return sum + getCompletedSubStageFraction(stage);
    }, 0);
    return Math.round((stageProgress / stages.length) * 100);
  }, [stages]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgress(calculateProgress());
  }, [calculateProgress]);

  const updateStage = (index, patch) => {
    setStages((prev) => {
      const next = [...prev];
      const current = next[index] || {};
      const updated = { ...current, ...patch };

      if (patch.status) {
        if (patch.status === "done" && !current.saved) {
          updated.previousStatus = current.previousStatus || current.status;
          updated.completed = true;
          updated.date = new Date();
        } else if (patch.status === "done" && current.saved) {
          updated.completed = true;
          updated.date = new Date();
        } else {
          updated.completed = false;
          updated.date = null;
          delete updated.previousStatus;
        }

        if (current.status === "delayed" && patch.status !== "delayed") {
          const history = Array.isArray(updated.delayHistory) ? [...updated.delayHistory] : [];
          const lastEntry = history[history.length - 1];
          if (lastEntry && !lastEntry.resolvedAt && lastEntry.status === "delayed") {
            history[history.length - 1] = {
              ...lastEntry,
              resolvedAt: new Date(),
            };
            updated.delayHistory = history;
          }
        }
      }

      next[index] = updated;
      return next;
    });
  };

  const updateSubStage = (stageIndex, subIndex, patch) => {
    setStages((prev) => {
      const next = [...prev];
      const stage = { ...next[stageIndex] };
      const subs = [...stage.subStages];
      const current = subs[subIndex] || {};
      const updated = { ...current, ...patch };
      if (patch.status) {
        if (patch.status === "done" && !current.saved) {
          updated.previousStatus = current.previousStatus || current.status;
          updated.completed = true;
          updated.date = new Date();
        } else if (patch.status === "done" && current.saved) {
          updated.completed = true;
          updated.date = new Date();
        } else {
          updated.completed = false;
          updated.date = null;
          delete updated.previousStatus;
        }
      }
      subs[subIndex] = updated;
      stage.subStages = subs;
      next[stageIndex] = stage;
      return next;
    });
  };

  const handleContactCustomer = (stageIndex) => {
    const stage = stages[stageIndex];
    if (!stage) return;
    if (!stage.proposedInstallationDate) {
      setErrorMessage("Proposed installation date is required before sending the schedule.");
      return;
    }
    if (!stage.proposedInstallationTime || !stage.proposedInstallationTime.trim()) {
      setErrorMessage("Proposed installation time is required before sending the schedule.");
      return;
    }

    const contactAttempt = {
      attemptedAt: new Date().toISOString(),
      methods: Array.isArray(stage.contactMethods) ? stage.contactMethods : [],
      notes: stage.schedulingNotes || "",
    };

    updateStage(stageIndex, {
      status: "in_progress",
      contactAttempts: [...(stage.contactAttempts || []), contactAttempt],
    });
    setErrorMessage("");
  };

  

  const canRemoveSubStage = (stageIndex, subIndex) => {
    const stage = stages[stageIndex];
    if (!stage) return false;
    const sub = stage.subStages[subIndex];
    if (!sub) return false;
    if (sub.completed || sub.status === "done") return false;
    if (stage.completed || isStageLocked(stageIndex)) return false;
    return true;
  };

  const openRemoveSubStageModal = (stageIndex, subIndex) => {
    if (!canRemoveSubStage(stageIndex, subIndex)) return;
    setRemoveStageIndex(stageIndex);
    setRemoveSubStageIndex(subIndex);
    setRemoveModalError("");
    setShowRemoveSubStageModal(true);
  };

  const closeRemoveSubStageModal = () => {
    setShowRemoveSubStageModal(false);
    setRemoveStageIndex(null);
    setRemoveSubStageIndex(null);
    setRemoveModalError("");
  };

  const openMarkDoneConfirmation = (stageIndex) => {
    const stage = stages[stageIndex];
    
    // Validation: check if all sub-stages are done
    const incompleteSubs = stage.subStages.filter(sub => !sub.completed);
    if (incompleteSubs.length > 0) {
      const pendingOrInProgress = incompleteSubs.filter(sub => 
        sub.status === "pending" || sub.status === "in_progress"
      );
      if (pendingOrInProgress.length > 0) {
        setMarkDoneValidationError(
          `Cannot mark ${stage.name} as done. Please complete all sub-stages first. Pending: ${pendingOrInProgress.map(s => s.name).join(", ")}`
        );
        return;
      }
    }
    
    setStagePendingCompletion(stageIndex);
    setMarkDoneValidationError("");
    setShowMarkDoneConfirmation(true);
  };

  const closeMarkDoneConfirmation = () => {
    setShowMarkDoneConfirmation(false);
    setStagePendingCompletion(null);
    setMarkDoneValidationError("");
  };

  const confirmMarkStageDone = () => {
    if (stagePendingCompletion === null) return;
    handleMarkStageDone(stagePendingCompletion);
    closeMarkDoneConfirmation();
  };

  const handleRemoveSubStage = () => {
    if (removeStageIndex === null || removeSubStageIndex === null) {
      setRemoveModalError("Unable to remove this sub-stage.");
      return;
    }

    setStages((prev) => {
      const next = [...prev];
      const stage = { ...next[removeStageIndex] };
      stage.subStages = stage.subStages.filter((_, index) => index !== removeSubStageIndex);
      next[removeStageIndex] = stage;
      return next;
    });

    closeRemoveSubStageModal();
  };

  const handleCreateSubStageFromModal = () => {
    if (!newSubStageName.trim()) {
      setModalErrorMessage("Sub-stage title is required.");
      return;
    }
    if (subStageModalParentIndex === null) {
      setModalErrorMessage("Invalid parent stage.");
      return;
    }
    if (!canAcceptSubStages(subStageModalParentIndex)) {
      setModalErrorMessage("The selected parent stage can no longer accept new sub-stages.");
      return;
    }

    const next = [...stages];
    const stage = { ...next[subStageModalParentIndex] };
    stage.subStages = [
      ...(stage.subStages || []),
      {
        name: newSubStageName.trim(),
        description: newSubStageDescription.trim(),
        status: newSubStageStatus,
        completed: false,
        date: null,
        images: [],
        newFiles: newSubStageFiles,
        imagePreviews: newSubStagePreviews,
      },
    ];
    next[subStageModalParentIndex] = stage;
    setStages(next);
    closeAddSubStageModal();
  };

  const appendStageFiles = (stageIndex, files) => {
    setStages((prev) => {
      const next = [...prev];
      const stage = { ...next[stageIndex] };
      const previews = files.map((file) => URL.createObjectURL(file));
      stage.newFiles = [...(stage.newFiles || []), ...files];
      stage.imagePreviews = [...(stage.imagePreviews || []), ...previews];
      next[stageIndex] = stage;
      return next;
    });
  };

  const appendSubStageFiles = (stageIndex, subIndex, files) => {
    setStages((prev) => {
      const next = [...prev];
      const stage = { ...next[stageIndex] };
      const subs = [...stage.subStages];
      const sub = { ...subs[subIndex] };
      const previews = files.map((file) => URL.createObjectURL(file));
      sub.newFiles = [...(sub.newFiles || []), ...files];
      sub.imagePreviews = [...(sub.imagePreviews || []), ...previews];
      subs[subIndex] = sub;
      stage.subStages = subs;
      next[stageIndex] = stage;
      return next;
    });
  };

  const handleStageFiles = (stageIndex, e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;
    appendStageFiles(stageIndex, selected);
    e.target.value = "";
  };

  const handleSubStageFiles = (stageIndex, subIndex, e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;
    appendSubStageFiles(stageIndex, subIndex, selected);
    e.target.value = "";
  };

  const getPhotoCount = (item) => (item.images?.length || 0) + (item.newFiles?.length || 0);

  const canMarkSubStageDone = (stageIndex, subIndex) => {
    const stage = stages[stageIndex];
    const sub = stage.subStages[subIndex];
    return (
      isStageEditable(stageIndex) &&
      !sub.completed &&
      !!sub.name.trim()
    );
  };

  const canMarkStageDone = (stage, stageIndex) => {
    const allSubStagesComplete =
      stage.subStages.length === 0 ||
      stage.subStages.every((sub) => sub.completed);
    return isStageEditable(stageIndex) && !stage.completed && allSubStagesComplete;
  };

  const handleMarkSubStageDone = (stageIndex, subIndex) => {
    const stage = stages[stageIndex];
    const sub = stage.subStages[subIndex];
    if (!sub.name.trim()) {
      setErrorMessage("Sub-stage title is required before marking it done.");
      return;
    }
    updateSubStage(stageIndex, subIndex, {
      completed: true,
      status: "done",
      date: new Date(),
    });
    setErrorMessage("");
  };

  const handleMarkStageDone = (stageIndex) => {
    const stage = stages[stageIndex];
    if (!canMarkStageDone(stage, stageIndex)) {
      setErrorMessage(
        "A stage can only be completed after all its sub-stages are done."
      );
      return;
    }
    updateStage(stageIndex, {
      completed: true,
      status: "done",
      date: new Date(),
    });
    setErrorMessage("");
  };

  const undoStageCompletion = (stageIndex) => {
    const stage = stages[stageIndex];
    if (!stage || !stage.completed || (stage.saved && !stage.canUndoCompletion)) return;
    updateStage(stageIndex, {
      status: stage.previousStatus || "pending",
      completed: false,
      date: null,
      previousStatus: null,
    });
  };

  const undoSubStageCompletion = (stageIndex, subIndex) => {
    const sub = stages[stageIndex]?.subStages[subIndex];
    if (!sub || !sub.completed || sub.saved) return;
    updateSubStage(stageIndex, subIndex, {
      status: sub.previousStatus || "pending",
      completed: false,
      date: null,
      previousStatus: null,
    });
  };

  const buildPayloadStages = () => {
    const schedulingDone = stages.some(
      (stage) => stage.key === "installation_scheduling" && stage.completed
    );

    return stages.map((stage) => {
      const shouldStartInstallation =
        schedulingDone &&
        stage.key === "installation" &&
        !stage.completed &&
        !["in_progress", "delayed", "on_hold"].includes(stage.status);

      return {
        key: stage.key,
        name: stage.name,
        status: shouldStartInstallation ? "in_progress" : stage.status,
        completed: stage.completed,
        date: stage.date ? stage.date.toISOString() : null,
        images: stage.images,
        delayReason: stage.delayReason || "",
        delayExpectedResolution: stage.delayExpectedResolution ? stage.delayExpectedResolution.toISOString() : null,
        delayNotes: stage.delayNotes || "",
        delayReportedAt: stage.delayReportedAt ? stage.delayReportedAt.toISOString() : null,
        delayReportedBy: stage.delayReportedBy || "",
        delayHistory: Array.isArray(stage.delayHistory)
          ? stage.delayHistory.map((entry) => ({
              reason: entry.reason || "",
              expectedResolution: entry.expectedResolution ? entry.expectedResolution.toISOString() : null,
              notes: entry.notes || "",
              reportedAt: entry.reportedAt ? entry.reportedAt.toISOString() : null,
              reportedBy: entry.reportedBy || "",
              status: entry.status || "",
              resolvedAt: entry.resolvedAt ? entry.resolvedAt.toISOString() : null,
            }))
          : [],
        proposedInstallationDate: stage.proposedInstallationDate ? stage.proposedInstallationDate.toISOString() : null,
        proposedInstallationTime: stage.proposedInstallationTime || null,
        contactMethods: Array.isArray(stage.contactMethods) ? stage.contactMethods : [],
        schedulingNotes: stage.schedulingNotes || "",
        contactAttempts: Array.isArray(stage.contactAttempts)
          ? stage.contactAttempts.map((attempt) => ({
              attemptedAt: attempt.attemptedAt || null,
              methods: Array.isArray(attempt.methods) ? attempt.methods : [],
              notes: attempt.notes || "",
            }))
          : [],
        customerResponse: stage.customerResponse || "pending",
        customerResponseAt: stage.customerResponseAt ? stage.customerResponseAt.toISOString() : null,
        customerDeclineReason: stage.customerDeclineReason || "",
        customerPreferredInstallationDate: stage.customerPreferredInstallationDate ? stage.customerPreferredInstallationDate.toISOString() : null,
        customerPreferredInstallationTime: stage.customerPreferredInstallationTime || "",
        customerRescheduleNotes: stage.customerRescheduleNotes || "",
        subStages: stage.subStages.map((sub) => ({
          name: sub.name,
          description: sub.description,
          status: sub.status,
          completed: sub.completed,
          date: sub.date ? sub.date.toISOString() : null,
          images: sub.images,
        })),
      };
    });
  };

  const buildFileContexts = () => {
    const contexts = [];
    stages.forEach((stage, stageIndex) => {
      (stage.newFiles || []).forEach((file) => {
        contexts.push({ file, stageIndex });
      });
      (stage.subStages || []).forEach((sub, subIndex) => {
        (sub.newFiles || []).forEach((file) => {
          contexts.push({ file, stageIndex, subIndex });
        });
      });
    });
    return contexts;
  };

  const handleSave = async () => {
    setErrorMessage("");
    setIsSaving(true);
    setUploadProgress(0);

    const fileContexts = buildFileContexts();
    const payloadStages = buildPayloadStages();

    try {
      await onSave(
        {
          ...project,
          progress,
          status,
          installation: installationDate ? installationDate.toISOString() : "",
          stages: payloadStages,
        },
        fileContexts,
        setUploadProgress
      );
      setIsSaving(false);
      onClose();
    } catch (error) {
      setErrorMessage(error.message || "Unable to save progress. Please try again.");
      setIsSaving(false);
    }
  };

  const handleProjectStatusChange = (nextStatus) => {
    setStatus(nextStatus);
    if (activeStageIndex === -1 || stages[activeStageIndex]?.completed) return;

    const normalized = nextStatus.toLowerCase().replace(/\s+/g, "_");
    let stageStatus = null;

    if (normalized === "delayed") {
      stageStatus = "delayed";
    } else if (normalized === "completed") {
      stageStatus = "done";
    } else if (normalized === "pending") {
      stageStatus = "pending";
    } else if (["cutting", "fabrication", "installation"].includes(normalized)) {
      stageStatus = "in_progress";
    }

    if (stageStatus) {
      updateStage(activeStageIndex, { status: stageStatus });
    }
  };

  const handleOverlayClick = useCallback(
    (event) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={handleOverlayClick}
      role="presentation"
    >
      <style>{`@keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 4px 2px rgba(29, 158, 117, 0.4); }
          50% { box-shadow: 0 0 14px 6px rgba(29, 158, 117, 0.65); }
        }
        .glow-bar { animation: glowPulse 2s ease-in-out infinite; }
      `}</style>
      <div
        className="bg-white rounded-3xl p-6 w-full max-w-3xl shadow-lg outline-none max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="progress-edit-title"
        aria-describedby="progress-edit-description"
        ref={modalRef}
      >
        <div className="flex items-start justify-between mb-4 gap-4">
          <div>
            <h3 id="progress-edit-title" className="text-xl font-semibold">
              Edit Progress — {project.client}
            </h3>
            <p id="progress-edit-description" className="text-sm text-gray-500">
              Track parent stages, sub-stages, photos, and completion history.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700"
            aria-label="Close edit progress dialog"
          >
            <X />
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-1">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xl font-medium">{Math.round(Math.max(0, Math.min(progress, 100)))}%</span>
              <span className="text-sm text-slate-500">auto-calculated</span>
            </div>
            <div className="relative h-2.5 rounded-full bg-gray-100 overflow-visible">
              <div
                className="glow-bar h-full rounded-full bg-emerald-500 relative transition-all duration-700 ease-in-out"
                style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }}
              >
                {progress > 0 && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3.5 h-3.5 rounded-full bg-emerald-500">
                    <span className="absolute inset-0 block rounded-full bg-emerald-500 opacity-70 animate-ping" />
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-1">Automatically calculated from stage and sub-stage completion.</p>
          </div>
        </div>

        <div className="space-y-6 mt-6">
          {stages.length === 0 && (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
              No progress stages have been added yet.
            </div>
          )}

          {stages.map((stage, stageIndex) => {
            const stageLocked = isStageLocked(stageIndex);
            const stageEditable = isStageEditable(stageIndex);
            return (
              <div
                key={stage.key}
                className={`border rounded-3xl p-5 ${stageLocked ? "border-slate-200 bg-slate-100/80 opacity-80" : "border-slate-200 bg-slate-50"}`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-lg font-semibold">{stage.name}</h4>
                      {stage.completed && (
                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                          Completed
                        </span>
                      )}
                      {stage.status === "delayed" && !stage.completed && (
                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-red-700">
                          Delayed
                        </span>
                      )}
                    </div>
                    {stageLocked && !stage.completed && (
                      <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                        <Lock className="h-4 w-4" />
                        <span>Stage Locked - Project has progressed to the next phase.</span>
                      </div>
                    )}
                    <p className="text-sm text-slate-500 mt-1">
                      {stage.completed
                        ? stage.saved
                          ? `Completed on ${stage.date ? formatDateTimeToMMDDYYYY(stage.date) : "Unknown"}`
                          : "Marked as Done (Unsaved). Review before saving."
                        : stage.status === "delayed"
                        ? "This stage is delayed. Update the status once it resumes."
                        : stageLocked
                        ? "This stage is locked because the project has moved to the next phase."
                        : "Active stage. Complete sub-stages first."}
                    </p>
                    {stage.completed && !stage.saved && (
                      <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        Marked as Done (Unsaved)
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-xs font-semibold uppercase px-3 py-1 rounded-full ${
                        stage.completed
                          ? "bg-emerald-100 text-emerald-700"
                          : stageEditable
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {stage.completed ? "Done" : stageEditable ? "Current" : "Locked"}
                    </span>
                    <span className="text-xs text-slate-500">
                      {getPhotoCount(stage)} proof photo(s)
                    </span>
                  </div>
                </div>

                {stage.key !== "installation_scheduling" && (
                  <div className="grid gap-4 mt-5 md:grid-cols-2">
                    <label className="text-sm text-gray-600 block">
                      Stage State
                      <select
                        className="mt-2 w-full border p-2 rounded-lg"
                        value={stage.status}
                        disabled={!stageEditable}
                        onChange={(e) => handleStageStatusChange(stageIndex, e.target.value)}
                      >
                        <option value="in_progress">In Progress</option>
                        <option value="delayed">Delayed</option>
                        <option value="done">Done</option>
                      </select>
                    </label>
                  </div>
                )}

                {stage.key === "installation_scheduling" && (
                  <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="grid gap-4 mt-4 sm:grid-cols-2">
                      <label className="text-sm text-gray-600 block">
                        Proposed Installation Date
                        <input
                          type="date"
                          min={getTodayIso()}
                          className="mt-2 w-full border p-2 rounded-lg"
                          value={stage.proposedInstallationDate ? stage.proposedInstallationDate.toISOString().slice(0, 10) : ""}
                          disabled={!stageEditable}
                          onChange={(e) => updateStage(stageIndex, { proposedInstallationDate: e.target.value ? new Date(e.target.value) : null })}
                        />
                      </label>
                      <label className="text-sm text-gray-600 block">
                        Proposed Installation Time
                        <input
                          type="time"
                          className="mt-2 w-full border p-2 rounded-lg"
                          value={stage.proposedInstallationTime || ""}
                          disabled={!stageEditable}
                          onChange={(e) => updateStage(stageIndex, { proposedInstallationTime: e.target.value })}
                        />
                      </label>
                    </div>
                    <div className="mt-4">
                      <label className="text-sm text-gray-600 block">Remarks / Notes</label>
                      <textarea
                        className="mt-2 w-full border p-2 rounded-lg min-h-[100px]"
                        value={stage.schedulingNotes || ''}
                        disabled={!stageEditable}
                        onChange={(e) => updateStage(stageIndex, { schedulingNotes: e.target.value })}
                      />
                    </div>
                    {stage.completed && stage.saved && stage.proposedInstallationDate && stage.proposedInstallationTime && (
                      <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700">
                        Installation schedule proposed for {formatDateToMMDDYYYY(stage.proposedInstallationDate)} at {stage.proposedInstallationTime}.
                      </div>
                    )}
                  </div>
                )}

                {stage.key !== "installation_scheduling" && (
                  <>
                    <div className="mt-5 border rounded-2xl border-dashed border-slate-200 bg-white p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <UploadCloud />
                        Parent Stage Proof
                      </div>
                      <p className="text-xs text-slate-500 mt-2">Photos are optional; upload if available.</p>
                      <div className="mt-3">
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          disabled={!stageEditable}
                          onChange={(e) => handleStageFiles(stageIndex, e)}
                          aria-label={`Upload proof images for ${stage.name}`}
                        />
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {stage.imagePreviews.map((src, i) => (
                          <img
                            key={`${stage.key}-preview-${i}`}
                            src={src}
                            alt={`${stage.name} preview ${i + 1}`}
                            className="h-20 w-full object-cover rounded-lg"
                          />
                        ))}
                      </div>
                    </div>

                    {(stage.status === "delayed" || (Array.isArray(stage.delayHistory) && stage.delayHistory.length > 0)) && (
                      <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-4">
                        <p className="text-sm font-semibold text-amber-900">Delay Information</p>
                        <div className="mt-3 grid gap-4 sm:grid-cols-2">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Delay Reason</p>
                            <p className="mt-1 text-sm text-slate-700">
                              {stage.delayReason || (stage.delayHistory[stage.delayHistory.length - 1]?.reason || "Not specified")}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Date Reported</p>
                            <p className="mt-1 text-sm text-slate-700">
                              {stage.delayReportedAt
                                ? formatDateTimeToMMDDYYYY(stage.delayReportedAt)
                                : stage.delayHistory[stage.delayHistory.length - 1]?.reportedAt
                                ? formatDateTimeToMMDDYYYY(new Date(stage.delayHistory[stage.delayHistory.length - 1].reportedAt))
                                : "Not recorded"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Expected Resolution Date</p>
                            <p className="mt-1 text-sm text-slate-700">
                              {stage.delayExpectedResolution
                                ? formatDateToMMDDYYYY(stage.delayExpectedResolution)
                                : stage.delayHistory[stage.delayHistory.length - 1]?.expectedResolution
                                ? formatDateToMMDDYYYY(new Date(stage.delayHistory[stage.delayHistory.length - 1].expectedResolution))
                                : "Not set"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Reported By</p>
                            <p className="mt-1 text-sm text-slate-700">
                              {stage.delayReportedBy || stage.delayHistory[stage.delayHistory.length - 1]?.reportedBy || "Admin"}
                            </p>
                          </div>
                        </div>
                        {stage.delayNotes || stage.delayHistory[stage.delayHistory.length - 1]?.notes ? (
                          <div className="mt-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Additional Notes</p>
                            <p className="mt-1 text-sm text-slate-700">
                              {stage.delayNotes || stage.delayHistory[stage.delayHistory.length - 1]?.notes}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    )}

                    <div className="mt-5">
                      <div className="flex items-center justify-between gap-4 mb-4">
                        <div>
                          <p className="text-sm font-semibold">Sub-stages</p>
                          <p className="text-xs text-slate-500">
                            Manage sub-stages created for this phase.
                          </p>
                        </div>
                      </div>

                      {/* Sub-stages container with left border */}
                      <div className="border-l-2 border-slate-200 pl-4 space-y-4">
                        {stage.subStages.length === 0 ? (
                          <div className="text-center py-6">
                            <p className="text-sm text-slate-500 mb-3">No sub-stages created yet.</p>
                            {canAcceptSubStages(stageIndex) && (
                              <button
                                type="button"
                                onClick={() => openAddSubStageModal(stageIndex)}
                                className="inline-flex items-center gap-2 rounded-full bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-semibold text-white"
                                aria-label={`Add sub-stage to ${stage.name}`}
                              >
                                <Plus size={16} /> Add Sub-Stage
                              </button>
                            )}
                          </div>
                        ) : (
                          <>
                            {stage.subStages.map((sub, subIndex) => {
                              const subLocked = sub.completed && sub.saved;
                              const subEditable = stageEditable && !subLocked;
                              return (
                                <div
                                  key={`${stage.key}-sub-${subIndex}`}
                                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                                >
                                  {/* Header with status indicator */}
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-3 mb-2">
                                        <div
                                          className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold ${
                                            sub.completed
                                              ? "border-emerald-600 bg-emerald-600 text-white"
                                              : sub.status === "in_progress"
                                              ? "border-amber-300 bg-amber-100 text-amber-700"
                                              : "border-slate-200 bg-white text-slate-500"
                                          }`}
                                        >
                                          {sub.completed ? "✓" : subIndex + 1}
                                        </div>
                                        <div>
                                          <p className="font-semibold text-slate-900">{sub.name || "Untitled sub-stage"}</p>
                                          {sub.completed && (
                                            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                                              Completed
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      {sub.date && (
                                        <p className="text-xs text-slate-500 ml-11">
                                          Completed on {formatDateTimeToMMDDYYYY(sub.date) ?? "Unknown"}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      <span
                                        className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${
                                          sub.completed
                                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                            : sub.status === "in_progress"
                                            ? "border-amber-200 bg-amber-50 text-amber-700"
                                            : "border-slate-200 bg-white text-slate-600"
                                        }`}
                                      >
                                        {sub.completed
                                          ? "Done"
                                          : sub.status === "in_progress"
                                          ? "In Progress"
                                          : sub.status === "delayed"
                                          ? "Delayed"
                                          : "Pending"}
                                      </span>
                                      <span className="text-xs text-slate-500">
                                        {getPhotoCount(sub)} photo(s)
                                      </span>
                                    </div>
                                  </div>

                                  {/* Description */}
                                  {sub.description && !subEditable && (
                                    <p className="mt-3 text-sm text-slate-600">{sub.description}</p>
                                  )}

                                  {/* Editable Fields */}
                                  {subEditable && (
                                    <>
                                      <div className="grid gap-4 mt-4 sm:grid-cols-2">
                                        <label className="text-sm text-gray-600 block">
                                          Title
                                          <input
                                            type="text"
                                            value={sub.name}
                                            onChange={(e) => updateSubStage(stageIndex, subIndex, { name: e.target.value })}
                                            disabled={!subEditable}
                                            className="mt-2 w-full border p-2 rounded-lg"
                                            aria-label={`Sub-stage title for ${stage.name}`}
                                          />
                                        </label>

                                        <label className="text-sm text-gray-600 block">
                                          Sub-Stage State
                                          <select
                                            value={sub.status}
                                            disabled={!subEditable}
                                            onChange={(e) => updateSubStage(stageIndex, subIndex, { status: e.target.value })}
                                            className="mt-2 w-full border p-2 rounded-lg"
                                          >
                                            <option value="pending">Pending</option>
                                            <option value="in_progress">In Progress</option>
                                            <option value="done">Done</option>
                                            <option value="delayed">Delayed</option>
                                            <option value="on_hold">On Hold</option>
                                          </select>
                                        </label>
                                      </div>

                                      <div className="mt-4">
                                        <label className="text-sm text-gray-600 block">
                                          Description
                                          <textarea
                                            value={sub.description}
                                            onChange={(e) => updateSubStage(stageIndex, subIndex, { description: e.target.value })}
                                            disabled={!subEditable}
                                            className="mt-2 w-full min-h-[80px] border p-2 rounded-lg"
                                            aria-label={`Sub-stage description for ${stage.name}`}
                                          />
                                        </label>
                                      </div>
                                    </>
                                  )}

                                  {/* Photos Section */}
                                  <div className="mt-4 border rounded-2xl border-dashed border-slate-200 bg-white p-4">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                      <UploadCloud size={16} />
                                      Proof Photos
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2">
                                      {getPhotoCount(sub) > 0
                                        ? `${getPhotoCount(sub)} photo(s) uploaded`
                                        : "Photos are required before this sub-stage can be marked as done."}
                                    </p>
                                    {subEditable && (
                                      <div className="mt-3">
                                        <input
                                          type="file"
                                          accept="image/*"
                                          multiple
                                          disabled={!subEditable}
                                          onChange={(e) => handleSubStageFiles(stageIndex, subIndex, e)}
                                          aria-label={`Upload proof images for ${sub.name || "sub-stage"}`}
                                        />
                                      </div>
                                    )}
                                    {sub.imagePreviews.length > 0 && (
                                      <div className="mt-3 grid grid-cols-3 gap-2">
                                        {sub.imagePreviews.map((src, i) => (
                                          <img
                                            key={`${stage.key}-sub-${subIndex}-preview-${i}`}
                                            src={src}
                                            alt={`${sub.name || "Sub-stage"} preview ${i + 1}`}
                                            className="h-20 w-full object-cover rounded-lg"
                                          />
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Action Buttons */}
                                  {subEditable && (
                                    <div className="mt-4 flex justify-end gap-3">
                                      {sub.completed && !sub.saved ? (
                                        <button
                                          type="button"
                                          onClick={() => undoSubStageCompletion(stageIndex, subIndex)}
                                          className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 px-3 py-2 text-sm font-semibold"
                                        >
                                          Undo Completion
                                        </button>
                                      ) : (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => openRemoveSubStageModal(stageIndex, subIndex)}
                                            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 px-3 py-2 text-sm font-semibold"
                                          >
                                            <Trash2 size={14} />
                                            Remove
                                          </button>
                                          <button
                                            type="button"
                                            disabled={!canMarkSubStageDone(stageIndex, subIndex)}
                                            onClick={() => handleMarkSubStageDone(stageIndex, subIndex)}
                                            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                                          >
                                            <CheckCircle2 size={14} />
                                            Mark as Done
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                            {/* Add Sub-Stage button at the bottom */}
                            {canAcceptSubStages(stageIndex) && (
                              <div className="mt-4 flex justify-center">
                                <button
                                  type="button"
                                  onClick={() => openAddSubStageModal(stageIndex)}
                                  className="inline-flex items-center gap-2 rounded-full bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-semibold text-white"
                                  aria-label={`Add sub-stage to ${stage.name}`}
                                >
                                  <Plus size={16} /> Add Sub-Stage
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </>
                )}

                <div className="mt-5 flex justify-end gap-3">
                  {!stage.completed && (
                    <button
                      type="button"
                      disabled={!canMarkStageDone(stage, stageIndex)}
                      onClick={() => handleMarkStageDone(stageIndex)}
                      className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <CheckCircle2 size={16} />
                      Mark {stage.name} Done
                    </button>
                  )}
                  {(stage.completed && !stage.saved) || (stage.completed && stage.saved && stage.canUndoCompletion) ? (
                    <button
                      type="button"
                      onClick={() => undoStageCompletion(stageIndex)}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 px-4 py-2 text-sm font-semibold"
                    >
                      Undo Completion
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {errorMessage && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 mt-4">
            {errorMessage}
          </div>
        )}

        {/* Add Sub-Stage Modal */}
        {showSubStageModal && subStageModalParentIndex !== null && (
          <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeAddSubStageModal();
            }}
            role="presentation"
          >
            <div
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-lg outline-none"
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-substage-title"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 id="add-substage-title" className="text-lg font-semibold">
                    Add Sub-Stage
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    to {stages[subStageModalParentIndex]?.name}
                  </p>
                </div>
                <button
                  onClick={closeAddSubStageModal}
                  className="p-2 text-gray-500 hover:text-gray-700"
                  aria-label="Close add sub-stage dialog"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <label className="text-sm text-gray-600 block">
                  Sub-Stage Name *
                  <input
                    type="text"
                    className="mt-2 w-full border p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={newSubStageName}
                    onChange={(e) => setNewSubStageName(e.target.value)}
                    placeholder="e.g., Material Preparation, Glass Cutting"
                    autoFocus
                  />
                </label>

                <label className="text-sm text-gray-600 block">
                  Description
                  <textarea
                    className="mt-2 w-full border p-2 rounded-lg min-h-[80px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={newSubStageDescription}
                    onChange={(e) => setNewSubStageDescription(e.target.value)}
                    placeholder="Optional description for this sub-stage"
                  />
                </label>

                <label className="text-sm text-gray-600 block">
                  Sub-Stage State
                  <select
                    className="mt-2 w-full border p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={newSubStageStatus}
                    onChange={(e) => setNewSubStageStatus(e.target.value)}
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </label>

                <label className="text-sm text-gray-600 block">
                  Proof Photos (Optional)
                  <div className="mt-2 border-2 border-dashed border-slate-200 rounded-lg p-4 text-center">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleSubStageModalFiles}
                      className="w-full"
                      aria-label="Upload proof images"
                    />
                  </div>
                </label>

                {newSubStagePreviews.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-600 mb-2">
                      {newSubStagePreviews.length} photo(s) selected
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {newSubStagePreviews.map((src, i) => (
                        <div key={i} className="relative">
                          <img
                            src={src}
                            alt={`Preview ${i + 1}`}
                            className="h-20 w-full object-cover rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => removeSubStageModalFile(i)}
                            className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1"
                            aria-label={`Remove photo ${i + 1}`}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {modalErrorMessage && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-2 text-xs text-red-700">
                    {modalErrorMessage}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={closeAddSubStageModal}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateSubStageFromModal}
                  disabled={!newSubStageName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Sub-Stage
                </button>
              </div>
            </div>
          </div>
        )}

        {showDelayModal && delayStageIndex !== null && (
          <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-[70] p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeDelayModal();
            }}
            role="presentation"
          >
            <div
              className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-lg outline-none"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delay-reason-title"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 id="delay-reason-title" className="text-lg font-semibold">
                    Project Delay Reason
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Provide a reason before marking this stage as delayed.
                  </p>
                </div>
                <button
                  onClick={closeDelayModal}
                  className="p-2 text-gray-500 hover:text-gray-700"
                  aria-label="Close delay reason dialog"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <label className="text-sm text-gray-600 block">
                  Delay Reason *
                  <textarea
                    className="mt-2 w-full min-h-[120px] border p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={delayReason}
                    onChange={(e) => setDelayReason(e.target.value)}
                    placeholder="Material delivery delayed by supplier."
                  />
                </label>

                <label className="text-sm text-gray-600 block">
                  Expected Resolution Date
                  <input
                    type="date"
                    min={getTodayIso()}
                    className="mt-2 w-full border p-2 rounded-lg"
                    value={delayExpectedResolution}
                    onChange={(e) => setDelayExpectedResolution(e.target.value)}
                  />
                </label>

                <label className="text-sm text-gray-600 block">
                  Additional Notes
                  <textarea
                    className="mt-2 w-full min-h-[100px] border p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={delayNotes}
                    onChange={(e) => setDelayNotes(e.target.value)}
                    placeholder="Optional additional context for the delay."
                  />
                </label>

                {delayModalError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                    {delayModalError}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={closeDelayModal}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelayReasonSave}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                >
                  Save Delay Reason
                </button>
              </div>
            </div>
          </div>
        )}

        {showRemoveSubStageModal && removeStageIndex !== null && removeSubStageIndex !== null && (
          <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-[80] p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeRemoveSubStageModal();
            }}
            role="presentation"
          >
            <div
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-lg outline-none"
              role="dialog"
              aria-modal="true"
              aria-labelledby="remove-substage-title"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 id="remove-substage-title" className="text-lg font-semibold">
                    Remove Sub-Stage
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Are you sure you want to remove this sub-stage? This action cannot be undone.
                  </p>
                </div>
                <button
                  onClick={closeRemoveSubStageModal}
                  className="p-2 text-gray-500 hover:text-gray-700"
                  aria-label="Close remove sub-stage dialog"
                >
                  <X size={20} />
                </button>
              </div>

              {removeModalError && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 mb-4">
                  {removeModalError}
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={closeRemoveSubStageModal}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRemoveSubStage}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Remove Sub-Stage
                </button>
              </div>
            </div>
          </div>
        )}

        {isSaving && (
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700 mt-4">
            Saving... {uploadProgress > 0 && `${uploadProgress}%`}
            <div className="mt-2 h-2 bg-blue-100 rounded-full overflow-hidden">
              <div className="h-2 bg-blue-600 rounded-full" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 rounded-xl"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 bg-red-600 text-white rounded-xl"
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

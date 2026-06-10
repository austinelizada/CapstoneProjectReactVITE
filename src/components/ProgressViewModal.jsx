import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import OrderTimeline from "@/components/OrderTimeline";

export default function ProgressViewModal({ project, onClose }) {
  if (!project) return null;
  const order = project.rawOrder || project;
  const modalRef = useRef(null);
  const previousActiveElement = useRef(null);

  useEffect(() => {
    previousActiveElement.current = document.activeElement;
    const focusable = modalRef.current?.querySelectorAll(
      "button, a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
    );
    if (focusable && focusable.length > 0) {
      focusable[0].focus();
    }
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "Tab" && focusable) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
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

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" role="presentation" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div
        className="bg-white rounded-3xl p-6 w-full max-w-xl max-h-[85vh] shadow-lg outline-none overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="progress-view-title"
        aria-describedby="progress-view-description"
        ref={modalRef}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 id="progress-view-title" className="text-xl font-semibold">
              {project.client}
            </h3>
            <p id="progress-view-description" className="text-sm text-gray-500">
              {project.product}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700"
            aria-label="Close view progress dialog"
          >
            <X />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[70vh] pr-2">
          <OrderTimeline order={order} audience="admin" />
      </div>
      </div>
    </div>
  );
}

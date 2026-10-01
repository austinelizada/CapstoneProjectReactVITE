import React from "react";
import OrderTimelineModal from "@/components/OrderTimelineModal";
import { useAdminTheme } from "@/contexts/AdminThemeContext";

export default function ProgressViewModal({ project, onClose }) {
  const { darkMode } = useAdminTheme();
  if (!project) return null;
  const order = project.rawOrder || project;
  return <OrderTimelineModal key={order?._id || order?.id} order={order} darkMode={darkMode} onClose={onClose} />;
}

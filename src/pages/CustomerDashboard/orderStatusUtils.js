export const normalizeOrderStatus = (value) => {
  if (value === null || value === undefined) return "";
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

export const normalizeOrderStatusKey = (value) => normalizeOrderStatus(value).replace(/\s+/g, "_");

const toTitleCase = (text) =>
  String(text || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => (word.length ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word))
    .join(" ");

export const getOrderStatusLabel = (status) => {
  const normalized = normalizeOrderStatus(status);
  switch (normalized) {
    case "order submitted":
      return "Order Submitted";
    case "admin review":
      return "Admin Review";
    case "site inspection":
      return "Site Inspection";
    case "contract sent":
      return "Contract Sent";
    case "contract accepted":
      return "Contract Accepted";
    case "contract declined":
      return "Contract Declined";
    case "cutting":
      return "Cutting";
    case "fabrication":
      return "Fabrication";
    case "installation":
      return "Installation";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return toTitleCase(status) || "Unknown";
  }
};

export const getOrderStatusClasses = (status) => {
  const normalized = normalizeOrderStatus(status);
  switch (normalized) {
    case "completed":
      return "bg-red-50 text-red-700 border border-red-200";
    case "contract declined":
    case "cancelled":
      return "bg-red-100 text-red-800 border border-red-300";
    case "order submitted":
    case "admin review":
    case "site inspection":
    case "contract sent":
    case "contract accepted":
    case "cutting":
    case "assembly":
    case "fabrication":
    case "installation":
      return "bg-red-50 text-red-700 border border-red-200";
    default:
      return "bg-slate-100 text-slate-700 border border-slate-200";
  }
};

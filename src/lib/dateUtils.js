export const formatDateToMMMDDYYYY = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
  const month = months[date.getMonth()];
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}-${day}-${year}`;
};

export const formatDateToMMDDYYYY = formatDateToMMMDDYYYY;

export const formatDateTimeToMMMDDYYYY = (value) => {
  const formattedDate = formatDateToMMMDDYYYY(value);
  if (!formattedDate) return null;
  const date = value instanceof Date ? value : new Date(value);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${formattedDate} ${hours}:${minutes}`;
};

export const formatDateTimeToMMDDYYYY = formatDateTimeToMMMDDYYYY;

export const formatTimeAgo = (value, now = Date.now()) => {
  if (!value) return "Recently";
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Recently";

  const elapsedSeconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (elapsedSeconds < 60) return "Just now";

  const units = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
  ];
  const [unit, secondsPerUnit] = units.find(([, seconds]) => elapsedSeconds >= seconds);
  const amount = Math.floor(elapsedSeconds / secondsPerUnit);
  return `${amount} ${unit}${amount === 1 ? "" : "s"} ago`;
};

export const getTodayIso = () => {
  return new Date().toISOString().slice(0, 10);
};

export const isTodayOrFuture = (value) => {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date >= today;
};

export const isSameOrAfter = (value, compareTo) => {
  if (!value || !compareTo) return false;
  const date = value instanceof Date ? value : new Date(value);
  const reference = compareTo instanceof Date ? compareTo : new Date(compareTo);
  if (Number.isNaN(date.getTime()) || Number.isNaN(reference.getTime())) return false;
  date.setHours(0, 0, 0, 0);
  reference.setHours(0, 0, 0, 0);
  return date >= reference;
};

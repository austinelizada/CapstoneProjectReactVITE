export const formatDateToMMDDYYYY = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}-${day}-${year}`;
};

export const formatDateTimeToMMDDYYYY = (value) => {
  const formattedDate = formatDateToMMDDYYYY(value);
  if (!formattedDate) return null;
  const date = value instanceof Date ? value : new Date(value);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${formattedDate} ${hours}:${minutes}`;
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

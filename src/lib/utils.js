import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const getProgressColor = (pct) => {
  const normalized = Number(pct) || 0;
  if (normalized >= 70) {
    return { bar: "bg-emerald-500", dot: "bg-emerald-500", ping: "bg-emerald-500" };
  }
  if (normalized >= 31) {
    return { bar: "bg-amber-500", dot: "bg-amber-500", ping: "bg-amber-500" };
  }
  return { bar: "bg-red-500", dot: "bg-red-500", ping: "bg-red-500" };
}

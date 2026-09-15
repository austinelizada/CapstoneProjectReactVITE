const MAX_ACTIVITY_ENTRIES = 20;
const DUPLICATE_WINDOW_MS = 1000;

export const getActivityStorageKey = (user) =>
  `adminActivityLog:${user?.id || user?._id || user?.email || "unknown"}`;

export const readActivityLog = (user) => {
  if (!user || typeof window === "undefined") return [];

  try {
    const storedLog = JSON.parse(
      localStorage.getItem(getActivityStorageKey(user)) || "[]",
    );
    return Array.isArray(storedLog) ? storedLog : [];
  } catch {
    return [];
  }
};

export const recordActivity = (user, description, page = "Admin") => {
  if (!user || typeof window === "undefined") return [];

  const currentLog = readActivityLog(user);
  const latestEntry = currentLog[0];
  if (
    latestEntry?.description === description &&
    latestEntry?.page === page &&
    Date.now() - new Date(latestEntry.createdAt).getTime() < DUPLICATE_WINDOW_MS
  ) {
    return currentLog;
  }

  const entry = {
    id: `${Date.now()}-${Math.random()}`,
    description,
    page,
    createdAt: new Date().toISOString(),
  };
  const nextLog = [entry, ...currentLog].slice(0, MAX_ACTIVITY_ENTRIES);

  localStorage.setItem(getActivityStorageKey(user), JSON.stringify(nextLog));
  return nextLog;
};

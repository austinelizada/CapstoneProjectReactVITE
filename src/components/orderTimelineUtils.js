export const getTimelineStageStatus = (stage) => {
  const status = String(stage?.status || "").trim().toLowerCase().replace(/[_\s]+/g, "-");
  if (stage?.done || stage?.completed || ["done", "completed"].includes(status)) return "done";
  if (stage?.active || ["current", "in-progress", "active", "delayed"].includes(status)) return "current";
  return "pending";
};

export const getTimelineStageCounts = (stages = []) => ({
  done: stages.filter((stage) => getTimelineStageStatus(stage) === "done").length,
  total: stages.length,
});

export const getTimelineFocusStage = (stages = []) =>
  stages.find((stage) => getTimelineStageStatus(stage) === "current") ||
  stages.find((stage) => getTimelineStageStatus(stage) === "pending") ||
  stages[stages.length - 1] ||
  null;

export const getTimelineStagePhotos = (stage) => {
  const stagePhotos = Array.isArray(stage?.photos)
    ? stage.photos
    : Array.isArray(stage?.images)
      ? stage.images
      : [];

  return stagePhotos.filter((photo) => typeof photo === "string" && photo);
};

export const getTimelineCurrentStage = (stages = []) =>
  stages.find((stage) => getTimelineStageStatus(stage) === "current") || null;
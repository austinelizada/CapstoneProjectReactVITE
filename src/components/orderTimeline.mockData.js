const productionStages = (completed, current, photo) => [
  { key: "cutting", label: "Cutting", status: completed.includes("cutting") ? "done" : current === "cutting" ? "current" : "pending", completedAt: "2026-09-24T09:10:00", photos: photo ? [photo] : [] },
  { key: "assembly", label: "Assembly", status: completed.includes("assembly") ? "done" : current === "assembly" ? "current" : "pending", completedAt: completed.includes("assembly") ? "2026-09-25T14:35:00" : undefined, note: current === "assembly" ? "Frame assembly in progress" : undefined },
  { key: "fabrication", label: "Fabrication", status: completed.includes("fabrication") ? "done" : current === "fabrication" ? "current" : "pending", completedAt: completed.includes("fabrication") ? "2026-09-27T11:20:00" : undefined },
  { key: "installation", label: "Installation", status: completed.includes("installation") ? "done" : current === "installation" ? "current" : "pending", completedAt: completed.includes("installation") ? "2026-09-29T16:00:00" : undefined },
  { key: "completed", label: "Completed", status: completed.includes("completed") ? "done" : "pending", completedAt: completed.includes("completed") ? "2026-09-30T17:59:00" : undefined },
];

export const singleItemOrderMock = {
  trackingId: "TRK-SINGLE-001",
  createdAt: "2026-09-20T08:30:00",
  status: "processing",
  items: [{
    id: "single-glass-door",
    name: "Glass Door",
    imageUrl: "",
    widthIn: 121,
    heightIn: 121,
    sqFt: 101.67,
    stages: productionStages(["cutting"], "assembly"),
  }],
};

export const threeItemBatchOrderMock = {
  trackingId: "TRK-BATCH-003",
  createdAt: "2026-09-20T08:30:00",
  status: "contract_accepted",
  contract_status: "accepted",
  items: [
    { id: "batch-glass-door", name: "Glass Door", imageUrl: "", widthIn: 48, heightIn: 84, sqFt: 28, stages: productionStages(["cutting"], "assembly") },
    { id: "batch-sliding-window", name: "Sliding Window", imageUrl: "", widthIn: 48, heightIn: 48, sqFt: 16, stages: productionStages(["cutting", "assembly"], "fabrication") },
    { id: "batch-aluminum-door", name: "Aluminum Door", imageUrl: "", widthIn: 36, heightIn: 80, sqFt: 20, stages: productionStages(["cutting", "assembly", "fabrication"], "installation") },
  ],
};
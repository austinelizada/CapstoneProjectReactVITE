import { describe, expect, it } from "vitest";
import { formatTimeAgo } from "./dateUtils";

describe("formatTimeAgo", () => {
  const now = new Date("2026-09-30T12:00:00.000Z").getTime();

  it("formats recent, minute, hour, and day timestamps", () => {
    expect(formatTimeAgo("2026-09-30T11:59:45.000Z", now)).toBe("Just now");
    expect(formatTimeAgo("2026-09-30T11:58:00.000Z", now)).toBe("2 minutes ago");
    expect(formatTimeAgo("2026-09-30T09:00:00.000Z", now)).toBe("3 hours ago");
    expect(formatTimeAgo("2026-09-27T12:00:00.000Z", now)).toBe("3 days ago");
  });

  it("handles future and invalid dates without showing a negative duration", () => {
    expect(formatTimeAgo("2026-09-30T13:00:00.000Z", now)).toBe("Just now");
    expect(formatTimeAgo("not-a-date", now)).toBe("Recently");
  });
});
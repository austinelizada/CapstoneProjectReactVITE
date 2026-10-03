import { describe, expect, it } from "vitest";
import { getOrderStatusClasses, getOrderStatusLabel, normalizeOrderStatus } from "./orderStatusUtils";

describe("customer order status utils", () => {
  it("normalizes mixed-case order statuses before filtering and rendering", () => {
    expect(normalizeOrderStatus("Completed")).toBe("completed");
    expect(normalizeOrderStatus(" Site Inspection ")).toBe("site inspection");
    expect(normalizeOrderStatus("Installation")).toBe("installation");
  });

  it("keeps the status key stable for title-case and snake_case payloads", () => {
    expect(normalizeOrderStatus("Site Inspection")).toBe("site inspection");
    expect(normalizeOrderStatus("contract_sent")).toBe("contract sent");
    expect(getOrderStatusLabel("Completed")).toBe("Completed");
    expect(getOrderStatusLabel("Site Inspection")).toBe("Site Inspection");
    expect(getOrderStatusClasses("Installation")).toContain("text-red-700");
    expect(getOrderStatusClasses("cancelled")).toContain("text-red-800");
  });
});

import { describe, it, expect } from "vitest";
import { getEstimatedInstallationDate, validateInspectionPayload } from "./SiteInspection";

describe("site inspection validation", () => {
  const validPayload = {
    customerName: "Ana Cruz",
    phone: "09171234567",
    siteAddress: "123 Main St",
    inspection_date: "2026-10-10",
    estimated_installation_date: "2026-10-15",
    items: [
      {
        product_id: "p-1",
        name: "Glass Panel",
        width: 2,
        height: 3,
        qty: 1,
      },
    ],
  };

  it("requires both inspection and estimated installation dates", () => {
    const result = validateInspectionPayload({
      ...validPayload,
      inspection_date: "",
      estimated_installation_date: "",
    });

    expect(result.inspection_date).toBe("Inspection date is required.");
    expect(result.estimated_installation_date).toBe("Estimated installation date is required.");
  });

  it("accepts a complete inspection payload", () => {
    expect(validateInspectionPayload(validPayload)).toEqual({});
  });

  it("reads the estimated installation date returned by supported API field names", () => {
    expect(getEstimatedInstallationDate({ estimated_installation_date: "2026-10-15" })).toBe("2026-10-15");
    expect(getEstimatedInstallationDate({ estimatedInstallationDate: "2026-10-16" })).toBe("2026-10-16");
    expect(getEstimatedInstallationDate({ estInstallDate: "2026-10-17" })).toBe("2026-10-17");
  });
});

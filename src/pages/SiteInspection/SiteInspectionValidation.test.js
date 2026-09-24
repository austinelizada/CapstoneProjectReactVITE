import { describe, expect, it } from "vitest";
import { requiresSignedContractForWalkIn } from "./SiteInspection";

describe("requiresSignedContractForWalkIn", () => {
  it("does not require a signed contract for walk-in customers without a website account", () => {
    expect(
      requiresSignedContractForWalkIn({
        order_type: "walk_in_customer",
        has_account_on_website: false,
      })
    ).toBe(false);
  });

  it("requires a signed contract for walk-in customers with a website account", () => {
    expect(
      requiresSignedContractForWalkIn({
        order_type: "walk_in_customer",
        has_account_on_website: true,
      })
    ).toBe(true);
  });
});

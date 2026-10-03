import { describe, expect, it } from "vitest";
import { buildProductPriceSnapshot, getProductLineTotal } from "./productPricing";

describe("getProductLineTotal", () => {
  it("uses the admin square-foot rate, dimensions, and quantity", () => {
    expect(getProductLineTotal(
      { pricing_method: "sqft", price_per_sqft: 125 },
      { width: 36, height: 48, measurement_unit: "in", quantity: 2 },
    )).toBe(3000);
  });

  it("uses the admin blade rate and blade count", () => {
    expect(getProductLineTotal(
      { pricing_method: "blade", price_per_blade: 100, blade_count: 6 },
      { quantity: 2 },
    )).toBe(1200);
  });

  it("uses the admin base price for fixed products", () => {
    expect(getProductLineTotal(
      { pricing_method: "fixed", base_price: 500 },
      { quantity: 3 },
    )).toBe(1500);
  });

  it("prefers the admin base price over a stale catalog estimate for fixed products", () => {
    expect(getProductLineTotal(
      { pricing_method: "fixed", base_price: 500, estimated_price: 900 },
      { quantity: 2 },
    )).toBe(1000);
  });

  it("uses the admin estimated-cost override as the per-product quote", () => {
    expect(getProductLineTotal(
      { pricing_method: "sqft", estimated_price_override: 2400, price_per_sqft: 300 },
      { width: 48, height: 48, quantity: 2 },
    )).toBe(4800);
  });

  it("keeps legacy per-piece products fixed even when a rate field is present", () => {
    expect(getProductLineTotal(
      { unit: "per_piece", unit_price: 750, price_per_sqft: 300 },
      { width: 36, height: 48, measurement_unit: "in", quantity: 2 },
    )).toBe(1500);
  });
});

describe("buildProductPriceSnapshot", () => {
  it("preserves the admin price fields and exact calculated line total", () => {
    expect(buildProductPriceSnapshot(
      { pricing_method: "sqft", price_per_sqft: 125, unit_price: 500 },
      { width: 36, height: 48, measurement_unit: "in", quantity: 2 },
    )).toMatchObject({
      pricing_method: "sqft",
      unit_price: 125,
      price_per_sqft: 125,
      line_total: 3000,
    });
  });
});
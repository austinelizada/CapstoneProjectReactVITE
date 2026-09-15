import { describe, it, expect } from "vitest";
import { paginateItems } from "@/lib/pagination";

describe("paginateItems", () => {
  it("returns the requested page of items and total pages", () => {
    const items = Array.from({ length: 15 }, (_, index) => ({ id: index + 1 }));

    const result = paginateItems(items, 2, 5);

    expect(result.items).toHaveLength(5);
    expect(result.items.map((item) => item.id)).toEqual([6, 7, 8, 9, 10]);
    expect(result.totalPages).toBe(3);
    expect(result.currentPage).toBe(2);
  });

  it("clamps to the last valid page when the requested page is out of range", () => {
    const items = Array.from({ length: 8 }, (_, index) => ({ id: index + 1 }));

    const result = paginateItems(items, 10, 3);

    expect(result.currentPage).toBe(3);
    expect(result.items.map((item) => item.id)).toEqual([7, 8]);
  });
});

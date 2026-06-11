import { describe, it, expect } from "vitest";
import { failedSources, sourceLabel } from "./source-summary";

describe("failedSources", () => {
  it("returns sources that recorded an error", () => {
    const f = failedSources({
      hana: { count: 2 },
      shopify: { count: 0, error: "token exchange failed 401" },
      amex: { count: 89 },
      boa_checking: { count: 0, error: "DOMMatrix is not defined" },
    });
    expect(f).toEqual([
      { source: "shopify", error: "token exchange failed 401" },
      { source: "boa_checking", error: "DOMMatrix is not defined" },
    ]);
  });

  it("returns empty when every source succeeded", () => {
    expect(failedSources({ hana: { count: 2 }, shopify: { count: 18 } })).toEqual([]);
  });

  it("ignores a count:0 source that has no error (legitimately empty)", () => {
    // a month with zero Shopify orders is not a failure
    expect(failedSources({ shopify: { count: 0 } })).toEqual([]);
  });

  it("handles null/undefined summary", () => {
    expect(failedSources(null)).toEqual([]);
    expect(failedSources(undefined)).toEqual([]);
  });
});

describe("sourceLabel", () => {
  it("maps known sources to friendly labels", () => {
    expect(sourceLabel("boa_credit")).toBe("BankAmericard");
    expect(sourceLabel("hana")).toBe("Hana POS");
  });
  it("falls back to the raw key for unknown sources", () => {
    expect(sourceLabel("mystery")).toBe("mystery");
  });
});

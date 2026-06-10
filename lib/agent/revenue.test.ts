import { describe, it, expect } from "vitest";
import { countsAsRevenue, isRevenueMirror } from "./revenue";

describe("countsAsRevenue", () => {
  it("counts Hana Net Total Sales from the hana source", () => {
    expect(
      countsAsRevenue({
        suggested_category: "Hana Sales",
        source: "hana",
        description: "Hana — Net Total Sales",
      }),
    ).toBe(true);
  });

  it("excludes Hana overlapping summary lines (Gross, Taxable, etc.)", () => {
    for (const line of [
      "Hana — Total Gross Sales",
      "Hana — Net Taxable Sales",
      "Hana — Total Sales",
    ]) {
      expect(
        countsAsRevenue({
          suggested_category: "Hana Sales",
          source: "hana",
          description: line,
        }),
      ).toBe(false);
    }
  });

  it("excludes bank-deposit mirrors categorized as a sales channel", () => {
    // a BoA deposit Claude labeled "Hana Sales" must NOT be counted (double count)
    expect(
      countsAsRevenue({
        suggested_category: "Hana Sales",
        source: "boa_checking",
        description: "CLEARENT LLC DES:Deposits",
      }),
    ).toBe(false);
    expect(
      countsAsRevenue({
        suggested_category: "Honeybook Sales",
        source: "boa_checking",
        description: "MIMOSA COLLECTIV DES:Damla Ates",
      }),
    ).toBe(false);
  });

  it("counts HoneyBook sales from honeybook source", () => {
    expect(
      countsAsRevenue({
        suggested_category: "Honeybook Sales",
        source: "honeybook",
        description: "Teresa Bebirian — 1 of 3",
      }),
    ).toBe(true);
  });

  it("excludes expense categories", () => {
    expect(
      countsAsRevenue({
        suggested_category: "Cost of goods sold",
        source: "amex",
        description: "Perri Farms",
      }),
    ).toBe(false);
  });

  it("excludes a skipped sale (removed in review must not count toward revenue)", () => {
    expect(
      countsAsRevenue({
        suggested_category: "Hana Sales",
        source: "hana",
        description: "Hana — Net Total Sales",
        status: "skipped",
      }),
    ).toBe(false);
  });

  it("still counts a sale with a non-skipped status", () => {
    for (const status of ["pending", "auto_approved", "manually_approved", "posted"]) {
      expect(
        countsAsRevenue({
          suggested_category: "Hana Sales",
          source: "hana",
          description: "Hana — Net Total Sales",
          status,
        }),
      ).toBe(true);
    }
  });

  it("counts a sale when status is omitted (back-compat)", () => {
    expect(
      countsAsRevenue({
        suggested_category: "Shopify Sales",
        source: "shopify",
        description: "Order #1001",
      }),
    ).toBe(true);
  });
});

describe("isRevenueMirror", () => {
  it("flags a bank-deposit mirror of channel revenue (would double-count at post)", () => {
    // a BoA deposit categorized as a sales channel = the mirror of an
    // already-booked sale; posting it would be a second income entry
    expect(
      isRevenueMirror({ suggested_category: "Hana Sales", source: "boa_checking" }),
    ).toBe(true);
    expect(
      isRevenueMirror({ suggested_category: "Shopify Sales", source: "boa_checking" }),
    ).toBe(true);
    expect(
      isRevenueMirror({ suggested_category: "Honeybook Sales", source: "boa_checking" }),
    ).toBe(true);
  });

  it("does NOT flag the channel's own sales line", () => {
    expect(
      isRevenueMirror({ suggested_category: "Hana Sales", source: "hana" }),
    ).toBe(false);
    expect(
      isRevenueMirror({ suggested_category: "Shopify Sales", source: "shopify" }),
    ).toBe(false);
  });

  it("does NOT flag a non-revenue category (expenses post normally)", () => {
    expect(
      isRevenueMirror({ suggested_category: "Cost of goods sold", source: "amex" }),
    ).toBe(false);
    expect(
      isRevenueMirror({ suggested_category: "Bank Fees", source: "boa_checking" }),
    ).toBe(false);
  });

  it("respects approved_category over suggested (owner edit)", () => {
    // owner moved a boa deposit to a real expense → no longer a mirror
    expect(
      isRevenueMirror({
        suggested_category: "Hana Sales",
        approved_category: "Bank Fees",
        source: "boa_checking",
      }),
    ).toBe(false);
  });
});

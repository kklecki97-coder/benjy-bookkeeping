import { describe, it, expect } from "vitest";
import { buildNarrativeFacts } from "./narrative";

const tx = (
  source: string,
  amount: number,
  suggested_category: string,
  status = "auto_approved",
  description = "",
) => ({ source, amount, suggested_category, status, description });

describe("buildNarrativeFacts", () => {
  it("totals revenue by source from each channel's own file", () => {
    const facts = buildNarrativeFacts("2026-04", [
      // Hana Sales counts only from the canonical "Net Total Sales" line
      tx("hana", 54439.28, "Hana Sales", "auto_approved", "Net Total Sales"),
      tx("honeybook", 25770.63, "Honeybook Sales"),
      // bank mirror of the same Hana money — must NOT double-count
      tx("boa_checking", 54439.28, "Hana Sales", "auto_approved", "Deposit"),
      tx("amex", -152.29, "Cost of goods sold"),
    ]);
    expect(facts.totalRevenue).toBeCloseTo(80209.91, 2);
    expect(facts.revenueBySource).toEqual([
      { source: "hana", amount: 54439.28 },
      { source: "honeybook", amount: 25770.63 },
    ]);
  });

  it("lists top expenses by category (abs amount, negative only)", () => {
    const facts = buildNarrativeFacts("2026-04", [
      tx("amex", -500, "Office supplies"),
      tx("amex", -300, "Office supplies"),
      tx("amex", -1000, "Vehicle expenses"),
      tx("hana", 54439.28, "Hana Sales"), // income — not an expense
    ]);
    expect(facts.topExpenses[0]).toEqual({ category: "Vehicle expenses", amount: 1000 });
    expect(facts.topExpenses[1]).toEqual({ category: "Office supplies", amount: 800 });
  });

  it("counts transactions and exceptions", () => {
    const facts = buildNarrativeFacts("2026-04", [
      tx("amex", -10, "X", "auto_approved"),
      tx("amex", -20, "Y", "pending"),
      tx("amex", -30, "Z", "pending"),
    ]);
    expect(facts.totalTransactions).toBe(3);
    expect(facts.exceptions).toBe(2);
  });

  it("handles an empty month", () => {
    const facts = buildNarrativeFacts("2026-04", []);
    expect(facts.totalRevenue).toBe(0);
    expect(facts.totalTransactions).toBe(0);
    expect(facts.revenueBySource).toEqual([]);
    expect(facts.topExpenses).toEqual([]);
  });
});

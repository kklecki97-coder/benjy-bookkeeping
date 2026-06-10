import { describe, it, expect } from "vitest";
import { reconcileResults, isException } from "./categorize";

const r = (id: string, confidence = 95, matched: string | null = "rule_1") => ({
  transaction_id: id,
  suggested_category: "Cost of goods sold",
  suggested_vendor: null,
  confidence,
  reasoning: "x",
  matched_rule_id: matched,
});

describe("reconcileResults", () => {
  it("passes through a complete, exact result set unchanged in coverage", () => {
    const out = reconcileResults(["a", "b"], [r("a"), r("b")]);
    expect(out.map((x) => x.transaction_id).sort()).toEqual(["a", "b"]);
  });

  it("forces a missing transaction into the exception queue", () => {
    const out = reconcileResults(["a", "b", "c"], [r("a"), r("b")]);
    const missing = out.find((x) => x.transaction_id === "c");
    expect(missing).toBeDefined();
    expect(missing!.confidence).toBe(0);
    expect(missing!.matched_rule_id).toBeNull();
    // and it routes to review
    expect(isException(missing!)).toBe(true);
  });

  it("drops a hallucinated id the model invented", () => {
    const out = reconcileResults(["a"], [r("a"), r("ghost")]);
    expect(out.map((x) => x.transaction_id)).toEqual(["a"]);
  });

  it("keeps the first of a duplicated id", () => {
    const out = reconcileResults(["a"], [r("a", 90), r("a", 10)]);
    const a = out.filter((x) => x.transaction_id === "a");
    expect(a.length).toBe(1);
    expect(a[0].confidence).toBe(90);
  });

  it("covers every input id exactly once even with mixed drops/misses", () => {
    const out = reconcileResults(
      ["a", "b", "c"],
      [r("a"), r("ghost"), r("a"), r("b")],
    );
    const ids = out.map((x) => x.transaction_id).sort();
    expect(ids).toEqual(["a", "b", "c"]);
  });

  it("handles an empty result set (all forced to review)", () => {
    const out = reconcileResults(["a", "b"], []);
    expect(out.length).toBe(2);
    expect(out.every((x) => isException(x))).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import { buildExplainPrompt, type ExplainTx } from "./explain";
import type { RuleForAgent } from "./categorize";

const rule = (over: Partial<RuleForAgent>): RuleForAgent => ({
  id: "rule_1",
  rule_type: "vendor_match",
  pattern: "PROMISE FLORAL",
  category: "Cost of goods sold",
  vendor: "Promise Floral",
  priority: 50,
  notes: "",
  ...over,
});

const tx = (over: Partial<ExplainTx> = {}): ExplainTx => ({
  source: "amex",
  date: "2026-04-12",
  amount: -84.5,
  description: "AMAZON MKTPL US*2A4B5",
  suggested_category: "Office supplies",
  suggested_vendor: "Amazon",
  confidence: 62,
  reasoning: "No rule match for Amazon purchase",
  ...over,
});

describe("buildExplainPrompt", () => {
  it("includes the transaction's own details so Claude can reason about it", () => {
    const prompt = buildExplainPrompt(tx(), []);
    expect(prompt).toContain("AMAZON MKTPL US*2A4B5");
    expect(prompt).toContain("amex");
    expect(prompt).toContain("Office supplies"); // the suggestion
    expect(prompt).toContain("62"); // confidence
  });

  it("surfaces the dollar amount in readable form", () => {
    const prompt = buildExplainPrompt(tx({ amount: -84.5 }), []);
    expect(prompt).toContain("84.5");
  });

  it("lists candidate rules when any are provided", () => {
    const prompt = buildExplainPrompt(tx(), [
      rule({ id: "rule_3", pattern: "AMAZON", category: "Office supplies" }),
    ]);
    expect(prompt).toContain("AMAZON");
    expect(prompt).toContain("rule_3");
  });

  it("states explicitly when no rule matched (the common exception case)", () => {
    const prompt = buildExplainPrompt(tx(), []);
    expect(prompt.toLowerCase()).toContain("no rule");
  });

  it("asks for a short, plain-English, owner-facing explanation", () => {
    const prompt = buildExplainPrompt(tx(), []);
    const lower = prompt.toLowerCase();
    // it should instruct a conversational, non-technical tone
    expect(lower).toContain("plain english");
    // and it must not leak internal jargon requirements like JSON
    expect(lower).not.toContain("json");
  });

  it("handles a missing suggestion gracefully", () => {
    const prompt = buildExplainPrompt(
      tx({ suggested_category: null, suggested_vendor: null }),
      [],
    );
    expect(prompt).toContain("AMAZON MKTPL US*2A4B5");
    // no crash, still asks for an explanation
    expect(prompt.toLowerCase()).toContain("plain english");
  });
});

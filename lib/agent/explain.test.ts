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

describe("buildExplainPrompt — guardrails", () => {
  const lower = (over: Partial<ExplainTx> = {}) =>
    buildExplainPrompt(tx(over), []).toLowerCase();

  it("forbids promising actions it won't perform (no 'going forward' auto-rules)", () => {
    const p = lower();
    // it must instruct NOT to claim it will remember / set up a rule itself
    expect(p).toContain("do not promise");
    // and must point the owner to the real mechanism instead
    expect(p).toContain('save as a rule');
  });

  it("forbids downplaying the need to review", () => {
    expect(lower()).toContain("do not tell the owner they can skip");
  });

  it("requires a single first-person voice ('I', never 'we'/'the system')", () => {
    expect(lower()).toContain('always write as "i"');
  });

  it("forbids inventing meaning from bank codes/abbreviations", () => {
    expect(lower()).toContain("do not invent");
  });

  it("scales length to amount instead of always being long", () => {
    const p = lower();
    expect(p).toContain("1-2 sentences");
  });

  it("forbids guessing a category when the suggestion is Uncategorized", () => {
    const p = buildExplainPrompt(
      tx({ suggested_category: "Uncategorized", confidence: 40 }),
      [],
    ).toLowerCase();
    // when there's no real basis, it must say so rather than guess a category
    expect(p).toContain("do not guess a category");
  });

  it("forbids guessing a category when there is no suggestion at all", () => {
    const p = buildExplainPrompt(
      tx({ suggested_category: null, confidence: 30 }),
      [],
    ).toLowerCase();
    expect(p).toContain("do not guess a category");
  });

  it("does NOT add the no-guess instruction when there is a real suggestion", () => {
    // a confident-ish suggestion should still let Claude state its best guess
    const p = buildExplainPrompt(
      tx({ suggested_category: "Bank Fees", confidence: 75 }),
      [],
    ).toLowerCase();
    expect(p).not.toContain("do not guess a category");
  });
});

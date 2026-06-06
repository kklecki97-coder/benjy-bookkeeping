import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { categorize } from "./categorize";
import { getRulebookRules } from "@/lib/rulebook/parse";
import type { NormalizedTransaction } from "@/types/transaction";

// Load ANTHROPIC_API_KEY from .env.local if present (vitest doesn't auto-load it).
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i > 0 && !line.startsWith("#")) {
      const k = line.slice(0, i).trim();
      const v = line.slice(i + 1).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

const hasKey = !!process.env.ANTHROPIC_API_KEY;

// Map rulebook rules to the shape categorize() expects (with stable ids).
function rulesForTest() {
  return getRulebookRules().map((r, i) => ({ ...r, id: `rule_${i}` }));
}

describe.runIf(hasKey)("Claude categorization agent (integration)", () => {
  it(
    "categorizes a CLEARENT deposit as Hana Sales with high confidence",
    async () => {
      const txs: (NormalizedTransaction & { id: string })[] = [
        {
          id: "t1",
          source: "boa_checking",
          externalId: "x1",
          date: "2026-04-01",
          amount: 2371.0,
          description: "CLEARENT LLC DES:Deposits ID:5880 INDN:Towers Flowers",
          rawData: {},
        },
        {
          id: "t2",
          source: "amex",
          externalId: "x2",
          date: "2026-04-01",
          amount: 76.2,
          description: "ADOBE Adobe Systems SAN JOSE CA",
          rawData: {},
        },
      ];

      const results = await categorize(txs, rulesForTest());
      expect(results.length).toBe(2);

      const clearent = results.find((r) => r.transaction_id === "t1");
      expect(clearent?.suggested_category).toBe("Hana Sales");
      expect(clearent?.confidence).toBeGreaterThan(70);

      const adobe = results.find((r) => r.transaction_id === "t2");
      expect(adobe?.suggested_category).toBe("Software subscriptions");
    },
    60000,
  );
});

describe.skipIf(hasKey)("Claude categorization (skipped — no API key)", () => {
  it("is skipped when ANTHROPIC_API_KEY is not set", () => {
    expect(true).toBe(true);
  });
});

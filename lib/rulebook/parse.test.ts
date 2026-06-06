import { describe, it, expect } from "vitest";
import { getRulebookRules } from "./parse";

describe("rulebook rules", () => {
  it("includes core revenue vendor-match rules", () => {
    const rules = getRulebookRules();
    const clearent = rules.find((r) => r.pattern === "CLEARENT LLC");
    expect(clearent?.category).toBe("Hana Sales");
    expect(clearent?.rule_type).toBe("vendor_match");

    const shopify = rules.find((r) => r.pattern.includes("Shopify"));
    expect(shopify?.category).toBe("Shopify Sales");
  });

  it("includes COGS vendor rules", () => {
    const rules = getRulebookRules();
    const perri = rules.find((r) => r.pattern === "Perri Farms");
    expect(perri?.category).toBe("Cost of goods sold");
    const merullo = rules.find((r) => r.pattern.includes("Merullo"));
    expect(merullo?.category).toBe("Cost of goods sold");
  });

  it("includes software subscription rules", () => {
    const rules = getRulebookRules();
    for (const vendor of ["Adobe", "Slack", "Claude.ai", "Airtable"]) {
      const rule = rules.find((r) => r.pattern === vendor);
      expect(rule?.category, `${vendor} should map`).toBe(
        "Software subscriptions",
      );
    }
  });

  it("includes the seller-note exception rule", () => {
    const rules = getRulebookRules();
    const sellerNote = rules.find(
      (r) => r.rule_type === "exception" && /seller note|Promise Floral/i.test(r.pattern + r.notes),
    );
    expect(sellerNote).toBeDefined();
  });

  it("every rule has a pattern and category", () => {
    const rules = getRulebookRules();
    expect(rules.length).toBeGreaterThan(20);
    for (const r of rules) {
      expect(r.pattern).toBeTruthy();
      expect(r.category).toBeTruthy();
      expect(["vendor_match", "category_default", "exception"]).toContain(
        r.rule_type,
      );
    }
  });
});

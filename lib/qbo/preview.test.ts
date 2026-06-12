import { describe, it, expect } from "vitest";
import { analyzePostability } from "./preview";

describe("pre-post account check", () => {
  // accounts present in QBO (case-insensitive name match, like accountMap)
  const accounts = new Set(["cost of goods sold", "utilities", "checking"]);

  it("flags categories that have no matching QBO account", () => {
    const result = analyzePostability(
      [
        { category: "Cost of goods sold", count: 10 },
        { category: "Hana Sales", count: 35 },
        { category: "Utilities", count: 4 },
        { category: "Seller Note Split", count: 1 },
      ],
      accounts,
    );

    expect(result.ok).toBe(false);
    expect(result.missing).toEqual([
      { category: "Hana Sales", count: 35 },
      { category: "Seller Note Split", count: 1 },
    ]);
    expect(result.matchedCount).toBe(14); // 10 + 4
    expect(result.missingCount).toBe(36); // 35 + 1
  });

  it("matches account names case-insensitively", () => {
    const result = analyzePostability(
      [{ category: "UTILITIES", count: 2 }],
      accounts,
    );
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("reports ok when every category has an account", () => {
    const result = analyzePostability(
      [
        { category: "Cost of goods sold", count: 3 },
        { category: "Utilities", count: 1 },
      ],
      accounts,
    );
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.missingCount).toBe(0);
  });

  it("handles an empty category list", () => {
    const result = analyzePostability([], accounts);
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.matchedCount).toBe(0);
  });

  it("does NOT flag a safe-aliased category as missing", () => {
    // We post "Software subscriptions" to the client's "Software & apps"
    // account, so the preview must consider it resolvable — not missing.
    const withAlias = new Set(["software & apps", "checking"]);
    const result = analyzePostability(
      [{ category: "Software subscriptions", count: 7 }],
      withAlias,
    );
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.matchedCount).toBe(7);
  });

  it("DOES flag owner-decision categories as missing (warn before posting)", () => {
    // These need an accounting decision; surface them so the owner is warned.
    const result = analyzePostability(
      [
        { category: "Utilities", count: 2 },
        { category: "Owner draw", count: 3 },
      ],
      accounts,
    );
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual([{ category: "Owner draw", count: 3 }]);
    expect(result.missingCount).toBe(3);
    expect(result.matchedCount).toBe(2);
  });
});

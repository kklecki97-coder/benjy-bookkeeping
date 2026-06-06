import { describe, it, expect } from "vitest";
import { extractWords, groupRowsByY, parseAmount } from "./pdf-utils";

const BOA_CREDIT = "samples/BOA Credit Card.pdf";

describe("PDF positional extraction", () => {
  it("extracts words with x/y/page coordinates", async () => {
    const words = await extractWords(BOA_CREDIT);
    expect(words.length).toBeGreaterThan(50);
    const w = words[0];
    expect(w).toHaveProperty("text");
    expect(w).toHaveProperty("x");
    expect(w).toHaveProperty("y");
    expect(w).toHaveProperty("page");
  });

  it("finds the New Balance Total near its amount on the same row", async () => {
    const words = await extractWords(BOA_CREDIT);
    const rows = groupRowsByY(words, 3);
    // a row containing "New Balance Total" should also contain 10,316.79
    const balanceRow = rows.find((r) =>
      r.map((w) => w.text).join(" ").includes("New Balance Total"),
    );
    expect(balanceRow).toBeDefined();
    const rowText = balanceRow!.map((w) => w.text).join(" ");
    expect(rowText).toContain("10,316.79");
  });
});

describe("parseAmount", () => {
  it("parses currency tokens", () => {
    expect(parseAmount("$1,203.05")).toBeCloseTo(1203.05, 2);
    expect(parseAmount("10,316.79")).toBeCloseTo(10316.79, 2);
    expect(parseAmount("-$57.01")).toBeCloseTo(-57.01, 2);
    expect(parseAmount("not money")).toBeNull();
  });
});

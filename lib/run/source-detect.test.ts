import { describe, it, expect } from "vitest";
import { detectSource, mimeFor } from "./source-detect";

describe("detectSource", () => {
  it("routes each source by filename", () => {
    expect(detectSource("Honeybook Payments April.csv")).toBe("honeybook");
    expect(detectSource("May 2026 Hana Report.pdf")).toBe("hana");
    expect(detectSource("AMEX April Statement.pdf")).toBe("amex");
    expect(detectSource("BOA April Statement (checking).pdf")).toBe("boa_checking");
  });

  it("routes a BoA CREDIT card statement to boa_credit, not boa_checking", () => {
    // 'credit' must win over the 'boa'/'checking' catch-all — this is the
    // ambiguous case: the filename contains both 'BoA' and 'Credit'.
    expect(detectSource("BoA Credit Card.pdf")).toBe("boa_credit");
    expect(detectSource("BankAmericard credit 2026-04.pdf")).toBe("boa_credit");
  });

  it("returns null for an unrecognized filename", () => {
    expect(detectSource("random-receipt.pdf")).toBeNull();
  });
});

describe("mimeFor", () => {
  it("maps known extensions", () => {
    expect(mimeFor("x.pdf")).toBe("application/pdf");
    expect(mimeFor("x.csv")).toBe("text/csv");
    expect(mimeFor("x.xlsx")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  });
  it("falls back to octet-stream", () => {
    expect(mimeFor("x.weird")).toBe("application/octet-stream");
  });
});

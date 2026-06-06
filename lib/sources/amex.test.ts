import { describe, it, expect } from "vitest";
import { amexConnector } from "./amex";

const FILE = "samples/AMEX April Statement.pdf";

describe("AmEx PDF parser (3 cardholders)", () => {
  it("tags transactions with all three cards", async () => {
    const txs = await amexConnector.parse({
      kind: "file",
      path: FILE,
      mime: "application/pdf",
    });
    const cards = new Set(txs.map((t) => t.rawData.card));
    expect(cards.has("7-02009")).toBe(true);
    expect(cards.has("7-01019")).toBe(true);
    expect(cards.has("7-02025")).toBe(true);
  });

  it("extracts a known charge (BAY SHORE VALERO 57.01 on 7-02009)", async () => {
    const txs = await amexConnector.parse({
      kind: "file",
      path: FILE,
      mime: "application/pdf",
    });
    const valero = txs.find((t) => t.description.includes("VALERO"));
    expect(valero).toBeDefined();
    expect(valero!.amount).toBeCloseTo(57.01, 2);
    expect(valero!.rawData.card).toBe("7-02009");
    expect(valero!.source).toBe("amex");
  });

  it("charges sum to total new charges $27,787.85", async () => {
    const txs = await amexConnector.parse({
      kind: "file",
      path: FILE,
      mime: "application/pdf",
    });
    // charges only (positive); payments excluded
    const sum = txs
      .filter((t) => t.amount > 0)
      .reduce((s, t) => s + t.amount, 0);
    expect(sum).toBeCloseTo(27787.85, 0);
  });

  it("produces unique external IDs", async () => {
    const txs = await amexConnector.parse({
      kind: "file",
      path: FILE,
      mime: "application/pdf",
    });
    const ids = new Set(txs.map((t) => t.externalId));
    expect(ids.size).toBe(txs.length);
  });
});

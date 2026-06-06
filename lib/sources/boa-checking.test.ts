import { describe, it, expect } from "vitest";
import { boaCheckingConnector } from "./boa-checking";

const FILE = "samples/BOA April Statement (checking).pdf";

describe("BoA Checking PDF parser", () => {
  it("extracts 73 deposits (positive amounts)", async () => {
    const txs = await boaCheckingConnector.parse({
      kind: "file",
      path: FILE,
      mime: "application/pdf",
    });
    const deposits = txs.filter((t) => t.amount > 0);
    expect(deposits.length).toBe(73);
  });

  it("deposits sum to $83,216.40", async () => {
    const txs = await boaCheckingConnector.parse({
      kind: "file",
      path: FILE,
      mime: "application/pdf",
    });
    const sum = txs
      .filter((t) => t.amount > 0)
      .reduce((s, t) => s + t.amount, 0);
    expect(sum).toBeCloseTo(83216.4, 1);
  });

  it("withdrawals+checks+fees sum to -$76,806.50", async () => {
    // withdrawals -76,304.50 + checks -500 + fees -2 = -76,806.50
    const txs = await boaCheckingConnector.parse({
      kind: "file",
      path: FILE,
      mime: "application/pdf",
    });
    const sum = txs
      .filter((t) => t.amount < 0)
      .reduce((s, t) => s + t.amount, 0);
    expect(sum).toBeCloseTo(-76806.5, 1);
  });

  it("captures a CLEARENT deposit with correct sign and source", async () => {
    const txs = await boaCheckingConnector.parse({
      kind: "file",
      path: FILE,
      mime: "application/pdf",
    });
    const clearent = txs.find((t) => t.description.includes("CLEARENT"));
    expect(clearent).toBeDefined();
    expect(clearent!.amount).toBeGreaterThan(0);
    expect(clearent!.source).toBe("boa_checking");
  });
});

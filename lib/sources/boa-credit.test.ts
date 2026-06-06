import { describe, it, expect } from "vitest";
import { boaCreditConnector } from "./boa-credit";

const FILE = "samples/BOA Credit Card.pdf";

describe("BankAmericard (BoA Credit) PDF parser", () => {
  it("extracts the purchase transactions", async () => {
    const txs = await boaCreditConnector.parse({
      kind: "file",
      path: FILE,
      mime: "application/pdf",
    });
    // 6 purchases in the sample period
    const purchases = txs.filter((t) => t.amount > 0);
    expect(purchases.length).toBe(6);
  });

  it("purchase amounts sum to the statement total $438.86", async () => {
    const txs = await boaCreditConnector.parse({
      kind: "file",
      path: FILE,
      mime: "application/pdf",
    });
    const purchaseSum = txs
      .filter((t) => t.amount > 0)
      .reduce((s, t) => s + t.amount, 0);
    expect(purchaseSum).toBeCloseTo(438.86, 2);
  });

  it("captures a known merchant (J.MERULLO IMPORTS, 152.29)", async () => {
    const txs = await boaCreditConnector.parse({
      kind: "file",
      path: FILE,
      mime: "application/pdf",
    });
    const merullo = txs.find((t) => t.description.includes("MERULLO"));
    expect(merullo).toBeDefined();
    expect(merullo!.amount).toBeCloseTo(152.29, 2);
    expect(merullo!.source).toBe("boa_credit");
  });

  it("produces unique external IDs", async () => {
    const txs = await boaCreditConnector.parse({
      kind: "file",
      path: FILE,
      mime: "application/pdf",
    });
    const ids = new Set(txs.map((t) => t.externalId));
    expect(ids.size).toBe(txs.length);
  });
});

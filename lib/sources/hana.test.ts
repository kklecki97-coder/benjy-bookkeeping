import { describe, it, expect } from "vitest";
import { hanaConnector } from "./hana";

const XLSX_FILE = "samples/Hana April Report.xlsx";
const PDF_FILE = "samples/May 2026 Hana Report.pdf";

function find(txs: { description: string; amount: number }[], label: string) {
  return txs.find((t) => t.description.toLowerCase().includes(label.toLowerCase()));
}

describe("Hana POS parser — XLSX", () => {
  it("extracts the key summary lines", async () => {
    const txs = await hanaConnector.parse({
      kind: "file",
      path: XLSX_FILE,
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    expect(txs.length).toBeGreaterThan(0);
    expect(find(txs, "Net Total Sales")?.amount).toBeCloseTo(54439.28, 2);
    expect(find(txs, "Net Taxable Sales")?.amount).toBeCloseTo(48032.0, 2);
    expect(find(txs, "Net Non Taxable Sales")?.amount).toBeCloseTo(6407.28, 2);
  });

  it("captures sales tax charged", async () => {
    const txs = await hanaConnector.parse({
      kind: "file",
      path: XLSX_FILE,
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    expect(find(txs, "SalesTax Charged")?.amount).toBeCloseTo(4194.85, 2);
  });

  it("tags source as hana with unique ids", async () => {
    const txs = await hanaConnector.parse({
      kind: "file",
      path: XLSX_FILE,
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    expect(txs.every((t) => t.source === "hana")).toBe(true);
    const ids = new Set(txs.map((t) => t.externalId));
    expect(ids.size).toBe(txs.length);
  });
});

describe("Hana POS parser — PDF", () => {
  it("extracts summary lines from the PDF format too", async () => {
    const txs = await hanaConnector.parse({
      kind: "file",
      path: PDF_FILE,
      mime: "application/pdf",
    });
    expect(txs.length).toBeGreaterThan(0);
    // PDF is May; just assert it found a Net Total Sales line with a positive amount
    const netTotal = find(txs, "Net Total Sales");
    expect(netTotal).toBeDefined();
    expect(netTotal!.amount).toBeGreaterThan(0);
  });
});

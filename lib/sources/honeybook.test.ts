import { describe, it, expect } from "vitest";
import { honeybookConnector, parseBookedClients } from "./honeybook";

const PAYMENTS = "samples/Honeybook April Payments.csv";
const BOOKED = "samples/Honeybook April-2026-Booked Client-report.csv";

describe("HoneyBook payments parser", () => {
  it("parses all 21 April payments (excludes the summary/total row)", async () => {
    const txs = await honeybookConnector.parse({
      kind: "file",
      path: PAYMENTS,
      mime: "text/csv",
    });
    // CSV has 22 data rows but the last is a totals row with no client/invoice.
    expect(txs.length).toBe(21);
  });

  it("maps the first payment correctly", async () => {
    const txs = await honeybookConnector.parse({
      kind: "file",
      path: PAYMENTS,
      mime: "text/csv",
    });
    const first = txs[0];
    expect(first.source).toBe("honeybook");
    expect(first.amount).toBeCloseTo(1162.06, 2); // NET_AMOUNT
    expect(first.date).toBe("2026-04-08");
    expect(first.description).toContain("Teresa Bebirian");
    expect(first.externalId).toContain("000392-001");
  });

  it("sums net amounts to the known total", async () => {
    const txs = await honeybookConnector.parse({
      kind: "file",
      path: PAYMENTS,
      mime: "text/csv",
    });
    const sum = txs.reduce((s, t) => s + t.amount, 0);
    expect(sum).toBeCloseTo(25770.63, 1);
  });

  it("produces unique external IDs", async () => {
    const txs = await honeybookConnector.parse({
      kind: "file",
      path: PAYMENTS,
      mime: "text/csv",
    });
    const ids = new Set(txs.map((t) => t.externalId));
    expect(ids.size).toBe(txs.length);
  });
});

describe("HoneyBook booked clients parser", () => {
  it("parses booked client rows with project values", async () => {
    const booked = await parseBookedClients(BOOKED);
    expect(booked.length).toBeGreaterThan(0);
    expect(booked[0]).toHaveProperty("projectName");
    expect(booked[0]).toHaveProperty("totalBookedValue");
  });
});

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { summarizeHoneybook } from "./revenue-je";

const MAY = readFileSync("samples/Honeybook May-2026-Payments-report-.csv", "utf8");
const APR = readFileSync("samples/Honeybook April Payments.csv", "utf8");

describe("summarizeHoneybook — extract compound-JE components from the Payments CSV", () => {
  it("REAL DATA May: gross/tax/fee/net match the verified sums", () => {
    const s = summarizeHoneybook(MAY);
    expect(s.gross).toBeCloseTo(42406.45, 2); // TOTAL_AMOUNT
    expect(s.tax).toBeCloseTo(3428.09, 2); // TAX_1+2+3 (matches rulebook)
    expect(s.fee).toBeCloseTo(1111.53, 2); // TRANSACTION_FEE
    expect(s.net).toBeCloseTo(41294.92, 2); // NET_AMOUNT (clears Honeybook Bank)
    expect(s.rows).toBe(26);
  });

  it("REAL DATA April: gross/tax/fee/net match the verified sums", () => {
    const s = summarizeHoneybook(APR);
    expect(s.gross).toBeCloseTo(26522.64, 2);
    expect(s.tax).toBeCloseTo(1951.64, 2);
    expect(s.fee).toBeCloseTo(752.01, 2);
    expect(s.net).toBeCloseTo(25770.63, 2); // matches rulebook "Amount Received on bank - April"
    expect(s.rows).toBe(21);
  });

  it("the components balance: gross == net + fee (the compound JE will balance)", () => {
    const s = summarizeHoneybook(MAY);
    expect(s.net + s.fee).toBeCloseTo(s.gross, 2);
  });

  it("salesNetOfTax = gross - tax (the Honeybook Sales credit line)", () => {
    const s = summarizeHoneybook(MAY);
    expect(s.salesNetOfTax).toBeCloseTo(42406.45 - 3428.09, 2);
  });

  it("handles an empty CSV without crashing", () => {
    const s = summarizeHoneybook("COMPANY_NAME,INVOICE,TOTAL_AMOUNT,NET_AMOUNT\n");
    expect(s.gross).toBe(0);
    expect(s.rows).toBe(0);
  });
});

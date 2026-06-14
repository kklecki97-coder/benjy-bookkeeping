import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import type { QboAccount } from "./accounts";
import {
  summarizeHoneybook,
  summarizeHanaRows,
  buildPlatformRevenueJe,
  PLATFORM_ACCOUNTS,
} from "./revenue-je";

function mk(name: string, type: string): QboAccount {
  return { Id: name.toLowerCase().replace(/\s+/g, "_"), Name: name, AccountType: type };
}
function mapOf(...a: QboAccount[]): Map<string, QboAccount> {
  const m = new Map<string, QboAccount>();
  for (const x of a) m.set(x.Name.toLowerCase().trim(), x);
  return m;
}
const ACCOUNTS = mapOf(
  mk("Hana Sales", "Income"),
  mk("Honeybook Sales", "Income"),
  mk("Shopify Sales", "Income"),
  mk("Sales Tax Payable", "Other Current Liabilities"),
  mk("Honeybook Fees", "Expense"),
  mk("Shopify Fees", "Expense"),
  mk("Hana Bank", "Other Assets"),
  mk("Honeybook Bank", "Other Assets"),
  mk("Shopify Bank", "Other Current Assets"),
  mk("Hana Shipping Income", "Income"),
  mk("Shopify Shipping Income", "Income"),
);

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

describe("summarizeHanaRows — extract compound-JE components from Hana report rows", () => {
  // Real April Hana figures (label -> value), as rows [label, value, ...].
  const aprilRows: string[][] = [
    ["Total Product Sales", "53,006.98"],
    ["Total Delivery Fee", "1,749.00"],
    ["Discounts", "316.70"],
    ["Net Total Sales", "54,439.28"],
    ["SalesTax Charged", "4,194.85"],
    ["Total Cash", "5,931.93"],
  ];

  it("REAL DATA April: pulls Net Total Sales, tax, and delivery (shipping)", () => {
    const s = summarizeHanaRows(aprilRows);
    // Net Total Sales is already net of tax+discounts; it is the Hana Sales credit.
    expect(s.salesNetOfTax).toBeCloseTo(54439.28, 2);
    expect(s.tax).toBeCloseTo(4194.85, 2);
    expect(s.shipping).toBeCloseTo(1749.0, 2); // Total Delivery Fee
  });

  it("net cash plug = sales + tax (Hana has no processor fee inside the JE)", () => {
    const s = summarizeHanaRows(aprilRows);
    // For Hana the bank plug clears sales + tax (delivery already inside net total).
    expect(s.net).toBeCloseTo(s.salesNetOfTax + s.tax, 2);
  });

  it("missing labels default to zero (returns/tips absent in Hana report)", () => {
    const s = summarizeHanaRows(aprilRows);
    expect(s.returns).toBe(0);
    expect(s.gratuity).toBe(0);
  });

  it("handles empty rows without crashing", () => {
    const s = summarizeHanaRows([]);
    expect(s.salesNetOfTax).toBe(0);
    expect(s.tax).toBe(0);
  });
});

describe("buildPlatformRevenueJe — summary -> balanced compound revenue JE", () => {
  function totals(je: ReturnType<typeof buildPlatformRevenueJe>) {
    let debit = 0, credit = 0;
    for (const l of je!.Line) {
      if (l.JournalEntryLineDetail.PostingType === "Debit") debit += l.Amount;
      else credit += l.Amount;
    }
    return { debit, credit };
  }

  it("REAL DATA: HoneyBook May JE balances and uses the right accounts", () => {
    const s = summarizeHoneybook(MAY);
    const je = buildPlatformRevenueJe(s, "honeybook", "2026-05", ACCOUNTS);
    expect(je).not.toBeNull();
    const t = totals(je!);
    expect(t.debit).toBeCloseTo(t.credit, 2); // balances on real data
    // Sales credit = net of tax
    const sales = je!.Line.find((l) => l.JournalEntryLineDetail.AccountRef.value === ACCOUNTS.get("honeybook sales")!.Id);
    expect(sales?.JournalEntryLineDetail.PostingType).toBe("Credit");
    expect(sales?.Amount).toBeCloseTo(42406.45 - 3428.09, 2);
    // Tax credit
    const tax = je!.Line.find((l) => l.JournalEntryLineDetail.AccountRef.value === ACCOUNTS.get("sales tax payable")!.Id);
    expect(tax?.JournalEntryLineDetail.PostingType).toBe("Credit");
    // Fee debit
    const fee = je!.Line.find((l) => l.JournalEntryLineDetail.AccountRef.value === ACCOUNTS.get("honeybook fees")!.Id);
    expect(fee?.JournalEntryLineDetail.PostingType).toBe("Debit");
    // Bank plug debit = net
    const bank = je!.Line.find((l) => l.JournalEntryLineDetail.AccountRef.value === ACCOUNTS.get("honeybook bank")!.Id);
    expect(bank?.JournalEntryLineDetail.PostingType).toBe("Debit");
    expect(bank?.Amount).toBeCloseTo(41294.92, 2);
  });

  it("carries the per-period idempotency key as PrivateNote", () => {
    const s = summarizeHoneybook(MAY);
    const je = buildPlatformRevenueJe(s, "honeybook", "2026-05", ACCOUNTS);
    expect(je!.PrivateNote).toBe("TF/2026-05/HONEYBOOK-REVENUE");
    expect(je!.TxnDate).toBe("2026-05-31");
  });

  it("REAL DATA: Hana JE balances (sales + tax credits, bank plug debit, shipping)", () => {
    const aprilRows: string[][] = [
      ["Net Total Sales", "54,439.28"],
      ["SalesTax Charged", "4,194.85"],
      ["Total Delivery Fee", "1,749.00"],
    ];
    const s = summarizeHanaRows(aprilRows);
    const je = buildPlatformRevenueJe(s, "hana", "2026-04", ACCOUNTS);
    expect(je).not.toBeNull();
    const t = totals(je!);
    expect(t.debit).toBeCloseTo(t.credit, 2);
  });

  it("returns null when a required account is missing (fail loud, not silent)", () => {
    const s = summarizeHoneybook(MAY);
    const sparse = mapOf(mk("Honeybook Sales", "Income")); // no bank/tax/fee accounts
    expect(buildPlatformRevenueJe(s, "honeybook", "2026-05", sparse)).toBeNull();
  });

  it("PLATFORM_ACCOUNTS maps each platform to its canonical account names", () => {
    expect(PLATFORM_ACCOUNTS.hana.sales).toBe("Hana Sales");
    expect(PLATFORM_ACCOUNTS.shopify.bank).toBe("Shopify Bank");
    expect(PLATFORM_ACCOUNTS.honeybook.fees).toBe("Honeybook Fees");
  });

  it("shipping is per-platform (real QBO has 'Hana Shipping Income', not generic)", () => {
    // Verified against the real chart of accounts: Hana Shipping Income and
    // Shopify Shipping Income exist as distinct accounts.
    expect(PLATFORM_ACCOUNTS.hana.shipping).toBe("Hana Shipping Income");
    expect(PLATFORM_ACCOUNTS.shopify.shipping).toBe("Shopify Shipping Income");
  });

  it("REAL DATA: Hana JE posts shipping to 'Hana Shipping Income' (not generic)", () => {
    const accts = mapOf(
      mk("Hana Sales", "Income"),
      mk("Sales Tax Payable", "Other Current Liabilities"),
      mk("Hana Bank", "Other Assets"),
      mk("Hana Shipping Income", "Income"),
    );
    const rows: string[][] = [
      ["Net Total Sales", "54,439.28"],
      ["SalesTax Charged", "4,194.85"],
      ["Total Delivery Fee", "1,749.00"],
    ];
    const s = summarizeHanaRows(rows);
    const je = buildPlatformRevenueJe(s, "hana", "2026-04", accts);
    expect(je).not.toBeNull();
    const ship = je!.Line.find(
      (l) => l.JournalEntryLineDetail.AccountRef.value === accts.get("hana shipping income")!.Id,
    );
    expect(ship?.Amount).toBeCloseTo(1749.0, 2);
    expect(ship?.JournalEntryLineDetail.PostingType).toBe("Credit");
  });
});

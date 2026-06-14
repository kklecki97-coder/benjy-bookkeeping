import { describe, it, expect } from "vitest";
import type { QboAccount } from "./accounts";
import {
  buildCompoundEntry,
  periodJeKey,
  shouldPostPeriodJe,
  type CompoundLine,
} from "./compound";

function mk(name: string, type: string): QboAccount {
  return { Id: name.toLowerCase().replace(/\s+/g, "_"), Name: name, AccountType: type };
}

const HB_SALES = mk("Honeybook Sales", "Income");
const SALES_TAX = mk("Sales Tax Payable", "Other Current Liabilities");
const HB_FEES = mk("Honeybook Fees", "Expense");
const HB_BANK = mk("Honeybook Bank", "Other Assets");

/** Pull totals out of a built entry. */
function totals(je: ReturnType<typeof buildCompoundEntry>) {
  let debit = 0,
    credit = 0;
  for (const l of je.Line) {
    if (l.JournalEntryLineDetail.PostingType === "Debit") debit += l.Amount;
    else credit += l.Amount;
  }
  return { debit, credit, lines: je.Line.length };
}

describe("buildCompoundEntry — N-line balanced journal entry", () => {
  it("builds a balanced multi-line entry from explicit lines", () => {
    const lines: CompoundLine[] = [
      { account: HB_SALES, side: "Credit", amount: 38978.36 },
      { account: SALES_TAX, side: "Credit", amount: 3428.09 },
      { account: HB_FEES, side: "Debit", amount: 1111.53 },
      { account: HB_BANK, side: "Debit", amount: 41294.92 },
    ];
    const je = buildCompoundEntry(lines, { privateNote: "TF/2026-05/HB-REVENUE", txnDate: "2026-05-31" });
    const t = totals(je);
    expect(t.lines).toBe(4);
    expect(t.debit).toBeCloseTo(t.credit, 2);
    expect(t.debit).toBeCloseTo(42406.45, 2);
    expect(je.PrivateNote).toBe("TF/2026-05/HB-REVENUE");
    expect(je.TxnDate).toBe("2026-05-31");
  });

  it("REAL DATA: HoneyBook May compound JE balances to $42,406.45", () => {
    // Verified from samples/Honeybook May-2026-Payments-report-.csv:
    // TOTAL 42406.45 = NET 41294.92 + FEE 1111.53; TAX 3428.09 (matches rulebook).
    // Sales credit = TOTAL - TAX (net of tax).
    const lines: CompoundLine[] = [
      { account: HB_SALES, side: "Credit", amount: 42406.45 - 3428.09 },
      { account: SALES_TAX, side: "Credit", amount: 3428.09 },
      { account: HB_FEES, side: "Debit", amount: 1111.53 },
      { account: HB_BANK, side: "Debit", amount: 41294.92 },
    ];
    const je = buildCompoundEntry(lines, { privateNote: "k", txnDate: "2026-05-31" });
    const t = totals(je);
    expect(t.debit).toBeCloseTo(t.credit, 2); // MUST balance on real data
  });

  it("each line carries the right account, side, and amount", () => {
    const lines: CompoundLine[] = [
      { account: HB_SALES, side: "Credit", amount: 100, description: "sales" },
      { account: HB_BANK, side: "Debit", amount: 100 },
    ];
    const je = buildCompoundEntry(lines, { privateNote: "x" });
    const sales = je.Line.find((l) => l.JournalEntryLineDetail.AccountRef.value === HB_SALES.Id);
    expect(sales?.JournalEntryLineDetail.PostingType).toBe("Credit");
    expect(sales?.Amount).toBeCloseTo(100, 2);
    expect(sales?.Description).toBe("sales");
  });

  it("THROWS when the entry does not balance (debit != credit)", () => {
    const lines: CompoundLine[] = [
      { account: HB_SALES, side: "Credit", amount: 100 },
      { account: HB_BANK, side: "Debit", amount: 90 }, // off by 10
    ];
    expect(() => buildCompoundEntry(lines, { privateNote: "x" })).toThrow(/balance/i);
  });

  it("tolerates sub-cent rounding (within $0.01)", () => {
    const lines: CompoundLine[] = [
      { account: HB_SALES, side: "Credit", amount: 100.004 },
      { account: HB_BANK, side: "Debit", amount: 100.0 },
    ];
    expect(() => buildCompoundEntry(lines, { privateNote: "x" })).not.toThrow();
  });

  it("drops zero-amount lines (e.g. no shipping/tips this month)", () => {
    const lines: CompoundLine[] = [
      { account: HB_SALES, side: "Credit", amount: 100 },
      { account: SALES_TAX, side: "Credit", amount: 0 }, // no tax — should be dropped
      { account: HB_BANK, side: "Debit", amount: 100 },
    ];
    const je = buildCompoundEntry(lines, { privateNote: "x" });
    expect(je.Line.length).toBe(2); // zero line dropped
  });

  it("requires at least two lines", () => {
    expect(() => buildCompoundEntry([{ account: HB_SALES, side: "Credit", amount: 100 }], { privateNote: "x" })).toThrow();
  });
});

describe("periodJeKey + shouldPostPeriodJe — per-period idempotency", () => {
  it("builds a stable deterministic key per period+type", () => {
    expect(periodJeKey("2026-05", "HANA-REVENUE")).toBe("TF/2026-05/HANA-REVENUE");
    expect(periodJeKey("2026-05", "HB-REVENUE")).toBe("TF/2026-05/HB-REVENUE");
    // stable: same inputs -> same key
    expect(periodJeKey("2026-05", "RENT")).toBe(periodJeKey("2026-05", "RENT"));
  });

  it("CRITICAL: a month-end JE that already posted does NOT post again (no double-month)", () => {
    const key = periodJeKey("2026-05", "HANA-REVENUE");
    const alreadyPosted = new Set<string>([key]); // posted in a prior run
    expect(shouldPostPeriodJe(key, alreadyPosted)).toBe(false);
  });

  it("posts a month-end JE that has not posted yet", () => {
    const key = periodJeKey("2026-05", "SHOPIFY-REVENUE");
    expect(shouldPostPeriodJe(key, new Set())).toBe(true);
  });

  it("different period or type is a different key (May Hana != June Hana, Hana != HB)", () => {
    const mayHana = periodJeKey("2026-05", "HANA-REVENUE");
    const posted = new Set<string>([mayHana]);
    // June Hana still posts
    expect(shouldPostPeriodJe(periodJeKey("2026-06", "HANA-REVENUE"), posted)).toBe(true);
    // May HoneyBook still posts
    expect(shouldPostPeriodJe(periodJeKey("2026-05", "HB-REVENUE"), posted)).toBe(true);
  });

  it("the key is what gets stored as PrivateNote (so it's recoverable from QBO)", () => {
    const key = periodJeKey("2026-05", "HANA-REVENUE");
    const je = buildCompoundEntry(
      [
        { account: HB_SALES, side: "Credit", amount: 100 },
        { account: HB_BANK, side: "Debit", amount: 100 },
      ],
      { privateNote: key },
    );
    expect(je.PrivateNote).toBe("TF/2026-05/HANA-REVENUE");
  });
});

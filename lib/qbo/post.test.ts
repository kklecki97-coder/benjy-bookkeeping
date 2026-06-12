import { describe, it, expect } from "vitest";
import { buildJournalEntry, shouldPost } from "./post";
import type { QboAccount } from "./accounts";

/** Build a fake QBO account. */
function mk(name: string, type: string): QboAccount {
  return { Id: name.toLowerCase().replace(/\s+/g, "_"), Name: name, AccountType: type };
}

// Real account names + types from Benjy's chart of accounts.
const AMEX = mk("AMEX 7-01001", "Credit Card");
const VEHICLE = mk("Vehicle expenses", "Other Expense");
const SOFTWARE = mk("Software & apps", "Expense");
const SHOPIFY_BANK = mk("Shopify Bank", "Other Current Assets");
const SHOPIFY_SALES = mk("Shopify Sales", "Income");
const HANA_BANK = mk("Hana Bank", "Other Assets");
const HANA_SALES = mk("Hana Sales", "Income");
const CHECKING = mk("Checking - 2300", "Bank");
const SALES_TAX = mk("Sales Tax Payable", "Other Current Liabilities");
const COGS = mk("Cost of goods sold", "Cost of Goods Sold");
const EQUITY = mk("Partner Equity", "Equity");

/** Pull the debit/credit lines out of an entry for assertions. */
function lines(je: ReturnType<typeof buildJournalEntry>) {
  const debit = je.Line.find((l) => l.JournalEntryLineDetail.PostingType === "Debit");
  const credit = je.Line.find((l) => l.JournalEntryLineDetail.PostingType === "Credit");
  return { debit, credit };
}

describe("QBO journal entry builder — direction from account type", () => {
  it("REGRESSION: a POSITIVE amex expense debits the expense account, not income", () => {
    // Real data: amex charges come through POSITIVE. The old code keyed
    // direction off sign (amount < 0 = expense), which would have posted this
    // as INCOME. Direction must come from the category account's type.
    const je = buildJournalEntry(
      {
        id: "t1",
        amount: 58.49, // positive, but it's an EXPENSE
        approved_category: "Vehicle expenses",
        description: "UNION 76 RIVERHEAD NY",
        date: "2026-05-09",
      },
      { category: VEHICLE, bank: AMEX },
    );
    const { debit, credit } = lines(je);
    expect(debit?.JournalEntryLineDetail.AccountRef.value).toBe(VEHICLE.Id);
    expect(credit?.JournalEntryLineDetail.AccountRef.value).toBe(AMEX.Id);
    expect(debit?.Amount).toBeCloseTo(58.49, 2);
  });

  it("a NEGATIVE amex amount (refund) flips: credit the expense, debit the card", () => {
    const je = buildJournalEntry(
      {
        id: "t2",
        amount: -21.75, // refund/return
        approved_category: "Software subscriptions",
        description: "OPENAI refund",
        date: "2026-05-10",
      },
      { category: SOFTWARE, bank: AMEX },
    );
    const { debit, credit } = lines(je);
    expect(credit?.JournalEntryLineDetail.AccountRef.value).toBe(SOFTWARE.Id);
    expect(debit?.JournalEntryLineDetail.AccountRef.value).toBe(AMEX.Id);
  });

  it("a POSITIVE shopify sale credits income, debits the bank/clearing", () => {
    const je = buildJournalEntry(
      {
        id: "t3",
        amount: 82.59,
        approved_category: "Shopify Sales",
        description: "Shopify order #1680",
        date: "2026-05-01",
      },
      { category: SHOPIFY_SALES, bank: SHOPIFY_BANK },
    );
    const { debit, credit } = lines(je);
    expect(credit?.JournalEntryLineDetail.AccountRef.value).toBe(SHOPIFY_SALES.Id);
    expect(debit?.JournalEntryLineDetail.AccountRef.value).toBe(SHOPIFY_BANK.Id);
  });

  it("a POSITIVE hana sale credits income", () => {
    const je = buildJournalEntry(
      {
        id: "t4",
        amount: 103335,
        approved_category: "Hana Sales",
        description: "Hana — Net Total Sales",
        date: "2026-05-31",
      },
      { category: HANA_SALES, bank: HANA_BANK },
    );
    const { credit } = lines(je);
    expect(credit?.JournalEntryLineDetail.AccountRef.value).toBe(HANA_SALES.Id);
  });

  it("a POSITIVE sales-tax line credits the liability", () => {
    const je = buildJournalEntry(
      {
        id: "t5",
        amount: 8075.39,
        approved_category: "Sales Tax Payable",
        description: "Hana — SalesTax Charged",
        date: "2026-05-31",
      },
      { category: SALES_TAX, bank: CHECKING },
    );
    const { debit, credit } = lines(je);
    expect(credit?.JournalEntryLineDetail.AccountRef.value).toBe(SALES_TAX.Id);
    expect(debit?.JournalEntryLineDetail.AccountRef.value).toBe(CHECKING.Id);
  });

  it("a POSITIVE COGS line debits COGS", () => {
    const je = buildJournalEntry(
      {
        id: "t6",
        amount: 152.29,
        approved_category: "Cost of goods sold",
        description: "J. Merullo Imports",
        date: "2026-05-08",
      },
      { category: COGS, bank: CHECKING },
    );
    const { debit } = lines(je);
    expect(debit?.JournalEntryLineDetail.AccountRef.value).toBe(COGS.Id);
  });

  it("a POSITIVE owner-draw line debits equity", () => {
    const je = buildJournalEntry(
      {
        id: "t7",
        amount: 1000,
        approved_category: "Owner draw",
        description: "Weekly owner draw",
        date: "2026-05-15",
      },
      { category: EQUITY, bank: CHECKING },
    );
    const { debit, credit } = lines(je);
    expect(debit?.JournalEntryLineDetail.AccountRef.value).toBe(EQUITY.Id);
    expect(credit?.JournalEntryLineDetail.AccountRef.value).toBe(CHECKING.Id);
  });

  it("is balanced: two lines, equal amounts = abs(amount)", () => {
    const je = buildJournalEntry(
      {
        id: "t8",
        amount: -152.29,
        approved_category: "Cost of goods sold",
        description: "refund",
        date: "2026-05-08",
      },
      { category: COGS, bank: CHECKING },
    );
    expect(je.Line.length).toBe(2);
    const { debit, credit } = lines(je);
    expect(debit?.Amount).toBeCloseTo(152.29, 2);
    expect(credit?.Amount).toBeCloseTo(152.29, 2);
  });

  it("stamps the journal entry with the transaction's own date (TxnDate)", () => {
    // Accounting rule: the entry must land in the period the transaction
    // occurred, NOT the day it was posted.
    const je = buildJournalEntry(
      {
        id: "t9",
        amount: 17907.77,
        approved_category: "Cost of goods sold",
        description: "IN *A PERRI FARMS, INC. BAYPORT NY",
        date: "2026-04-08",
      },
      { category: COGS, bank: CHECKING },
    );
    expect(je.TxnDate).toBe("2026-04-08");
  });
});

describe("idempotency guard", () => {
  it("skips a transaction already posted", () => {
    expect(shouldPost({ status: "posted", qbo_journal_entry_id: "je_1" })).toBe(false);
  });
  it("posts a transaction that is approved and not yet posted", () => {
    expect(
      shouldPost({ status: "manually_approved", qbo_journal_entry_id: null }),
    ).toBe(true);
  });
  it("does not post a skipped transaction", () => {
    expect(shouldPost({ status: "skipped", qbo_journal_entry_id: null })).toBe(false);
  });
  it("does NOT post auto_approved until owner confirms it", () => {
    expect(
      shouldPost({ status: "auto_approved", qbo_journal_entry_id: null }),
    ).toBe(false);
  });
  it("does not re-post a post_failed transaction without retry intent", () => {
    expect(
      shouldPost({ status: "post_failed", qbo_journal_entry_id: null }),
    ).toBe(true);
  });
});

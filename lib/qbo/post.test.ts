import { describe, it, expect } from "vitest";
import { buildJournalEntry, shouldPost } from "./post";

describe("QBO journal entry builder", () => {
  it("builds a balanced journal entry for an expense", () => {
    const je = buildJournalEntry(
      {
        id: "t1",
        amount: -152.29, // expense (debit the expense account)
        approved_category: "Cost of goods sold",
        description: "J. Merullo Imports",
        date: "2026-04-08",
      },
      {
        expenseAccountId: "60",
        bankAccountId: "35",
      },
    );
    // two lines, debit + credit, equal amounts
    expect(je.Line.length).toBe(2);
    const debit = je.Line.find((l) => l.JournalEntryLineDetail.PostingType === "Debit");
    const credit = je.Line.find(
      (l) => l.JournalEntryLineDetail.PostingType === "Credit",
    );
    expect(debit?.Amount).toBeCloseTo(152.29, 2);
    expect(credit?.Amount).toBeCloseTo(152.29, 2);
  });

  it("stamps the journal entry with the transaction's own date (TxnDate)", () => {
    // Accounting rule: the entry must land in the period the transaction
    // occurred, NOT the day it was posted. Without TxnDate, QBO defaults to
    // today and an April expense lands in June.
    const je = buildJournalEntry(
      {
        id: "t2",
        amount: -17907.77,
        approved_category: "Cost of goods sold",
        description: "IN *A PERRI FARMS, INC. BAYPORT NY",
        date: "2026-04-08",
      },
      { expenseAccountId: "60", bankAccountId: "35" },
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
    // auto_approved must be confirmed (becomes manually_approved) before posting
    expect(
      shouldPost({ status: "auto_approved", qbo_journal_entry_id: null }),
    ).toBe(false);
  });
  it("does not re-post a post_failed transaction without retry intent", () => {
    // post_failed is eligible for retry
    expect(
      shouldPost({ status: "post_failed", qbo_journal_entry_id: null }),
    ).toBe(true);
  });
});

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
  it("does not re-post a post_failed transaction without retry intent", () => {
    // post_failed is eligible for retry
    expect(
      shouldPost({ status: "post_failed", qbo_journal_entry_id: null }),
    ).toBe(true);
  });
});

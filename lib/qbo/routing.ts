import type { TransactionSource } from "@/types/transaction";
import type { QboAccount } from "./accounts";

/**
 * Account routing + alias layer for QBO journal posting.
 *
 * Pure (no server-only, no I/O) so it can be unit-tested in isolation. It takes
 * an already-built `Map<lowercased name, QboAccount>` (the shape accountMap()
 * returns) and resolves the two accounts a journal entry needs:
 *   - the CATEGORY account (what was bought/sold), and
 *   - the BANK/CARD account (which account the money moved through).
 *
 * Where the accounting is genuinely ambiguous we DO NOT guess — we fail loudly
 * with a distinct `owner_decision` reason so the owner assigns the account.
 */

/**
 * Which bank/credit-card account a transaction posts against, by its source.
 * The "other side" is chosen by SOURCE, not category: a "Honeybook Fees" charge
 * that shows up on the Amex statement is amex-sourced, so it credits the Amex
 * card (the account it was actually paid on).
 *
 * Channel sources (shopify/hana/honeybook) post their own sales lines against
 * the matching clearing account in QBO ("Shopify Bank" / "Hana Bank" /
 * "Honeybook Bank") — debit the clearing account, credit the channel's income.
 * (Bank-deposit mirrors of channel revenue are already dropped upstream by
 * isRevenueMirror, so only the channels' own sales lines reach here.)
 */
export const SOURCE_ACCOUNT: Partial<Record<TransactionSource, string>> = {
  amex: "AMEX 7-01001",
  boa_credit: "BankAmericard Platinum Plus Mastercard - 2797 - 1",
  boa_checking: "Checking - 2300",
  shopify: "Shopify Bank",
  hana: "Hana Bank",
  honeybook: "Honeybook Bank",
};

/**
 * SAFE rename-only aliases: our category name vs the client's account name for
 * the SAME thing. These do not change meaning — only spelling — so resolving
 * them is not a guess.
 */
export const CATEGORY_ALIAS: Record<string, string> = {
  "meals & entertainment": "Meals",
  "software subscriptions": "Software & apps",
  janitorial: "Janitorial Service",
  "state taxes": "New York State Tax Payable",
  uncategorized: "Uncategorized Expense",
  // Owner draws are booked against the equity account the books already use.
  "owner draw": "Partner Equity",
  "owner draw — kaela": "Partner Equity",
};

/**
 * Categories that need an accounting DECISION before they can post (which equity
 * account? which loan? principal vs interest split?). We never invent an account
 * for these — they fail loudly until the owner assigns one. Keys are lowercased.
 */
export const OWNER_DECISION_CATEGORIES = new Set<string>([
  // Loan repayments need each payment split into principal (liability paydown)
  // and interest (expense) per an amortization schedule — the 2-line builder
  // can't do that, so they fail loudly until that's built out.
  "equipment loan payment",
  "seller note split",
]);

export type CategorySide = "Debit" | "Credit";

/** Flip a posting side. */
export function flipSide(side: CategorySide): CategorySide {
  return side === "Debit" ? "Credit" : "Debit";
}

/**
 * Does this transaction's amount represent a REVERSAL of the normal direction
 * (a refund/return), given its source's sign convention? This normalizes the
 * inconsistent per-source sign conventions before posting:
 *
 *  - Cards (amex, boa_credit): a CHARGE is positive, a refund/credit is
 *    negative — so a negative amount IS a reversal.
 *  - boa_checking: the sign is the bank CASH-FLOW direction (deposit +,
 *    withdrawal −), NOT a refund. A negative withdrawal is a perfectly normal
 *    expense; direction comes from the category account type. So a checking
 *    transaction is never itself a reversal.
 *  - Channels (shopify/hana/honeybook): a sale is positive; a negative would be
 *    a return — so a negative amount is a reversal.
 *
 * Without this, the builder treated every negative amount as a refund, which
 * flipped checking expenses/owner-draws to the wrong debit/credit side.
 */
export function isReversal(source: TransactionSource, amount: number): boolean {
  if (source === "boa_checking") return false;
  return amount < 0;
}

/**
 * The "normal" side (when amount >= 0) of the CATEGORY line, derived from the
 * QBO AccountType. A negative amount (refund/return) flips it; that flip is the
 * caller's job. Returns null when direction is undefined for the type (e.g. a
 * Bank/AR/AP account) — the caller must then fail loudly rather than post a
 * wrong entry. Matches by substring because QBO's type strings vary in casing
 * and wording.
 */
export function categoryNormalSide(accountType: string): CategorySide | null {
  const t = accountType.toLowerCase();
  // Order matters: check liability/equity before the generic expense check,
  // and income before anything else.
  if (t.includes("income")) return "Credit";
  if (t.includes("liabilit")) return "Credit";
  if (t.includes("equity")) return "Debit";
  if (t.includes("cost of goods sold")) return "Debit";
  if (t.includes("expense")) return "Debit";
  return null;
}

export type ResolveResult =
  | { ok: true; account: QboAccount }
  | { ok: false; reason: "owner_decision" | "no_account"; category: string };

/**
 * Resolve a category name to a QBO account: exact name match first, then a safe
 * alias, then fail. Owner-decision categories fail with a distinct reason so the
 * UI/audit can tell "needs a human decision" apart from "accidentally missing".
 */
export function resolveCategoryAccount(
  category: string,
  accounts: Map<string, QboAccount>,
): ResolveResult {
  const key = category.toLowerCase().trim();

  if (OWNER_DECISION_CATEGORIES.has(key)) {
    return { ok: false, reason: "owner_decision", category };
  }

  const direct = accounts.get(key);
  if (direct) return { ok: true, account: direct };

  const aliasTarget = CATEGORY_ALIAS[key];
  if (aliasTarget) {
    const aliased = accounts.get(aliasTarget.toLowerCase().trim());
    if (aliased) return { ok: true, account: aliased };
  }

  return { ok: false, reason: "no_account", category };
}

export type BankResolveResult =
  | { ok: true; account: QboAccount }
  | { ok: false; reason: "owner_decision" | "no_account"; accountName?: string };

/**
 * Resolve which bank/card account the transaction's source posts against.
 * Unmapped sources (the sales channels) fail with owner_decision; a mapped name
 * that isn't present in QBO fails with no_account (and reports the name).
 */
export function resolveBankAccount(
  source: TransactionSource,
  accounts: Map<string, QboAccount>,
): BankResolveResult {
  const accountName = SOURCE_ACCOUNT[source];
  if (!accountName) return { ok: false, reason: "owner_decision" };

  const account = accounts.get(accountName.toLowerCase().trim());
  if (!account) return { ok: false, reason: "no_account", accountName };

  return { ok: true, account };
}

/**
 * Alias-aware "does this category resolve to a postable account name?" used by
 * the pre-post preview so it matches what posting will actually do. Owner-
 * decision categories deliberately return false (so they surface as a warning
 * before posting). `accountNames` is the set of lowercased account names.
 */
export function categoryResolvable(
  category: string,
  accountNames: Set<string>,
): boolean {
  const key = category.toLowerCase().trim();
  if (OWNER_DECISION_CATEGORIES.has(key)) return false;
  if (accountNames.has(key)) return true;
  const aliasTarget = CATEGORY_ALIAS[key];
  return !!aliasTarget && accountNames.has(aliasTarget.toLowerCase().trim());
}

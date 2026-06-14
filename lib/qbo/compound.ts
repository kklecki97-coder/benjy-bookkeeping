import type { QboAccount } from "./accounts";
import type { JournalLine, JournalEntry } from "./post";

/**
 * One line of a compound (multi-line) journal entry: which account, which side,
 * and how much. `description` is optional per-line memo.
 */
export interface CompoundLine {
  account: QboAccount;
  side: "Debit" | "Credit";
  amount: number;
  description?: string;
}

export interface CompoundOpts {
  /** Idempotency marker + human note (e.g. "TF/2026-05/HANA-REVENUE"). */
  privateNote: string;
  /** yyyy-mm-dd — posts the entry into the period it occurred. */
  txnDate?: string;
}

/** Debit/credit must match within this tolerance (sub-cent rounding). */
const BALANCE_TOLERANCE = 0.01;

/**
 * Build a balanced N-line journal entry. Unlike the 2-line buildJournalEntry,
 * this composes an arbitrary number of debit/credit lines (a compound entry) —
 * the shape V3's month-end revenue/rent JEs need (Sales + tax + shipping +
 * fees + bank-plug, etc.).
 *
 * Guarantees the entry balances (sum of debits == sum of credits within a cent)
 * and THROWS otherwise — a compound JE that doesn't balance is a bug that QBO
 * would reject anyway, and on real books an unbalanced entry is never acceptable.
 * Zero-amount lines are dropped (e.g. a platform with no shipping/tips this
 * month shouldn't emit empty lines). Requires at least two lines.
 */
export function buildCompoundEntry(
  lines: CompoundLine[],
  opts: CompoundOpts,
): JournalEntry {
  const nonZero = lines.filter((l) => Math.abs(l.amount) > 0);
  if (nonZero.length < 2) {
    throw new Error(
      `A journal entry needs at least two non-zero lines (got ${nonZero.length}).`,
    );
  }

  let debit = 0;
  let credit = 0;
  for (const l of nonZero) {
    if (l.side === "Debit") debit += l.amount;
    else credit += l.amount;
  }
  if (Math.abs(debit - credit) > BALANCE_TOLERANCE) {
    throw new Error(
      `Journal entry does not balance: debits ${debit.toFixed(2)} != credits ${credit.toFixed(2)} ` +
        `(diff ${(debit - credit).toFixed(2)}). PrivateNote: ${opts.privateNote}`,
    );
  }

  const jeLines: JournalLine[] = nonZero.map((l) => ({
    Amount: l.amount,
    DetailType: "JournalEntryLineDetail",
    ...(l.description ? { Description: l.description } : {}),
    JournalEntryLineDetail: {
      PostingType: l.side,
      AccountRef: { value: l.account.Id },
    },
  }));

  const je: JournalEntry = { Line: jeLines, PrivateNote: opts.privateNote };
  if (opts.txnDate) je.TxnDate = opts.txnDate;
  return je;
}

/**
 * Deterministic idempotency key for a month-end (period) journal entry, e.g.
 * `TF/2026-05/HANA-REVENUE`. Unlike per-transaction entries (keyed by txid),
 * month-end JEs are aggregates with no source transaction id — so they need a
 * stable per-(period, type) key. This becomes the JE's PrivateNote, making it
 * both the dedup key and recoverable from QuickBooks.
 */
export function periodJeKey(period: string, type: string): string {
  return `TF/${period}/${type}`;
}

/**
 * Should this month-end JE be posted? Only if its key hasn't already been
 * posted (in this or any prior run). Without this guard a re-run would post the
 * SAME aggregate again — doubling a whole month of revenue/rent in the ledger.
 * This is the single most dangerous failure mode in the V3 model, so the guard
 * is explicit and unit-tested.
 */
export function shouldPostPeriodJe(
  key: string,
  alreadyPostedKeys: Set<string>,
): boolean {
  return !alreadyPostedKeys.has(key);
}

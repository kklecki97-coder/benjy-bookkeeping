import { getValidAccessToken, apiBase } from "./oauth";
import { accountMap, type QboAccount } from "./accounts";
import { isRevenueMirror } from "@/lib/agent/revenue";
import type { TransactionSource } from "@/types/transaction";
import {
  categoryNormalSide,
  flipSide,
  isReversal,
  resolveBankAccount,
  resolveCategoryAccount,
} from "./routing";
import { buildCompoundEntry } from "./compound";

export interface PostableTx {
  id: string;
  amount: number;
  approved_category: string | null;
  suggested_category?: string | null;
  description: string;
  date?: string | null; // ISO yyyy-mm-dd — becomes the journal entry's TxnDate
}

export interface JournalAccounts {
  /** The account for what was bought/sold (its AccountType drives direction). */
  category: QboAccount;
  /** The bank/credit-card account the money moved through. */
  bank: QboAccount;
}

export interface JournalLine {
  Amount: number;
  DetailType: "JournalEntryLineDetail";
  Description?: string;
  JournalEntryLineDetail: {
    PostingType: "Debit" | "Credit";
    AccountRef: { value: string };
  };
}

export interface JournalEntry {
  Line: JournalLine[];
  PrivateNote?: string;
  TxnDate?: string; // yyyy-mm-dd — posts the entry into the period it occurred
}

/**
 * Build a balanced double-entry journal entry.
 *
 * Direction comes from the CATEGORY account's type, NOT the amount sign — real
 * source data has positive amounts for both expenses and income, so sign alone
 * would post expenses as income. The category line's "normal" side is Debit for
 * Expense/COGS/Equity, Credit for Income/Liability. The bank line is the
 * opposite side.
 *
 * `reversal` flips both lines. It must be computed per source via isReversal()
 * (NOT from the amount sign directly): cards record charges positive so a
 * negative amount is a refund (reversal), but boa_checking records withdrawals
 * negative as a normal cash-flow direction (never a reversal). Passing the raw
 * `amount < 0` here would wrongly flip every checking expense.
 *
 * Throws if the category account has a type with no defined direction (e.g. a
 * Bank/AR/AP account) — callers must resolve a sensible category first, and
 * `postTransactions` guards this before calling so it never throws in practice.
 */
export function buildJournalEntry(
  tx: PostableTx,
  accounts: JournalAccounts,
  reversal: boolean,
): JournalEntry {
  const abs = Math.abs(tx.amount);

  const normalSide = categoryNormalSide(accounts.category.AccountType);
  if (!normalSide) {
    throw new Error(
      `Cannot determine debit/credit direction for account "${accounts.category.Name}" (type "${accounts.category.AccountType}").`,
    );
  }
  // A reversal (refund/return) flips the normal direction.
  const categorySide = reversal ? flipSide(normalSide) : normalSide;
  const bankSide = flipSide(categorySide);

  // A 2-line entry is just the simplest compound entry — reuse the same builder
  // (and its balance guard) so all journal entries go through one code path.
  return buildCompoundEntry(
    [
      { account: accounts.category, side: categorySide, amount: abs, description: tx.description },
      { account: accounts.bank, side: bankSide, amount: abs, description: tx.description },
    ],
    { privateNote: `txid:${tx.id}`, ...(tx.date ? { txnDate: tx.date } : {}) },
  );
}

/** Idempotency + eligibility guard: should this transaction be posted now? */
export function shouldPost(tx: {
  status: string;
  qbo_journal_entry_id: string | null;
}): boolean {
  if (tx.qbo_journal_entry_id) return false; // already posted
  // Only owner-approved transactions post to QBO (rulebook: explicit approval
  // required). auto_approved must be confirmed via "Approve all" first.
  // post_failed is eligible for retry (it was approved before).
  return ["manually_approved", "post_failed"].includes(tx.status);
}

export interface PostResult {
  posted: number;
  failed: number;
  errors: { txId: string; error: string }[];
}

/** Raised when a journal entry posted to QBO but recording its id failed.
 * Must surface loudly (not be re-tried as a normal failure) — retrying would
 * duplicate the entry. */
export class PostRecordedFailure extends Error {}

/**
 * Post all eligible approved transactions for a run to QBO.
 * Idempotent (skips already-posted), handles 429 with backoff,
 * records failures rather than throwing.
 */
export async function postTransactions(
  runId: string,
  userId: string | null,
  supabase: {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<{ data: PostRow[] | null }>;
        not: (
          k: string,
          op: string,
          v: null,
        ) => Promise<{
          data:
            | { source: string; external_id: string; qbo_journal_entry_id: string | null }[]
            | null;
        }>;
      };
      update: (v: Record<string, unknown>) => {
        eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
      };
      insert: (v: Record<string, unknown>) => Promise<unknown>;
    };
  },
): Promise<PostResult> {
  interface PostRowLocal extends PostableTx {
    status: string;
    qbo_journal_entry_id: string | null;
    transaction_date: string | null;
    source: string;
    external_id: string;
  }
  type PostRow = PostRowLocal;

  const { token, realmId } = await getValidAccessToken();
  const accounts = await accountMap();

  const { data: txs } = await supabase
    .from("transactions")
    .select(
      "id, amount, approved_category, suggested_category, description, status, qbo_journal_entry_id, transaction_date, source, external_id",
    )
    .eq("monthly_run_id", runId);

  // Cross-run idempotency: a month can be run more than once (each run gets its
  // own copy of every transaction), and the per-row guard can't see a sibling
  // run. Collect every (source, external_id) that ALREADY posted to QBO in ANY
  // run, so we never journal the same real transaction twice across runs.
  const postedKeys = new Set<string>();
  const { data: postedRows } = await supabase
    .from("transactions")
    .select("source, external_id, qbo_journal_entry_id")
    .not("qbo_journal_entry_id", "is", null);
  for (const r of (postedRows ?? []) as {
    source: string;
    external_id: string;
    qbo_journal_entry_id: string | null;
  }[]) {
    if (r.qbo_journal_entry_id) postedKeys.add(`${r.source}::${r.external_id}`);
  }

  const result: PostResult = { posted: 0, failed: 0, errors: [] };

  for (const tx of (txs ?? []) as PostRow[]) {
    if (!shouldPost(tx)) continue;

    // Bank-deposit mirror of channel revenue: the channel's own sales line
    // already books this income, so posting the deposit too would double-count
    // revenue in QuickBooks. The display layer drops these; the post path must
    // too. Mark skipped (not posted) with a clear reason + audit entry so the
    // owner can still see/reconcile the deposit, and move on.
    if (isRevenueMirror(tx)) {
      await supabase
        .from("transactions")
        .update({
          status: "skipped",
          qbo_post_error:
            "Bank deposit mirroring channel sales — not posted to avoid double-counting revenue (the channel's own sales line is posted instead).",
        })
        .eq("id", tx.id);
      await supabase.from("audit_log").insert({
        monthly_run_id: runId,
        transaction_id: tx.id,
        action: "skipped_revenue_mirror",
      });
      continue;
    }

    // Cross-run idempotency: this same real transaction (source + external_id)
    // already posted in another run for the month. Posting again would book a
    // duplicate journal entry. Mark posted-skipped with the reason + audit, so
    // the owner sees it was intentionally not re-posted.
    if (postedKeys.has(`${tx.source}::${tx.external_id}`)) {
      await supabase
        .from("transactions")
        .update({
          status: "skipped",
          qbo_post_error:
            "Already posted to QuickBooks in another run for this month — not posted again to avoid a duplicate entry.",
        })
        .eq("id", tx.id);
      await supabase.from("audit_log").insert({
        monthly_run_id: runId,
        transaction_id: tx.id,
        action: "skipped_already_posted",
      });
      continue;
    }

    // Auto-approved transactions carry only suggested_category; fall back to it.
    const effectiveCategory = tx.approved_category ?? tx.suggested_category;

    // Record a failed post with a clear, owner-actionable reason and move on.
    const failPost = async (error: string) => {
      result.failed++;
      result.errors.push({ txId: tx.id, error });
      await supabase
        .from("transactions")
        .update({ status: "post_failed", qbo_post_error: error })
        .eq("id", tx.id);
    };

    // Resolve the category account (exact name, then safe alias). Owner-decision
    // categories fail loudly rather than guess at an equity/loan account.
    const catResult = resolveCategoryAccount(effectiveCategory ?? "", accounts);
    if (!catResult.ok) {
      await failPost(
        catResult.reason === "owner_decision"
          ? `Needs owner decision — no account assigned yet for "${catResult.category}".`
          : `No matching QBO account: ${catResult.category}`,
      );
      continue;
    }

    // Resolve the bank/card account by source. Sales channels (shopify/hana/
    // honeybook) have no confirmed clearing account yet → owner decision.
    const bankResult = resolveBankAccount(tx.source as TransactionSource, accounts);
    if (!bankResult.ok) {
      await failPost(
        bankResult.reason === "owner_decision"
          ? `Needs owner decision — no bank/clearing account confirmed for source "${tx.source}".`
          : `No QuickBooks account named "${bankResult.accountName}" for source "${tx.source}".`,
      );
      continue;
    }

    // Guard the direction: a category mapped to an account whose type has no
    // defined debit/credit side (e.g. a Bank/AR/AP account) must not post.
    if (!categoryNormalSide(catResult.account.AccountType)) {
      await failPost(
        `Unsupported account type "${catResult.account.AccountType}" for "${effectiveCategory}" — can't tell debit from credit.`,
      );
      continue;
    }

    const je = buildJournalEntry(
      { ...tx, date: tx.transaction_date },
      { category: catResult.account, bank: bankResult.account },
      isReversal(tx.source as TransactionSource, tx.amount),
    );

    try {
      const res = await postWithBackoff(realmId, token, je);
      const jeId = res.JournalEntry?.Id ?? null;
      // The entry now EXISTS in QuickBooks. Recording that id back to the DB is
      // what makes us idempotent — if this write is lost, the row still looks
      // re-postable and the next Post click would duplicate the entry. So treat
      // a failed write here as a hard, loud failure rather than swallowing it.
      const { error: writeErr } = await supabase
        .from("transactions")
        .update({
          status: "posted",
          qbo_journal_entry_id: jeId,
          posted_at: new Date().toISOString(),
          qbo_post_error: null,
        })
        .eq("id", tx.id);
      if (writeErr) {
        throw new PostRecordedFailure(
          `Posted to QuickBooks (journal entry ${jeId}) but failed to record it in the database (${writeErr.message}). ` +
            `Do NOT simply retry — that would duplicate the entry. The entry carries marker "txid:${tx.id}"; reconcile it in QuickBooks before re-running.`,
        );
      }
      // guard the rest of THIS run too, in case the same (source, external_id)
      // appears again (shouldn't, but defense-in-depth alongside the cross-run set)
      if (jeId) postedKeys.add(`${tx.source}::${tx.external_id}`);
      await supabase.from("audit_log").insert({
        monthly_run_id: runId,
        transaction_id: tx.id,
        action: "posted",
        after_state: { qbo_journal_entry_id: jeId },
        user_id: userId,
      });
      result.posted++;
    } catch (e) {
      // A posted-but-write-lost failure must NOT be recorded as a retryable
      // post_failed (that would invite the duplicate). Surface it loudly.
      if (e instanceof PostRecordedFailure) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      result.failed++;
      result.errors.push({ txId: tx.id, error: msg });
      await supabase
        .from("transactions")
        .update({ status: "post_failed", qbo_post_error: msg })
        .eq("id", tx.id);
      await supabase.from("audit_log").insert({
        monthly_run_id: runId,
        transaction_id: tx.id,
        action: "post_failed",
        after_state: { error: msg },
        user_id: userId,
      });
    }
  }

  return result;
}

interface PostRow extends PostableTx {
  status: string;
  qbo_journal_entry_id: string | null;
  transaction_date: string | null;
  source: string;
  external_id: string;
}

async function postWithBackoff(
  realmId: string,
  token: string,
  je: JournalEntry,
  attempt = 0,
): Promise<{ JournalEntry?: { Id?: string } }> {
  const res = await fetch(`${apiBase()}/v3/company/${realmId}/journalentry`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(je),
  });

  if (res.status === 429 && attempt < 3) {
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    return postWithBackoff(realmId, token, je, attempt + 1);
  }
  if (!res.ok) {
    // Log the raw Intuit fault server-side for debugging, but don't surface it
    // to the owner (it can carry internal validation/account detail and clutters
    // the UI). Return a stable, actionable message instead.
    const text = await res.text();
    console.error(`QBO post failed ${res.status}:`, text.slice(0, 500));
    const hint =
      res.status === 400
        ? " — usually a missing or closed account; check the account mapping"
        : res.status === 401 || res.status === 403
          ? " — reconnect QuickBooks in Settings"
          : "";
    throw new Error(`QuickBooks rejected this entry (HTTP ${res.status})${hint}.`);
  }
  return res.json();
}

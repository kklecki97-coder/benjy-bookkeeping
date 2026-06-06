import { getValidAccessToken, apiBase } from "./oauth";
import { accountMap } from "./accounts";

export interface PostableTx {
  id: string;
  amount: number;
  approved_category: string | null;
  suggested_category?: string | null;
  description: string;
}

export interface JournalAccounts {
  expenseAccountId: string;
  bankAccountId: string;
}

interface JournalLine {
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
}

/**
 * Build a balanced double-entry journal entry.
 * Negative amount = expense (debit expense, credit bank).
 * Positive amount = income (debit bank, credit income).
 */
export function buildJournalEntry(
  tx: PostableTx,
  accounts: JournalAccounts,
): JournalEntry {
  const abs = Math.abs(tx.amount);
  const isExpense = tx.amount < 0;

  const debit: JournalLine = {
    Amount: abs,
    DetailType: "JournalEntryLineDetail",
    Description: tx.description,
    JournalEntryLineDetail: {
      PostingType: "Debit",
      AccountRef: {
        value: isExpense ? accounts.expenseAccountId : accounts.bankAccountId,
      },
    },
  };
  const credit: JournalLine = {
    Amount: abs,
    DetailType: "JournalEntryLineDetail",
    Description: tx.description,
    JournalEntryLineDetail: {
      PostingType: "Credit",
      AccountRef: {
        value: isExpense ? accounts.bankAccountId : accounts.expenseAccountId,
      },
    },
  };
  return { Line: [debit, credit], PrivateNote: `txid:${tx.id}` };
}

/** Idempotency + eligibility guard: should this transaction be posted now? */
export function shouldPost(tx: {
  status: string;
  qbo_journal_entry_id: string | null;
}): boolean {
  if (tx.qbo_journal_entry_id) return false; // already posted
  return ["manually_approved", "auto_approved", "post_failed"].includes(tx.status);
}

export interface PostResult {
  posted: number;
  failed: number;
  errors: { txId: string; error: string }[];
}

/**
 * Post all eligible approved transactions for a run to QBO.
 * Idempotent (skips already-posted), handles 429 with backoff,
 * records failures rather than throwing.
 */
export async function postTransactions(
  runId: string,
  supabase: {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<{ data: PostRow[] | null }>;
      };
      update: (v: Record<string, unknown>) => {
        eq: (k: string, v: string) => Promise<unknown>;
      };
      insert: (v: Record<string, unknown>) => Promise<unknown>;
    };
  },
): Promise<PostResult> {
  interface PostRowLocal extends PostableTx {
    status: string;
    qbo_journal_entry_id: string | null;
  }
  type PostRow = PostRowLocal;

  const { token, realmId } = await getValidAccessToken();
  const accounts = await accountMap();

  const { data: txs } = await supabase
    .from("transactions")
    .select(
      "id, amount, approved_category, suggested_category, description, status, qbo_journal_entry_id",
    )
    .eq("monthly_run_id", runId);

  const result: PostResult = { posted: 0, failed: 0, errors: [] };

  for (const tx of (txs ?? []) as PostRow[]) {
    if (!shouldPost(tx)) continue;

    // Auto-approved transactions carry only suggested_category; fall back to it.
    const effectiveCategory = tx.approved_category ?? tx.suggested_category;
    const category = (effectiveCategory ?? "").toLowerCase().trim();
    const expenseAccount = accounts.get(category);
    const bank = accounts.get("checking") || accounts.get("bank");

    if (!expenseAccount || !bank) {
      result.failed++;
      result.errors.push({
        txId: tx.id,
        error: `No QBO account for "${effectiveCategory}"`,
      });
      await supabase
        .from("transactions")
        .update({
          status: "post_failed",
          qbo_post_error: `No matching QBO account: ${effectiveCategory}`,
        })
        .eq("id", tx.id);
      continue;
    }

    const je = buildJournalEntry(tx, {
      expenseAccountId: expenseAccount.Id,
      bankAccountId: bank.Id,
    });

    try {
      const res = await postWithBackoff(realmId, token, je);
      const jeId = res.JournalEntry?.Id ?? null;
      await supabase
        .from("transactions")
        .update({
          status: "posted",
          qbo_journal_entry_id: jeId,
          posted_at: new Date().toISOString(),
          qbo_post_error: null,
        })
        .eq("id", tx.id);
      await supabase.from("audit_log").insert({
        monthly_run_id: runId,
        transaction_id: tx.id,
        action: "posted",
        after_state: { qbo_journal_entry_id: jeId },
      });
      result.posted++;
    } catch (e) {
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
      });
    }
  }

  return result;
}

interface PostRow extends PostableTx {
  status: string;
  qbo_journal_entry_id: string | null;
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
    const text = await res.text();
    throw new Error(`QBO post failed ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

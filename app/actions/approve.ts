"use server";

import { revalidatePath } from "next/cache";
import { createSSRClient } from "@/lib/supabase/ssr";

async function requireUser() {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Approve ALL auto-categorized transactions in a run in one click
 * (owner confirms they trust the AI's suggestions). Copies suggested→approved
 * and flips status to manually_approved so they become eligible to post. */
export async function approveAllAuto(runId: string) {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const { data: txs } = await supabase
    .from("transactions")
    .select("id, suggested_category, suggested_vendor")
    .eq("monthly_run_id", runId)
    .eq("status", "auto_approved");

  for (const t of txs ?? []) {
    await supabase
      .from("transactions")
      .update({
        status: "manually_approved",
        approved_category: t.suggested_category,
        approved_vendor: t.suggested_vendor,
        approved_at: new Date().toISOString(),
      })
      .eq("id", t.id);
  }
  await supabase.from("audit_log").insert({
    monthly_run_id: runId,
    action: "approved_all_auto",
    after_state: { count: txs?.length ?? 0 },
    user_id: user.id,
  });
  revalidatePath("/dashboard");
  return { ok: true, message: `Approved ${txs?.length ?? 0} auto-categorized.` };
}

/** Approve every pending/auto transaction in a category for a run. */
export async function approveCategory(runId: string, category: string) {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const { data: txs } = await supabase
    .from("transactions")
    .select("id, suggested_category, suggested_vendor")
    .eq("monthly_run_id", runId)
    .eq("suggested_category", category)
    .in("status", ["pending", "auto_approved"]);

  for (const t of txs ?? []) {
    await supabase
      .from("transactions")
      .update({
        status: "manually_approved",
        approved_category: t.suggested_category,
        approved_vendor: t.suggested_vendor,
        approved_at: new Date().toISOString(),
      })
      .eq("id", t.id);
    await supabase.from("audit_log").insert({
      monthly_run_id: runId,
      transaction_id: t.id,
      action: "approved",
      after_state: { category: t.suggested_category },
      user_id: user.id,
    });
  }
  revalidatePath("/dashboard");
  return { ok: true, message: `Approved ${txs?.length ?? 0} in ${category}.` };
}

/** Accept Claude's suggestion for a single transaction. */
export async function acceptSuggestion(txId: string) {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const { data: tx } = await supabase
    .from("transactions")
    .select("monthly_run_id, suggested_category, suggested_vendor")
    .eq("id", txId)
    .single();
  if (!tx) return { ok: false, message: "Transaction not found." };

  await supabase
    .from("transactions")
    .update({
      status: "manually_approved",
      approved_category: tx.suggested_category,
      approved_vendor: tx.suggested_vendor,
      approved_at: new Date().toISOString(),
    })
    .eq("id", txId);
  await supabase.from("audit_log").insert({
    monthly_run_id: tx.monthly_run_id,
    transaction_id: txId,
    action: "approved",
    after_state: { category: tx.suggested_category },
    user_id: user.id,
  });
  revalidatePath("/dashboard");
  return { ok: true, message: "Accepted." };
}

/** Derive a stable rule pattern from a transaction description (first
 * meaningful merchant token — strips dates, ids, trailing numbers). */
function patternFromDescription(desc: string): string {
  // take the leading words up to the first long number / id
  const cleaned = desc
    .replace(/\d{2}\/\d{2}(\/\d{2,4})?/g, " ") // dates
    .replace(/\b\d{6,}\b/g, " ") // long ids
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean).slice(0, 3);
  return words.join(" ").slice(0, 40);
}

/** Edit category/vendor for a single transaction and approve it.
 * If saveAsRule, also create a vendor-match rule so future transactions
 * matching this merchant auto-categorize. */
export async function editTransaction(
  txId: string,
  category: string,
  vendor: string | null,
  note: string | null,
  saveAsRule = false,
) {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const { data: before } = await supabase
    .from("transactions")
    .select("monthly_run_id, suggested_category, description")
    .eq("id", txId)
    .single();

  await supabase
    .from("transactions")
    .update({
      status: "manually_approved",
      approved_category: category,
      approved_vendor: vendor,
      user_note: note,
      approved_at: new Date().toISOString(),
    })
    .eq("id", txId);
  await supabase.from("audit_log").insert({
    monthly_run_id: before?.monthly_run_id ?? null,
    transaction_id: txId,
    action: "edited",
    before_state: { category: before?.suggested_category },
    after_state: { category, vendor, note },
    user_id: user.id,
  });

  let ruleMsg = "";
  if (saveAsRule && before?.description) {
    const pattern = patternFromDescription(before.description);
    if (pattern) {
      // avoid duplicate rule for the same pattern
      const { data: existing } = await supabase
        .from("rulebook_rules")
        .select("id")
        .eq("pattern", pattern)
        .maybeSingle();
      if (!existing) {
        await supabase.from("rulebook_rules").insert({
          rule_type: "vendor_match",
          pattern,
          category,
          vendor,
          priority: 50,
          notes: "Created from a reviewed transaction",
        });
        await supabase.from("audit_log").insert({
          action: "rule_created",
          after_state: { pattern, category, vendor },
          user_id: user.id,
        });
        ruleMsg = ` Rule added: "${pattern}" → ${category}.`;
      } else {
        ruleMsg = " (rule already exists)";
      }
    }
  }

  revalidatePath("/dashboard");
  return { ok: true, message: `Updated.${ruleMsg}` };
}

/** Skip a transaction (won't be posted). */
export async function skipTransaction(txId: string) {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const { data: tx } = await supabase
    .from("transactions")
    .select("monthly_run_id")
    .eq("id", txId)
    .single();

  await supabase.from("transactions").update({ status: "skipped" }).eq("id", txId);
  await supabase.from("audit_log").insert({
    monthly_run_id: tx?.monthly_run_id ?? null,
    transaction_id: txId,
    action: "skipped",
    user_id: user.id,
  });
  revalidatePath("/dashboard");
  return { ok: true, message: "Skipped." };
}

/** Restore a skipped transaction back into review (pending). */
export async function unskipTransaction(txId: string) {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const { data: tx } = await supabase
    .from("transactions")
    .select("monthly_run_id")
    .eq("id", txId)
    .single();

  await supabase.from("transactions").update({ status: "pending" }).eq("id", txId);
  await supabase.from("audit_log").insert({
    monthly_run_id: tx?.monthly_run_id ?? null,
    transaction_id: txId,
    action: "unskipped",
    user_id: user.id,
  });
  revalidatePath("/dashboard");
  return { ok: true, message: "Restored." };
}

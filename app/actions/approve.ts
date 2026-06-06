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

/** Edit category/vendor for a single transaction and approve it. */
export async function editTransaction(
  txId: string,
  category: string,
  vendor: string | null,
  note: string | null,
) {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const { data: before } = await supabase
    .from("transactions")
    .select("monthly_run_id, suggested_category")
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
  revalidatePath("/dashboard");
  return { ok: true, message: "Updated." };
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

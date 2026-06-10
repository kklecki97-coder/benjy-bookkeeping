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

  // One bulk UPDATE (was a per-row loop). Categories vary across the run, so we
  // don't copy suggested→approved_category here; posting falls back to
  // approved_category ?? suggested_category (post.ts), and suggested_category is
  // already set, so the approved categories are preserved correctly.
  const { data: updated } = await supabase
    .from("transactions")
    .update({
      status: "manually_approved",
      approved_at: new Date().toISOString(),
    })
    .eq("monthly_run_id", runId)
    .eq("status", "auto_approved")
    .select("id");

  const count = (updated ?? []).length;
  await supabase.from("audit_log").insert({
    monthly_run_id: runId,
    action: "approved_all_auto",
    after_state: { count },
    user_id: user.id,
  });
  revalidatePath("/dashboard");
  return { ok: true, message: `Approved ${count} auto-categorized.` };
}

/** Approve every pending/auto transaction in a category for a run.
 * One bulk UPDATE + one bulk audit INSERT (was a per-row loop). Every row in
 * the group shares this `category` (it's the grouping key), so approved_category
 * is uniform; approved_vendor isn't used at post time (post.ts reads
 * approved_category ?? suggested_category and ignores vendor), so we don't need
 * to copy it per-row. */
export async function approveCategory(runId: string, category: string) {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const { data: updated } = await supabase
    .from("transactions")
    .update({
      status: "manually_approved",
      approved_category: category,
      approved_at: new Date().toISOString(),
    })
    .eq("monthly_run_id", runId)
    .eq("suggested_category", category)
    .in("status", ["pending", "auto_approved"])
    .select("id");

  const ids = (updated ?? []).map((t) => t.id);
  if (ids.length > 0) {
    await supabase.from("audit_log").insert(
      ids.map((id) => ({
        monthly_run_id: runId,
        transaction_id: id,
        action: "approved",
        after_state: { category },
        user_id: user.id,
      })),
    );
  }
  revalidatePath("/dashboard");
  return { ok: true, message: `Approved ${ids.length} in ${category}.` };
}

/** Skip every pending transaction with this suggested category (bulk remove).
 * One bulk UPDATE + one bulk audit INSERT — not a per-row loop, which made
 * large groups crawl through dozens of sequential round-trips. */
export async function skipCategory(runId: string, category: string) {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const { data: updated } = await supabase
    .from("transactions")
    .update({ status: "skipped" })
    .eq("monthly_run_id", runId)
    .eq("suggested_category", category)
    .eq("status", "pending")
    .select("id");

  const ids = (updated ?? []).map((t) => t.id);
  if (ids.length > 0) {
    await supabase.from("audit_log").insert(
      ids.map((id) => ({
        monthly_run_id: runId,
        transaction_id: id,
        action: "skipped",
        user_id: user.id,
      })),
    );
  }
  revalidatePath("/dashboard");
  return { ok: true, message: `Removed ${ids.length} from ${category}.` };
}

/** Move every pending transaction with this suggested category to a new one,
 * WITHOUT approving. They leave the exception queue and land in the new
 * category as auto_approved ("to confirm"), so the owner still approves the
 * group deliberately. suggested_category is updated (the dashboard groups by
 * it); the original lands in the audit log. */
export async function recategorizeCategory(
  runId: string,
  fromCategory: string,
  toCategory: string,
) {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, message: "Not authenticated." };
  if (!toCategory.trim()) return { ok: false, message: "Pick a category." };

  // One bulk UPDATE + one bulk audit INSERT (was a per-row loop).
  const { data: updated } = await supabase
    .from("transactions")
    .update({
      status: "auto_approved",
      suggested_category: toCategory,
      approved_category: null,
      approved_at: null,
    })
    .eq("monthly_run_id", runId)
    .eq("suggested_category", fromCategory)
    .eq("status", "pending")
    .select("id");

  const ids = (updated ?? []).map((t) => t.id);
  if (ids.length > 0) {
    await supabase.from("audit_log").insert(
      ids.map((id) => ({
        monthly_run_id: runId,
        transaction_id: id,
        action: "edited",
        before_state: { category: fromCategory },
        after_state: { category: toCategory },
        user_id: user.id,
      })),
    );
  }
  revalidatePath("/dashboard");
  return {
    ok: true,
    message: `Moved ${ids.length} to ${toCategory} — confirm them there.`,
  };
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

/** Move a transaction to a different category WITHOUT approving it. It lands in
 * the new category as auto_approved ("to confirm"), so the owner still
 * deliberately approves it there — moving is not the same as deciding it's
 * final. We set suggested_category too (not just approved_category) because the
 * dashboard groups by suggested_category; the original is kept in the audit log. */
export async function recategorizeTransaction(txId: string, category: string) {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, message: "Not authenticated." };
  if (!category.trim()) return { ok: false, message: "Pick a category." };

  const { data: before } = await supabase
    .from("transactions")
    .select("monthly_run_id, suggested_category, approved_category")
    .eq("id", txId)
    .single();

  await supabase
    .from("transactions")
    .update({
      status: "auto_approved",
      suggested_category: category,
      approved_category: null,
      approved_at: null,
    })
    .eq("id", txId);
  await supabase.from("audit_log").insert({
    monthly_run_id: before?.monthly_run_id ?? null,
    transaction_id: txId,
    action: "edited",
    before_state: {
      category: before?.approved_category ?? before?.suggested_category,
    },
    after_state: { category },
    user_id: user.id,
  });
  revalidatePath("/dashboard");
  return { ok: true, message: `Moved to ${category} — confirm it there.` };
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

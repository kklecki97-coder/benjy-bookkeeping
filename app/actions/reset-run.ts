"use server";

import { revalidatePath } from "next/cache";
import { createSSRClient } from "@/lib/supabase/ssr";

/**
 * Reset (delete) a monthly run BEFORE anything has been posted to QuickBooks,
 * so the owner can start the month over from a clean slate. Deleting the run
 * cascades to its transactions (FK on delete cascade) and nulls the audit_log
 * link (on delete set null), preserving the audit trail.
 *
 * Guard: if ANY transaction in the run was already posted (status "posted" or
 * has a qbo_journal_entry_id), we refuse — deleting our row wouldn't undo the
 * QuickBooks entries, and we won't manufacture a books-vs-app mismatch.
 */
export async function resetRun(
  runId: string,
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  // Has anything already gone to QuickBooks?
  const { count: postedCount } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("monthly_run_id", runId)
    .not("qbo_journal_entry_id", "is", null);

  if ((postedCount ?? 0) > 0) {
    return {
      ok: false,
      message: `${postedCount} transaction(s) already posted to QuickBooks — reset is blocked so the app can't drift from your books.`,
    };
  }

  const { error } = await supabase.from("monthly_runs").delete().eq("id", runId);
  if (error) {
    return { ok: false, message: `Couldn't reset: ${error.message}` };
  }

  // record the reset on the (now run-less) audit trail
  await supabase.from("audit_log").insert({
    action: "run_reset",
    after_state: { runId },
    user_id: user.id,
  });

  revalidatePath("/dashboard");
  return { ok: true, message: "Run reset — start a fresh monthly close." };
}

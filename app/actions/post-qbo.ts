"use server";

import { revalidatePath } from "next/cache";
import { createSSRClient } from "@/lib/supabase/ssr";
import { createServiceClient } from "@/lib/supabase/server";
import { postTransactions } from "@/lib/qbo/post";
import { accountMap } from "@/lib/qbo/accounts";
import { analyzePostability, type PostabilityResult } from "@/lib/qbo/preview";
import { isConnected } from "@/lib/qbo/oauth";
import { sendSummaryEmail, type SummaryData } from "@/lib/email/summary";
import { countsAsRevenue } from "@/lib/agent/revenue";

const SOURCE_LABELS: Record<string, string> = {
  hana: "Hana POS",
  honeybook: "HoneyBook",
  shopify: "Shopify",
  amex: "AmEx",
  boa_checking: "BoA Checking",
  boa_credit: "BankAmericard",
};

async function buildSummary(
  supabase: ReturnType<typeof createServiceClient>,
  runId: string,
  posted: number,
): Promise<SummaryData> {
  const { data: run } = await supabase
    .from("monthly_runs")
    .select("month_year")
    .eq("id", runId)
    .single();
  const { data: txs } = await supabase
    .from("transactions")
    .select("source, amount, approved_category, description, status")
    .eq("monthly_run_id", runId);

  const all = txs ?? [];
  const auto = all.filter((t) => t.status === "auto_approved").length;
  const reviewed = all.filter((t) => t.status === "manually_approved").length;

  // revenue = sales from each channel's own source (see countsAsRevenue)
  const revBySource = new Map<string, number>();
  for (const t of all) {
    if (!countsAsRevenue(t)) continue;
    const label = SOURCE_LABELS[t.source] ?? t.source;
    revBySource.set(label, (revBySource.get(label) ?? 0) + Math.abs(Number(t.amount)));
  }
  // top expenses (negative amounts) by category
  const expByCat = new Map<string, number>();
  for (const t of all) {
    const amt = Number(t.amount);
    if (amt < 0 && t.approved_category) {
      expByCat.set(
        t.approved_category,
        (expByCat.get(t.approved_category) ?? 0) + Math.abs(amt),
      );
    }
  }

  return {
    monthYear: run?.month_year ?? "",
    totalProcessed: all.length,
    autoCategorized: auto,
    manuallyReviewed: reviewed,
    posted,
    revenueBySource: [...revBySource.entries()].map(([source, amount]) => ({
      source,
      amount,
    })),
    topExpenses: [...expByCat.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5),
    dashboardUrl: "https://benjy-bookkeeping.vercel.app/history",
  };
}

/**
 * Pre-post check: which approved categories have no matching QBO account?
 * Shows the owner what would fail BEFORE posting, so they can create the
 * missing accounts in QuickBooks first. Read-only — never modifies QBO.
 */
export async function previewPost(
  runId: string,
): Promise<
  | { ok: true; preview: PostabilityResult }
  | { ok: false; message: string }
> {
  const ssr = await createSSRClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  if (!(await isConnected())) {
    return {
      ok: false,
      message: "QuickBooks is not connected. Connect it in Settings.",
    };
  }

  try {
    const supabase = createServiceClient();
    // categories about to post = approved (or previously failed) transactions
    const { data: txs } = await supabase
      .from("transactions")
      .select("approved_category, suggested_category, status")
      .eq("monthly_run_id", runId)
      .in("status", ["manually_approved", "post_failed"]);

    const counts = new Map<string, number>();
    for (const t of txs ?? []) {
      const cat = (t.approved_category ?? t.suggested_category ?? "Uncategorized").trim();
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }

    const accounts = await accountMap();
    const accountNames = new Set([...accounts.keys()]);
    const preview = analyzePostability(
      [...counts.entries()].map(([category, count]) => ({ category, count })),
      accountNames,
    );
    return { ok: true, preview };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Preview failed.",
    };
  }
}

export async function postToQbo(
  runId: string,
): Promise<{ ok: boolean; message: string }> {
  const ssr = await createSSRClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  if (!(await isConnected())) {
    return { ok: false, message: "QuickBooks is not connected. Connect it in Settings." };
  }

  try {
    // postTransactions needs full DB access (service role) for updates + audit
    const supabase = createServiceClient();
    const result = await postTransactions(runId, supabase as never);

    await supabase
      .from("monthly_runs")
      .update({
        // "error" only if nothing posted at all; partial success is "complete"
        // (post_failed transactions remain eligible to retry on the next Post).
        status: result.posted === 0 && result.failed > 0 ? "error" : "complete",
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId);

    // Send summary email (no-op if RESEND_API_KEY unset)
    if (result.posted > 0 && user.email) {
      try {
        const summary = await buildSummary(supabase, runId, result.posted);
        await sendSummaryEmail(user.email, summary);
      } catch {
        // email failure should not fail the post
      }
    }

    revalidatePath("/dashboard");
    return {
      ok: result.failed === 0,
      message: `Posted ${result.posted} transactions to QuickBooks.${result.failed > 0 ? ` ${result.failed} couldn't post (usually a missing QuickBooks account) — fix the account and post again; only the failed ones will retry.` : ""}`,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Posting failed.",
    };
  }
}

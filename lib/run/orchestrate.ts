import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import type { NormalizedTransaction, TransactionSource } from "@/types/transaction";
import type { ParseInput, SourceConnector } from "@/lib/sources/types";
import { honeybookConnector } from "@/lib/sources/honeybook";
import { hanaConnector } from "@/lib/sources/hana";
import { boaCreditConnector } from "@/lib/sources/boa-credit";
import { boaCheckingConnector } from "@/lib/sources/boa-checking";
import { amexConnector } from "@/lib/sources/amex";
import { shopifyConnector } from "@/lib/sources/shopify";
import { categorize, isException, type RuleForAgent } from "@/lib/agent/categorize";

const CONNECTORS: Record<TransactionSource, SourceConnector> = {
  honeybook: honeybookConnector,
  hana: hanaConnector,
  boa_credit: boaCreditConnector,
  boa_checking: boaCheckingConnector,
  amex: amexConnector,
  shopify: shopifyConnector,
};

export interface SourceInput {
  source: TransactionSource;
  input: ParseInput;
}

export interface RunResult {
  runId: string;
  sourceSummary: Record<string, { count: number; error?: string }>;
  totalTransactions: number;
  exceptions: number;
}

/**
 * Orchestrate one monthly close:
 *  1. create monthly_run row
 *  2. run each source connector (isolated — one failure doesn't kill the rest)
 *  3. insert normalized transactions (dedupe by source+external_id)
 *  4. categorize via Claude, write suggestions back
 *  5. write audit log entries
 */
export async function runMonthlyClose(
  monthYear: string,
  sources: SourceInput[],
  userId: string | null,
): Promise<RunResult> {
  const supabase = createServiceClient();

  const { data: run, error: runErr } = await supabase
    .from("monthly_runs")
    .insert({ month_year: monthYear, status: "parsing", created_by: userId })
    .select("id")
    .single();
  if (runErr || !run) throw new Error(`Failed to create run: ${runErr?.message}`);
  const runId = run.id;

  // Shopify is API-based (no file to upload), so it's auto-included whenever
  // credentials are configured — pulled for the same month, alongside whatever
  // files/Drive sources were passed in. Skip if the caller already added it.
  const effectiveSources = [...sources];
  const shopifyConfigured =
    !!process.env.SHOPIFY_STORE_DOMAIN &&
    !!process.env.SHOPIFY_CLIENT_ID &&
    !!process.env.SHOPIFY_CLIENT_SECRET;
  if (shopifyConfigured && !effectiveSources.some((s) => s.source === "shopify")) {
    effectiveSources.push({
      source: "shopify",
      input: { kind: "api", monthYear },
    });
  }

  // --- parse all sources, isolated per source ---
  const sourceSummary: RunResult["sourceSummary"] = {};
  const allTx: NormalizedTransaction[] = [];

  for (const { source, input } of effectiveSources) {
    try {
      const connector = CONNECTORS[source];
      const txs = await connector.parse(input);
      allTx.push(...txs);
      sourceSummary[source] = { count: txs.length };
    } catch (e) {
      sourceSummary[source] = {
        count: 0,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  // --- insert transactions (dedupe by source+external_id) ---
  const seen = new Set<string>();
  const rows = allTx
    .filter((t) => {
      const key = `${t.source}|${t.externalId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((t) => ({
      monthly_run_id: runId,
      source: t.source,
      external_id: t.externalId,
      transaction_date: t.date || null,
      amount: t.amount,
      description: t.description,
      raw_data: t.rawData as never,
      status: "pending" as const,
    }));

  if (rows.length > 0) {
    const { error: insErr } = await supabase
      .from("transactions")
      .upsert(rows, {
        onConflict: "monthly_run_id,source,external_id",
        ignoreDuplicates: true,
      });
    if (insErr) throw new Error(`Failed to insert transactions: ${insErr.message}`);
  }

  // --- load inserted transactions + rules ---
  await supabase
    .from("monthly_runs")
    .update({ status: "categorizing" })
    .eq("id", runId);

  const { data: inserted } = await supabase
    .from("transactions")
    .select("id, source, external_id, transaction_date, amount, description")
    .eq("monthly_run_id", runId);

  const { data: rules } = await supabase
    .from("rulebook_rules")
    .select("id, rule_type, pattern, category, vendor, priority, notes");

  let exceptions = 0;

  if (inserted && inserted.length > 0 && rules) {
    const txForAgent = inserted.map((t) => ({
      id: t.id,
      source: t.source as TransactionSource,
      externalId: t.external_id,
      date: t.transaction_date ?? "",
      amount: Number(t.amount),
      description: t.description ?? "",
      rawData: {},
    }));

    const results = await categorize(txForAgent, rules as RuleForAgent[]);

    // write suggestions back, one update per transaction
    for (const c of results) {
      const exception = isException(c);
      if (exception) exceptions++;
      await supabase
        .from("transactions")
        .update({
          suggested_category: c.suggested_category,
          suggested_vendor: c.suggested_vendor,
          confidence: c.confidence,
          reasoning: c.reasoning,
          status: exception ? "pending" : "auto_approved",
        })
        .eq("id", c.transaction_id);
    }
  }

  // --- finalize ---
  await supabase
    .from("monthly_runs")
    .update({ status: "awaiting_approval", source_summary: sourceSummary })
    .eq("id", runId);

  await supabase.from("audit_log").insert({
    monthly_run_id: runId,
    action: "run_completed",
    after_state: { sourceSummary, totalTransactions: rows.length, exceptions },
    user_id: userId,
  });

  return {
    runId,
    sourceSummary,
    totalTransactions: rows.length,
    exceptions,
  };
}

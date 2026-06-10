import { createSSRClient } from "@/lib/supabase/ssr";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RunControls } from "@/components/run-controls";
import { CategoryGroup, type GroupTx } from "@/components/category-group";
import { type ExceptionTx } from "@/components/exception-row";
import { ExceptionGroup } from "@/components/exception-group";
import { SkippedRow } from "@/components/skipped-row";
import { ResetRun } from "@/components/reset-run";
import { PostBar } from "@/components/post-bar";
import { StatCards, type RunStats } from "@/components/stat-cards";
import {
  RevenueBySource,
  type SourceRevenue,
} from "@/components/revenue-by-source";
import { countsAsRevenue } from "@/lib/agent/revenue";
import { getKnownCategories } from "@/lib/categories";
import { isConnected as qboConnected, qboEnv } from "@/lib/qbo/oauth";
import { accountMap } from "@/lib/qbo/accounts";
import { EmptyState } from "@/components/empty-state";
import { Inbox, CheckCircle2, FileUp, Sparkles } from "lucide-react";

function currentMonth(): string {
  // Static default; user can edit. Avoids Date.now() determinism concerns in tests.
  return "2026-04";
}

export default async function DashboardPage() {
  const supabase = await createSSRClient();

  const { data: drive } = await supabase
    .from("drive_connection")
    .select("id")
    .limit(1)
    .maybeSingle();
  const driveConnected = !!drive;

  // categories the owner can pick from when editing an exception
  const categories = await getKnownCategories();

  // surface QBO connection status up front (so a disconnected QBO is caught
  // before review, not at the final Post click)
  const qboIsConnected = await qboConnected();
  const qboEnvironment = qboEnv();

  // Lowercased QBO account names, so review can flag categories that have no
  // matching account BEFORE posting. Empty set if QBO isn't connected/reachable
  // (then we simply don't show the warning).
  let qboAccountNames: string[] = [];
  if (qboIsConnected) {
    try {
      qboAccountNames = [...(await accountMap()).keys()];
    } catch {
      qboAccountNames = [];
    }
  }

  // Latest accounting period (month_year), tie-broken by start time. Ordering
  // by month_year — not started_at — keeps "current run" consistent with the
  // previous-month lookup the comparison chips and narrative use, so the
  // dashboard shows the latest period and compares against the right prior one.
  const { data: run } = await supabase
    .from("monthly_runs")
    .select("id, month_year, status, started_at, narrative")
    .order("month_year", { ascending: false })
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let groups: { category: string; txs: GroupTx[] }[] = [];
  let exceptions: ExceptionTx[] = [];
  let exceptionGroups: { category: string; txs: ExceptionTx[] }[] = [];
  let skipped: { id: string; source: string; description: string; amount: number }[] = [];
  let failedCount = 0;
  let postedCount = 0;
  let stats: RunStats = { total: 0, autoCategorized: 0, needReview: 0, revenue: 0 };
  let revenueBySource: SourceRevenue[] = [];

  if (run) {
    const { data: txs } = await supabase
      .from("transactions")
      .select(
        "id, source, description, amount, suggested_category, approved_category, suggested_vendor, confidence, reasoning, status",
      )
      .eq("monthly_run_id", run.id);

    const all = txs ?? [];
    const auto = all.filter(
      (t) => t.status === "auto_approved" || t.status === "manually_approved",
    );
    const exc = all.filter((t) => t.status === "pending");
    const skippedTxs = all.filter((t) => t.status === "skipped");
    const failedTxs = all.filter((t) => t.status === "post_failed");
    // anything already in QuickBooks → reset must be blocked
    postedCount = all.filter((t) => t.status === "posted").length;

    // Revenue = sales from each channel's own source file (not bank-deposit
    // mirrors, not overlapping Hana summary lines). See countsAsRevenue.
    const revenueTxs = all.filter(countsAsRevenue);

    // stats
    stats = {
      total: all.length,
      autoCategorized: auto.length,
      needReview: exc.length,
      revenue: revenueTxs.reduce((s, t) => s + Math.abs(Number(t.amount)), 0),
    };

    // revenue by source (sales categories only)
    const revMap = new Map<string, number>();
    for (const t of revenueTxs) {
      revMap.set(t.source, (revMap.get(t.source) ?? 0) + Math.abs(Number(t.amount)));
    }

    // previous month's per-source revenue, for the ▲/▼ vs-last-month chips.
    // Same prev-run lookup the narrative uses; null when there's no prior run.
    const prevMap = new Map<string, number>();
    const { data: prevRun } = await supabase
      .from("monthly_runs")
      .select("id")
      .lt("month_year", run.month_year)
      .neq("id", run.id)
      .order("month_year", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (prevRun) {
      const { data: prevTxs } = await supabase
        .from("transactions")
        .select("source, amount, suggested_category, approved_category, status, description")
        .eq("monthly_run_id", prevRun.id);
      for (const t of (prevTxs ?? []).filter(countsAsRevenue)) {
        prevMap.set(
          t.source,
          (prevMap.get(t.source) ?? 0) + Math.abs(Number(t.amount)),
        );
      }
    }

    revenueBySource = [...revMap.entries()].map(([source, amount]) => ({
      source,
      amount,
      previousAmount: prevRun ? (prevMap.get(source) ?? 0) : null,
    }));

    const byCategory = new Map<string, GroupTx[]>();
    for (const t of auto) {
      const cat = t.suggested_category ?? "Uncategorized";
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push({
        id: t.id,
        source: t.source,
        description: t.description ?? "",
        amount: Number(t.amount),
        confidence: t.confidence,
        status: t.status,
      });
    }
    groups = [...byCategory.entries()]
      .map(([category, txs]) => ({ category, txs }))
      .sort((a, b) => a.category.localeCompare(b.category));

    exceptions = exc.map((t) => ({
      id: t.id,
      source: t.source,
      description: t.description ?? "",
      amount: Number(t.amount),
      suggested_category: t.suggested_category,
      suggested_vendor: t.suggested_vendor,
      confidence: t.confidence,
      reasoning: t.reasoning,
    }));

    // group exceptions by suggested category so the owner can act in bulk
    const excByCat = new Map<string, ExceptionTx[]>();
    for (const e of exceptions) {
      const cat = e.suggested_category ?? "Uncategorized";
      if (!excByCat.has(cat)) excByCat.set(cat, []);
      excByCat.get(cat)!.push(e);
    }
    exceptionGroups = [...excByCat.entries()]
      .map(([category, txs]) => ({ category, txs }))
      .sort((a, b) => a.category.localeCompare(b.category));

    skipped = skippedTxs.map((t) => ({
      id: t.id,
      source: t.source,
      description: t.description ?? "",
      amount: Number(t.amount),
    }));
    failedCount = failedTxs.length;
  }

  const autoCount = groups.reduce((s, g) => s + g.txs.length, 0);
  const allGroupTxs = groups.flatMap((g) => g.txs);
  // approved & ready to post
  const readyCount = allGroupTxs.filter(
    (t) => t.status === "manually_approved",
  ).length;
  // auto-categorized still awaiting the owner's confirmation
  const pendingAutoCount = allGroupTxs.filter(
    (t) => t.status === "auto_approved",
  ).length;

  return (
    <>
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Monthly Close
          </h1>
          <p className="text-sm text-muted-foreground">
            Upload sources, review, and post to QuickBooks.
          </p>
        </div>
        <div
          className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
            qboIsConnected
              ? "border-primary/30 bg-primary/5 text-primary"
              : "border-destructive/30 bg-destructive/5 text-destructive"
          }`}
          title={
            qboIsConnected
              ? `QuickBooks connected (${qboEnvironment})`
              : "QuickBooks not connected — posting is disabled"
          }
        >
          <span
            className={`size-1.5 rounded-full ${qboIsConnected ? "bg-primary" : "bg-destructive"}`}
          />
          QuickBooks {qboIsConnected ? qboEnvironment : "disconnected"}
        </div>
      </header>

      {/* Summary is always visible — shows zeros before the first run so the
          page structure stays stable instead of appearing only after upload.
          Live run progress is shown inside RunControls (the "Processing…" panel),
          so we don't duplicate it with a separate pipeline strip here. */}
      <div className="mb-8 flex flex-col gap-4">
        <StatCards stats={stats} />
      </div>

      <div className="mb-8">
        <RunControls
          defaultMonth={currentMonth()}
          driveConnected={driveConnected}
          shopifyConnected={
            !!process.env.SHOPIFY_STORE_DOMAIN &&
            !!process.env.SHOPIFY_CLIENT_ID &&
            !!process.env.SHOPIFY_CLIENT_SECRET
          }
          hasRun={!!run}
        />
      </div>

      {run ? (
        <section className="flex flex-col gap-6">
          {run.narrative && (
            <div className="glass rounded-xl border-l-2 border-primary/50 p-5">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <span className="text-xs font-medium uppercase tracking-wide text-primary">
                  Month in review
                </span>
              </div>
              <p className="text-sm leading-relaxed text-foreground/90">
                {run.narrative}
              </p>
            </div>
          )}
          <RevenueBySource data={revenueBySource} horizontal />

          <div>
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="font-heading text-lg font-medium">
                Review — {run.month_year}
              </h2>
              <div className="flex items-center gap-4">
                <p className="text-sm text-muted-foreground">
                  {autoCount} auto · {exceptions.length} to review
                  {skipped.length > 0 && ` · ${skipped.length} skipped`}
                  {failedCount > 0 && (
                    <span className="text-destructive">
                      {" "}· {failedCount} failed to post
                    </span>
                  )}
                </p>
                <ResetRun
                  runId={run.id}
                  monthYear={run.month_year}
                  postedCount={postedCount}
                />
              </div>
            </div>

            <Tabs defaultValue="auto">
              <TabsList>
                <TabsTrigger value="auto">Auto-categorized ({autoCount})</TabsTrigger>
                <TabsTrigger value="exceptions">
                  Exceptions ({exceptions.length})
                </TabsTrigger>
                {skipped.length > 0 && (
                  <TabsTrigger value="skipped">
                    Skipped ({skipped.length})
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="auto" className="mt-4 flex flex-col gap-3">
                {groups.length === 0 ? (
                  <EmptyState
                    icon={Inbox}
                    title="No transactions yet"
                    hint="Run a monthly close to see auto-categorized transactions here."
                  />
                ) : (
                  groups.map((g) => (
                    <CategoryGroup
                      key={g.category}
                      runId={run.id}
                      category={g.category}
                      transactions={g.txs}
                      categories={categories}
                      qboAccountNames={qboAccountNames}
                    />
                  ))
                )}
              </TabsContent>

                <TabsContent
                  value="exceptions"
                  className="mt-4 flex flex-col gap-3"
                >
                  {exceptions.length === 0 ? (
                    <EmptyState
                      icon={CheckCircle2}
                      title="No exceptions"
                      hint="Everything categorized cleanly — nothing needs your review."
                    />
                  ) : (
                    exceptionGroups.map((g) => (
                      <ExceptionGroup
                        key={g.category}
                        runId={run.id}
                        category={g.category}
                        transactions={g.txs}
                        categories={categories}
                        qboAccountNames={qboAccountNames}
                      />
                    ))
                  )}
                </TabsContent>

                {skipped.length > 0 && (
                  <TabsContent
                    value="skipped"
                    className="mt-4 flex flex-col gap-2"
                  >
                    <p className="mb-1 text-xs text-muted-foreground">
                      These won&apos;t be posted to QuickBooks. Restore any to put
                      it back into review.
                    </p>
                    {skipped.map((tx) => (
                      <SkippedRow key={tx.id} tx={tx} />
                    ))}
                  </TabsContent>
                )}
              </Tabs>
          </div>

          <PostBar
            runId={run.id}
            readyCount={readyCount}
            autoCount={pendingAutoCount}
          />
        </section>
      ) : (
        <section>
          <EmptyState
            icon={FileUp}
            title="No runs yet"
            hint="Upload your source files above to start your first monthly close."
          />
        </section>
      )}
    </>
  );
}

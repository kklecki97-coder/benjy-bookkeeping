import { createSSRClient } from "@/lib/supabase/ssr";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RunControls } from "@/components/run-controls";
import { CategoryGroup, type GroupTx } from "@/components/category-group";
import { ExceptionRow, type ExceptionTx } from "@/components/exception-row";
import { PostBar } from "@/components/post-bar";
import { StatCards, type RunStats } from "@/components/stat-cards";
import {
  RevenueBySource,
  type SourceRevenue,
} from "@/components/revenue-by-source";
import { countsAsRevenue } from "@/lib/agent/revenue";
import { getKnownCategories } from "@/lib/categories";
import { EmptyState } from "@/components/empty-state";
import { Inbox, CheckCircle2, FileUp } from "lucide-react";

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

  // most recent run
  const { data: run } = await supabase
    .from("monthly_runs")
    .select("id, month_year, status, started_at")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let groups: { category: string; txs: GroupTx[] }[] = [];
  let exceptions: ExceptionTx[] = [];
  let stats: RunStats = { total: 0, autoCategorized: 0, needReview: 0, revenue: 0 };
  let revenueBySource: SourceRevenue[] = [];

  if (run) {
    const { data: txs } = await supabase
      .from("transactions")
      .select(
        "id, source, description, amount, suggested_category, suggested_vendor, confidence, reasoning, status",
      )
      .eq("monthly_run_id", run.id);

    const all = txs ?? [];
    const auto = all.filter(
      (t) => t.status === "auto_approved" || t.status === "manually_approved",
    );
    const exc = all.filter((t) => t.status === "pending");

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
    revenueBySource = [...revMap.entries()].map(([source, amount]) => ({
      source,
      amount,
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
      <header className="mb-8">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Monthly Close
        </h1>
        <p className="text-sm text-muted-foreground">
          Upload sources, review, and post to QuickBooks.
        </p>
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
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-heading text-lg font-medium">
                  Review — {run.month_year}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {autoCount} auto · {exceptions.length} to review
                </p>
              </div>

              <Tabs defaultValue="auto">
              <TabsList>
                <TabsTrigger value="auto">Auto-categorized ({autoCount})</TabsTrigger>
                <TabsTrigger value="exceptions">
                  Exceptions ({exceptions.length})
                </TabsTrigger>
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
                    exceptions.map((tx) => (
                      <ExceptionRow key={tx.id} tx={tx} categories={categories} />
                    ))
                  )}
                </TabsContent>
              </Tabs>
            </div>

            <div className="lg:col-span-1">
              <RevenueBySource data={revenueBySource} />
            </div>
          </div>

          <PostBar
            runId={run.id}
            readyCount={readyCount}
            autoCount={pendingAutoCount}
          />
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <EmptyState
              icon={FileUp}
              title="No runs yet"
              hint="Upload your source files above to start your first monthly close."
            />
          </div>
          <div className="lg:col-span-1">
            <RevenueBySource data={[]} />
          </div>
        </section>
      )}
    </>
  );
}

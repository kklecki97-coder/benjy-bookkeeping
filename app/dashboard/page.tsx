import { redirect } from "next/navigation";
import Link from "next/link";
import { createSSRClient } from "@/lib/supabase/ssr";
import { signOut } from "./actions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RunControls } from "@/components/run-controls";
import { CategoryGroup, type GroupTx } from "@/components/category-group";
import { ExceptionRow, type ExceptionTx } from "@/components/exception-row";
import { PostBar } from "@/components/post-bar";

function currentMonth(): string {
  // Static default; user can edit. Avoids Date.now() determinism concerns in tests.
  return "2026-04";
}

export default async function DashboardPage() {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // most recent run
  const { data: run } = await supabase
    .from("monthly_runs")
    .select("id, month_year, status, started_at")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let groups: { category: string; txs: GroupTx[] }[] = [];
  let exceptions: ExceptionTx[] = [];

  if (run) {
    const { data: txs } = await supabase
      .from("transactions")
      .select(
        "id, source, description, amount, suggested_category, suggested_vendor, confidence, reasoning, status",
      )
      .eq("monthly_run_id", run.id);

    const auto = (txs ?? []).filter(
      (t) => t.status === "auto_approved" || t.status === "manually_approved",
    );
    const exc = (txs ?? []).filter((t) => t.status === "pending");

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
  const readyCount = groups
    .flatMap((g) => g.txs)
    .filter((t) => t.status === "manually_approved").length;

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Towers Flowers — Monthly Close
            </h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/settings">
              <Button variant="outline" size="sm">
                Settings
              </Button>
            </Link>
            <Link href="/history">
              <Button variant="outline" size="sm">
                History
              </Button>
            </Link>
            <form action={signOut}>
              <Button variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </header>

        <div className="mb-8">
          <RunControls defaultMonth={currentMonth()} />
        </div>

        {run ? (
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-medium">
                Review — {run.month_year}{" "}
                <span className="text-sm text-muted-foreground">({run.status})</span>
              </h2>
              <p className="text-sm text-muted-foreground">
                {autoCount} auto-categorized · {exceptions.length} need review
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
                  <p className="text-sm text-muted-foreground">No transactions yet.</p>
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

              <TabsContent value="exceptions" className="mt-4 flex flex-col gap-3">
                {exceptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No exceptions — everything categorized cleanly.
                  </p>
                ) : (
                  exceptions.map((tx) => <ExceptionRow key={tx.id} tx={tx} />)
                )}
              </TabsContent>
            </Tabs>

            <PostBar runId={run.id} readyCount={readyCount} />
          </section>
        ) : (
          <p className="text-sm text-muted-foreground">
            No runs yet. Upload source files above to start your first close.
          </p>
        )}
      </div>
    </main>
  );
}

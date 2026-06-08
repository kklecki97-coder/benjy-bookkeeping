import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSSRClient } from "@/lib/supabase/ssr";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { countsAsRevenue } from "@/lib/agent/revenue";

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const STATUS_LABELS: Record<string, string> = {
  posted: "Posted to QuickBooks",
  post_failed: "Failed to post",
  manually_approved: "Approved (not posted)",
  auto_approved: "Auto-categorized (unconfirmed)",
  pending: "Needs review",
  skipped: "Skipped",
};

const ACTION_LABELS: Record<string, string> = {
  approved: "Approved",
  approved_all_auto: "Approved all auto-categorized",
  edited: "Edited category",
  skipped: "Skipped transaction",
  rule_created: "Created a rule",
  posted: "Posted to QuickBooks",
  post_failed: "Post failed",
};

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const supabase = await createSSRClient();

  const { data: run } = await supabase
    .from("monthly_runs")
    .select("id, month_year, status, started_at, completed_at")
    .eq("id", runId)
    .maybeSingle();

  if (!run) notFound();

  const { data: txs } = await supabase
    .from("transactions")
    .select("source, amount, status, approved_category, suggested_category, qbo_post_error")
    .eq("monthly_run_id", runId);

  const all = txs ?? [];

  // counts by status
  const byStatus = new Map<string, number>();
  for (const t of all) byStatus.set(t.status, (byStatus.get(t.status) ?? 0) + 1);

  // revenue (sales from each channel's own source — see countsAsRevenue)
  const revenue = all
    .filter(countsAsRevenue)
    .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

  // failed-to-post reasons grouped by category
  const failByCat = new Map<string, number>();
  for (const t of all) {
    if (t.status === "post_failed") {
      const cat = (t.approved_category ?? t.suggested_category ?? "Uncategorized").trim();
      failByCat.set(cat, (failByCat.get(cat) ?? 0) + 1);
    }
  }
  const failures = [...failByCat.entries()].sort((a, b) => b[1] - a[1]);

  // audit trail
  const { data: audit } = await supabase
    .from("audit_log")
    .select("action, after_state, created_at")
    .eq("monthly_run_id", runId)
    .order("created_at", { ascending: false })
    .limit(50);

  const posted = byStatus.get("posted") ?? 0;
  const failed = byStatus.get("post_failed") ?? 0;

  return (
    <>
      <header className="mb-8">
        <Link
          href="/history"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to history
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {run.month_year}
          </h1>
          <Badge variant="secondary">{run.status}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Started {run.started_at?.slice(0, 10)}
          {run.completed_at ? ` · Completed ${run.completed_at.slice(0, 10)}` : ""}
        </p>
      </header>

      {/* Top-line numbers */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Transactions", value: String(all.length) },
          { label: "Posted to QBO", value: String(posted) },
          { label: "Failed", value: String(failed) },
          { label: "Revenue", value: fmtMoney(revenue) },
        ].map((c) => (
          <div key={c.label} className="glass rounded-xl p-4">
            <span className="text-xs text-muted-foreground">{c.label}</span>
            <p className="font-heading text-2xl font-semibold">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Breakdown by status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Breakdown by status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {[...byStatus.entries()].sort().map(([status, n]) => (
              <div
                key={status}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-muted-foreground">
                  {STATUS_LABELS[status] ?? status}
                </span>
                <span className="tabular-nums font-medium">{n}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Failed-to-post reasons */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Couldn&apos;t post ({failed})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {failures.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing failed — every approved entry posted.
              </p>
            ) : (
              <>
                <p className="mb-1 text-xs text-muted-foreground">
                  These categories had no matching QuickBooks account:
                </p>
                {failures.map(([cat, n]) => (
                  <div
                    key={cat}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>{cat}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {n} tx
                    </span>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Audit trail */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Activity log</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5">
          {(audit ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded.</p>
          ) : (
            (audit ?? []).map((a, i) => (
              <div
                key={i}
                className="flex items-center justify-between border-b border-border py-1.5 text-sm last:border-0"
              >
                <span>{ACTION_LABELS[a.action] ?? a.action}</span>
                <span className="text-xs text-muted-foreground">
                  {String(a.created_at).slice(0, 16).replace("T", " ")}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
}

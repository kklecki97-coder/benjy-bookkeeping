import { NextResponse } from "next/server";
import { createSSRClient } from "@/lib/supabase/ssr";

/**
 * Live posting progress for the most recent run — polled by the PostBar while
 * a "Post to QuickBooks" action is running. postTransactions updates each
 * transaction's status in the DB as it goes, so we can count how many have
 * reached a terminal posting state (posted / post_failed) versus how many were
 * approved and still in flight.
 */
export async function GET() {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: run } = await supabase
    .from("monthly_runs")
    .select("id, status")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!run) return NextResponse.json({ status: "none" });

  // Total work for this posting pass = approved + already-terminal entries.
  const { count: posted } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("monthly_run_id", run.id)
    .eq("status", "posted");

  const { count: failed } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("monthly_run_id", run.id)
    .eq("status", "post_failed");

  const { count: pending } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("monthly_run_id", run.id)
    .eq("status", "manually_approved");

  const done = (posted ?? 0) + (failed ?? 0);
  const total = done + (pending ?? 0);

  return NextResponse.json({
    status: run.status,
    posted: posted ?? 0,
    failed: failed ?? 0,
    pending: pending ?? 0,
    done,
    total,
  });
}

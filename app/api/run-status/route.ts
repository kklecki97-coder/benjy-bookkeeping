import { NextResponse } from "next/server";
import { createSSRClient } from "@/lib/supabase/ssr";

/**
 * Live status of the most recent run — polled by the progress UI.
 * Returns the run status plus a categorized/total counter so the front-end
 * can show real progress ("Categorizing 120/231").
 */
export async function GET() {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: run } = await supabase
    .from("monthly_runs")
    .select("id, status, month_year")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!run) return NextResponse.json({ status: "none" });

  const { count: total } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("monthly_run_id", run.id);

  // categorized = anything past "pending" (auto_approved/manually_approved/etc.)
  // OR has a suggested_category set while categorizing.
  const { count: categorized } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("monthly_run_id", run.id)
    .not("suggested_category", "is", null);

  return NextResponse.json({
    status: run.status,
    monthYear: run.month_year,
    total: total ?? 0,
    categorized: categorized ?? 0,
  });
}

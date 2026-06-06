import { createSSRClient } from "@/lib/supabase/ssr";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function HistoryPage() {
  const supabase = await createSSRClient();

  const { data: runs } = await supabase
    .from("monthly_runs")
    .select("id, month_year, status, started_at, source_summary")
    .order("started_at", { ascending: false });

  return (
    <>
      <header className="mb-8">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          History
        </h1>
        <p className="text-sm text-muted-foreground">Past monthly closes</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Runs</CardTitle>
          <CardDescription>
            Every close, with status and source counts.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(runs ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs yet.</p>
          ) : (
            (runs ?? []).map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between rounded-xl glass glass-hover p-3 text-sm"
              >
                <span className="font-medium">{run.month_year}</span>
                <Badge variant="secondary">{run.status}</Badge>
                <span className="text-xs text-muted-foreground">
                  {run.started_at?.slice(0, 10)}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
}

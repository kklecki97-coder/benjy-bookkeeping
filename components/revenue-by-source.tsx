import { BarChart3, TrendingUp, TrendingDown, Minus, Sparkle } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { revenueDelta } from "@/lib/revenue-delta";

export interface SourceRevenue {
  source: string;
  amount: number;
  /** same channel's revenue last month, if there was a prior run */
  previousAmount?: number | null;
}

const LABELS: Record<string, string> = {
  hana: "Hana POS",
  honeybook: "HoneyBook",
  shopify: "Shopify",
  amex: "AmEx",
  boa_checking: "BoA Checking",
  boa_credit: "BankAmericard",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

/** Month-over-month change chip next to a channel's amount. Renders nothing
 * when there's no previous month to compare. */
function DeltaBadge({
  current,
  previous,
}: {
  current: number;
  previous: number | null | undefined;
}) {
  const d = revenueDelta(current, previous);
  if (!d) return null;

  if (d.direction === "flat") {
    return (
      <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="size-3" />
        flat
      </span>
    );
  }
  if (d.direction === "new") {
    return (
      <span className="flex items-center gap-0.5 text-xs text-primary">
        <Sparkle className="size-3" />
        new
      </span>
    );
  }
  const up = d.direction === "up";
  return (
    <span
      className={`flex items-center gap-0.5 text-xs ${up ? "text-primary" : "text-warning"}`}
      title={`${up ? "Up" : "Down"} ${d.pct}% vs last month`}
    >
      {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {d.pct}%
    </span>
  );
}

export function RevenueBySource({
  data,
  horizontal = false,
}: {
  data: SourceRevenue[];
  horizontal?: boolean;
}) {
  const sorted = [...data].sort((a, b) => b.amount - a.amount);
  const total = sorted.reduce((s, d) => s + d.amount, 0);

  if (total <= 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue by source</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={BarChart3}
            title="No revenue yet"
            hint="Run a monthly close to see a breakdown by channel."
            className="border-0 bg-transparent py-6"
          />
        </CardContent>
      </Card>
    );
  }

  // Horizontal layout for the full-width strip above the console: a single
  // stacked proportion bar with the channels laid out in a row beneath it.
  if (horizontal) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between gap-1.5 text-base">
            <span className="flex items-center gap-1.5">
              Revenue by source
              <span
                className="flex size-4 cursor-help items-center justify-center rounded-full bg-muted/50 text-[10px] text-muted-foreground"
                title="Counts sales from each channel's own report (Hana, HoneyBook, Shopify). Bank deposits of that same money are excluded so revenue isn't double-counted."
              >
                i
              </span>
            </span>
            <span className="tabular-nums text-sm font-medium">{fmt(total)}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* same per-channel bars as the vertical view, laid out in a row */}
          <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((d) => {
              const pct = Math.round((d.amount / total) * 100);
              return (
                <div key={d.source}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                    <span>{LABELS[d.source] ?? d.source}</span>
                    <span className="flex items-center gap-2">
                      <DeltaBadge current={d.amount} previous={d.previousAmount} />
                      <span className="tabular-nums text-muted-foreground">
                        {fmt(d.amount)}
                      </span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-foreground/5">
                    <div
                      className="h-full rounded-full bg-primary/70"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-base">
          Revenue by source
          <span
            className="flex size-4 cursor-help items-center justify-center rounded-full bg-muted/50 text-[10px] text-muted-foreground"
            title="Counts sales from each channel's own report (Hana, HoneyBook, Shopify). Bank deposits of that same money are excluded so revenue isn't double-counted."
          >
            i
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {sorted.map((d) => {
          const pct = Math.round((d.amount / total) * 100);
          return (
            <div key={d.source}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span>{LABELS[d.source] ?? d.source}</span>
                <span className="tabular-nums text-muted-foreground">
                  {fmt(d.amount)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-foreground/5">
                <div
                  className="h-full rounded-full bg-primary/70"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
        <div className="mt-1 flex items-center justify-between border-t border-border pt-3 text-sm font-medium">
          <span>Total</span>
          <span className="tabular-nums">{fmt(total)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

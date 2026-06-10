import { BarChart3 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";

export interface SourceRevenue {
  source: string;
  amount: number;
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

export function RevenueBySource({ data }: { data: SourceRevenue[] }) {
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

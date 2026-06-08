import { Layers, CheckCircle2, AlertTriangle, DollarSign } from "lucide-react";

export interface RunStats {
  total: number;
  autoCategorized: number;
  needReview: number;
  revenue: number;
}

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

export function StatCards({ stats }: { stats: RunStats }) {
  const autoPct =
    stats.total > 0 ? Math.round((stats.autoCategorized / stats.total) * 100) : 0;

  const cards = [
    {
      label: "Transactions",
      value: String(stats.total),
      icon: Layers,
      tone: "text-foreground",
    },
    {
      label: "Auto-categorized",
      value: `${stats.autoCategorized}`,
      hint: `${autoPct}%`,
      icon: CheckCircle2,
      tone: "text-primary",
    },
    {
      label: "Need review",
      value: String(stats.needReview),
      icon: AlertTriangle,
      tone: stats.needReview > 0 ? "text-warning" : "text-muted-foreground",
    },
    {
      label: "Revenue",
      value: fmtMoney(stats.revenue),
      icon: DollarSign,
      tone: "text-foreground",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.label} className="glass rounded-xl p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{c.label}</span>
              <Icon className={`size-4 ${c.tone}`} />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className={`font-heading text-2xl font-semibold ${c.tone}`}>
                {c.value}
              </span>
              {c.hint && (
                <span className="text-xs text-muted-foreground">{c.hint}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

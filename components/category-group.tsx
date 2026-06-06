"use client";

import { useState, useTransition } from "react";
import { approveCategory } from "@/app/actions/approve";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface GroupTx {
  id: string;
  source: string;
  description: string;
  amount: number;
  confidence: number | null;
  status: string;
}

export interface CategoryGroupProps {
  runId: string;
  category: string;
  transactions: GroupTx[];
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export function CategoryGroup({ runId, category, transactions }: CategoryGroupProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const total = transactions.reduce((s, t) => s + t.amount, 0);
  const allApproved = transactions.every((t) => t.status === "manually_approved");

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-4 p-4">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-3 text-left"
        >
          <span className="text-muted-foreground text-xs">{open ? "▼" : "▶"}</span>
          <span className="font-medium">{category}</span>
          <Badge variant="secondary">{transactions.length}</Badge>
          {allApproved && <Badge>approved</Badge>}
        </button>
        <span className="text-sm tabular-nums text-muted-foreground">{fmt(total)}</span>
        <Button
          size="sm"
          variant={allApproved ? "outline" : "default"}
          disabled={pending || allApproved}
          onClick={() =>
            startTransition(async () => {
              await approveCategory(runId, category);
            })
          }
        >
          {allApproved ? "Approved" : pending ? "Approving…" : "Approve group"}
        </Button>
      </div>

      {open && (
        <div className="border-t border-border">
          {transactions.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-4 px-4 py-2 text-sm border-b border-border/50 last:border-0"
            >
              <span className="text-muted-foreground w-20 shrink-0 text-xs uppercase">
                {t.source}
              </span>
              <span className="flex-1 truncate">{t.description}</span>
              {t.confidence != null && (
                <span className="text-muted-foreground text-xs">{t.confidence}%</span>
              )}
              <span className="tabular-nums w-24 text-right">{fmt(t.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

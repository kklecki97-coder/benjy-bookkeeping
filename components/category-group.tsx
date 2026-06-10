"use client";

import { useState, useTransition } from "react";
import { X, FolderInput } from "lucide-react";
import {
  approveCategory,
  skipTransaction,
  recategorizeTransaction,
} from "@/app/actions/approve";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CategoryPicker } from "@/components/category-picker";

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
  categories?: string[];
  qboAccountNames?: string[];
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export function CategoryGroup({
  runId,
  category,
  transactions,
  categories = [],
  qboAccountNames = [],
}: CategoryGroupProps) {
  // warn if this category has no matching QuickBooks account (would fail to post)
  const noQboAccount =
    qboAccountNames.length > 0 &&
    !qboAccountNames.includes(category.toLowerCase().trim());
  const [open, setOpen] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState("");
  const [pending, startTransition] = useTransition();

  const total = transactions.reduce((s, t) => s + t.amount, 0);
  const allApproved = transactions.every((t) => t.status === "manually_approved");
  // count low-confidence items so the owner doesn't bulk-approve weak guesses blind
  const lowConf = transactions.filter(
    (t) => t.confidence != null && t.confidence < 70,
  ).length;

  return (
    <div className="rounded-xl glass glass-hover">
      <div className="flex items-center justify-between gap-4 p-4">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-3 text-left"
        >
          <span className="text-muted-foreground text-xs">{open ? "▼" : "▶"}</span>
          <span className="font-medium">{category}</span>
          <Badge variant="secondary">{transactions.length}</Badge>
          {allApproved && <Badge>approved</Badge>}
          {!allApproved && lowConf > 0 && (
            <span
              className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs text-warning"
              title={`${lowConf} transaction(s) below 70% confidence — worth a look before approving`}
            >
              {lowConf} to check
            </span>
          )}
          {noQboAccount && (
            <span
              className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-xs text-destructive"
              title={`No matching QuickBooks account for "${category}". Create it in QBO (or move these) or they won't post.`}
            >
              no QBO account
            </span>
          )}
        </button>
        <span className="text-sm tabular-nums text-muted-foreground">{fmt(total)}</span>
        <Button
          size="sm"
          variant={allApproved ? "outline" : "default"}
          disabled={pending || allApproved}
          onClick={() => {
            if (
              lowConf > 0 &&
              !window.confirm(
                `${lowConf} transaction(s) in "${category}" are below 70% confidence. Approve the whole group anyway?`,
              )
            ) {
              return;
            }
            startTransition(async () => {
              await approveCategory(runId, category);
            });
          }}
        >
          {allApproved ? "Approved" : pending ? "Approving…" : "Approve group"}
        </Button>
      </div>

      {open && (
        <div className="border-t border-border">
          {transactions.map((t) => (
            <div key={t.id} className="border-b border-border/50 last:border-0">
              <div className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <span className="text-muted-foreground w-20 shrink-0 text-xs uppercase">
                  {t.source}
                </span>
                <span className="flex-1 truncate">{t.description}</span>
                {t.confidence != null && (
                  <span className="text-muted-foreground text-xs">{t.confidence}%</span>
                )}
                <span className="tabular-nums w-24 text-right">{fmt(t.amount)}</span>
                <button
                  type="button"
                  aria-label="Move to another category"
                  title="Move to another category"
                  disabled={pending}
                  onClick={() => {
                    setMovingId(movingId === t.id ? null : t.id);
                    setMoveTo("");
                  }}
                  className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <FolderInput className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Remove from this close (won't be posted)"
                  title="Remove — won't be posted to QuickBooks"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await skipTransaction(t.id);
                    })
                  }
                  className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
                >
                  <X className="size-4" />
                </button>
              </div>

              {movingId === t.id && (
                <div className="flex items-end gap-2 px-4 pb-3">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground">
                      Move to category
                    </label>
                    <div className="mt-1">
                      <CategoryPicker
                        value={moveTo}
                        onChange={setMoveTo}
                        categories={categories}
                      />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    disabled={pending || !moveTo}
                    onClick={() =>
                      startTransition(async () => {
                        await recategorizeTransaction(t.id, moveTo);
                        setMovingId(null);
                        setMoveTo("");
                      })
                    }
                  >
                    {pending ? "Moving…" : "Move"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setMovingId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

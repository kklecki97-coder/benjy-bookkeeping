"use client";

import { useState, useTransition } from "react";
import { ChevronDown, FolderInput, Check, X } from "lucide-react";
import {
  approveCategory,
  skipCategory,
  recategorizeCategory,
} from "@/app/actions/approve";
import { ExceptionRow, type ExceptionTx } from "@/components/exception-row";
import { CategoryPicker } from "@/components/category-picker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

/**
 * Exceptions grouped by their suggested category, with bulk actions (approve /
 * move / remove the whole group) so the owner isn't clicking every row. Still
 * expandable to act on individual transactions via ExceptionRow.
 */
export function ExceptionGroup({
  runId,
  category,
  transactions,
  categories,
}: {
  runId: string;
  category: string;
  transactions: ExceptionTx[];
  categories: string[];
}) {
  const [open, setOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const [moveTo, setMoveTo] = useState("");
  const [pending, startTransition] = useTransition();

  const total = transactions.reduce((s, t) => s + t.amount, 0);
  const label = category || "Uncategorized";
  // exceptions are low-confidence by definition — warn before bulk-approving
  const lowConf = transactions.filter(
    (t) => t.confidence != null && t.confidence < 70,
  ).length;

  return (
    <div className="rounded-xl glass">
      <div className="flex items-center justify-between gap-3 p-4">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-3 text-left"
        >
          <ChevronDown
            className={`size-4 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
          />
          <span className="font-medium">{label}</span>
          <Badge variant="secondary">{transactions.length}</Badge>
        </button>
        <span className="text-sm tabular-nums text-muted-foreground">
          {fmt(total)}
        </span>
      </div>

      {/* group bulk actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() => {
            if (
              lowConf > 0 &&
              !window.confirm(
                `${lowConf} of these are below 70% confidence. Approve all ${transactions.length} as "${label}" anyway?`,
              )
            ) {
              return;
            }
            startTransition(async () => {
              await approveCategory(runId, category);
            });
          }}
        >
          <Check className="size-3.5" />
          Approve all as {label}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => setMoving((m) => !m)}
        >
          <FolderInput className="size-3.5" />
          Move all
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            if (
              window.confirm(
                `Remove all ${transactions.length} transactions in "${label}"? They won't be posted.`,
              )
            ) {
              startTransition(async () => {
                await skipCategory(runId, category);
              });
            }
          }}
        >
          <X className="size-3.5" />
          Remove all
        </Button>
      </div>

      {moving && (
        <div className="flex items-end gap-2 border-t border-border px-4 py-3">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">
              Move all {transactions.length} to
            </label>
            <div className="mt-1">
              <CategoryPicker value={moveTo} onChange={setMoveTo} categories={categories} />
            </div>
          </div>
          <Button
            size="sm"
            disabled={pending || !moveTo}
            onClick={() =>
              startTransition(async () => {
                await recategorizeCategory(runId, category, moveTo);
                setMoving(false);
                setMoveTo("");
              })
            }
          >
            {pending ? "Moving…" : "Move all"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setMoving(false)}>
            Cancel
          </Button>
        </div>
      )}

      {/* expand to individual rows */}
      {open && (
        <div className="flex flex-col gap-2 border-t border-border p-3">
          {transactions.map((tx) => (
            <ExceptionRow key={tx.id} tx={tx} categories={categories} />
          ))}
        </div>
      )}
    </div>
  );
}

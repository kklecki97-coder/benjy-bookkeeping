"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import {
  acceptSuggestion,
  editTransaction,
  skipTransaction,
} from "@/app/actions/approve";
import { explainException } from "@/app/actions/explain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CategoryPicker } from "@/components/category-picker";

export interface ExceptionTx {
  id: string;
  source: string;
  description: string;
  amount: number;
  suggested_category: string | null;
  suggested_vendor: string | null;
  confidence: number | null;
  reasoning: string | null;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export function ExceptionRow({
  tx,
  categories = [],
}: {
  tx: ExceptionTx;
  categories?: string[];
}) {
  const [editing, setEditing] = useState(false);
  const [category, setCategory] = useState(tx.suggested_category ?? "");
  const [vendor, setVendor] = useState(tx.suggested_vendor ?? "");
  const [note, setNote] = useState("");
  const [saveAsRule, setSaveAsRule] = useState(true);
  const [pending, startTransition] = useTransition();

  // on-demand "Why was this uncertain?" explanation (lazy — fetched once)
  const [why, setWhy] = useState<string | null>(null);
  const [whyLoading, setWhyLoading] = useState(false);
  const [whyError, setWhyError] = useState<string | null>(null);

  const askWhy = () => {
    if (whyLoading) return;
    if (why) {
      // already have it — toggle closed
      setWhy(null);
      return;
    }
    setWhyError(null);
    setWhyLoading(true);
    void explainException(tx.id)
      .then((res) => {
        if (res.ok && res.explanation) setWhy(res.explanation);
        else setWhyError(res.message ?? "Couldn't explain this one.");
      })
      .finally(() => setWhyLoading(false));
  };

  return (
    <div className="rounded-xl glass glass-hover p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs uppercase">
              {tx.source}
            </Badge>
            {tx.confidence != null && (
              <span className="text-xs text-muted-foreground">
                {tx.confidence}% confidence
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-sm">{tx.description}</p>
          {tx.reasoning && (
            <p className="mt-1 text-xs text-muted-foreground">{tx.reasoning}</p>
          )}
          <p className="mt-1 text-xs">
            Suggested: <span className="font-medium">{tx.suggested_category ?? "—"}</span>
          </p>
        </div>
        <span className="tabular-nums text-sm">{fmt(tx.amount)}</span>
      </div>

      {(whyLoading || why || whyError) && (
        <div className="mt-3 rounded-lg border-l-2 border-primary/40 bg-primary/5 p-3">
          <div className="mb-1 flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" />
            <span className="text-xs font-medium uppercase tracking-wide text-primary">
              Why this needs a look
            </span>
          </div>
          {whyLoading ? (
            <p className="text-xs text-muted-foreground">Thinking it through…</p>
          ) : whyError ? (
            <p className="text-xs text-destructive">{whyError}</p>
          ) : (
            <p className="text-xs leading-relaxed text-foreground/90">{why}</p>
          )}
        </div>
      )}

      {editing ? (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <label
              htmlFor={`cat-${tx.id}`}
              className="text-xs text-muted-foreground"
            >
              Category
            </label>
            <CategoryPicker
              id={`cat-${tx.id}`}
              value={category}
              onChange={setCategory}
              categories={categories}
            />
          </div>
          <Input
            placeholder="Vendor (optional)"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
          />
          <Input
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={saveAsRule}
              onChange={(e) => setSaveAsRule(e.target.checked)}
              className="accent-primary size-4"
            />
            Save as a rule so future “{tx.description.split(/\s+/).slice(0, 2).join(" ")}…” transactions auto-categorize
          </label>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={pending || !category}
              onClick={() =>
                startTransition(async () => {
                  await editTransaction(
                    tx.id,
                    category,
                    vendor || null,
                    note || null,
                    saveAsRule,
                  );
                  setEditing(false);
                })
              }
            >
              Save & approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await acceptSuggestion(tx.id);
              })
            }
          >
            Accept suggestion
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={whyLoading}
            onClick={askWhy}
          >
            <Sparkles className="size-3.5" />
            {whyLoading ? "Thinking…" : why ? "Hide why" : "Why?"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await skipTransaction(tx.id);
              })
            }
          >
            Skip
          </Button>
        </div>
      )}
    </div>
  );
}

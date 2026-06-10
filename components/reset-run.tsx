"use client";

import { useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { resetRun } from "@/app/actions/reset-run";
import { Button } from "@/components/ui/button";

/**
 * "Reset this month" — deletes the current run so the owner can start over,
 * but only before anything is posted to QuickBooks. Once a transaction is
 * posted, the button is disabled and explains why (deleting our run can't undo
 * the QBO entries).
 */
export function ResetRun({
  runId,
  monthYear,
  postedCount,
}: {
  runId: string;
  monthYear: string;
  postedCount: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const locked = postedCount > 0;

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="ghost"
        disabled={pending || locked}
        title={
          locked
            ? `${postedCount} transaction(s) already posted to QuickBooks — can't reset without drifting from your books.`
            : "Delete this run and start the month over (only before posting)."
        }
        onClick={() => {
          if (
            !window.confirm(
              `Reset ${monthYear}? This deletes the current run and everything you've reviewed so far. It can't be undone.`,
            )
          ) {
            return;
          }
          setError(null);
          startTransition(async () => {
            const res = await resetRun(runId);
            if (!res.ok) setError(res.message);
          });
        }}
        className="text-muted-foreground hover:text-destructive"
      >
        <RotateCcw className="size-3.5" />
        {pending ? "Resetting…" : "Reset month"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { X, FolderInput } from "lucide-react";
import {
  approveCategory,
  disapproveCategory,
  skipTransaction,
  recategorizeTransaction,
} from "@/app/actions/approve";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CategoryPicker } from "@/components/category-picker";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { groupApprovalState } from "@/lib/group-state";

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
  // Two separate transitions so a row action (Remove/Move) never makes the
  // group's Approve button show "Approving…" or go disabled — clicking the X
  // used to flip the top button because both shared one pending flag.
  const [groupPending, startGroupTransition] = useTransition();
  const [rowPending, startRowTransition] = useTransition();
  const [disapprovePending, startDisapprove] = useTransition();
  const [approveConfirm, setApproveConfirm] = useState(false);

  const doApprove = () =>
    startGroupTransition(async () => {
      await approveCategory(runId, category);
    });

  const total = transactions.reduce((s, t) => s + t.amount, 0);
  // Derive header state from work REMAINING, not every()-over-a-shrinking-set,
  // so removing a row never silently flips the group to "Approved". See
  // lib/group-state.ts for why.
  const {
    fullyApproved,
    lowConfUnconfirmed,
    buttonLabel,
    buttonDisabled,
    showApprovedBadge,
    canDisapprove,
  } = groupApprovalState(transactions);

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
          {showApprovedBadge && <Badge>approved</Badge>}
          {!showApprovedBadge && lowConfUnconfirmed > 0 && (
            <span
              className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs text-warning"
              title={`${lowConfUnconfirmed} transaction(s) below 70% confidence — worth a look before approving`}
            >
              {lowConfUnconfirmed} to check
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
        {fullyApproved ? (
          // Fully approved: the CTA becomes a single red Disapprove (undo),
          // replacing the dead "Approved" label. Only reachable before posting.
          <Button
            size="sm"
            variant="destructive"
            disabled={disapprovePending}
            title="Undo approval — sends these back to 'to confirm' (only before posting)."
            onClick={() =>
              startDisapprove(async () => {
                await disapproveCategory(runId, category);
              })
            }
          >
            {disapprovePending ? "Undoing…" : "Disapprove"}
          </Button>
        ) : (
          <>
            {/* Mixed group: a quiet Disapprove to undo the already-approved
                rows, sitting next to the main Approve action. */}
            {canDisapprove && (
              <Button
                size="sm"
                variant="ghost"
                disabled={disapprovePending}
                title="Undo the approved ones in this group (only before posting)."
                onClick={() =>
                  startDisapprove(async () => {
                    await disapproveCategory(runId, category);
                  })
                }
                className="text-muted-foreground hover:text-destructive"
              >
                {disapprovePending ? "Undoing…" : "Disapprove"}
              </Button>
            )}
            <Button
              size="sm"
              variant="default"
              disabled={groupPending || buttonDisabled}
              onClick={() => {
                if (lowConfUnconfirmed > 0) setApproveConfirm(true);
                else doApprove();
              }}
            >
              {groupPending ? "Approving…" : buttonLabel}
            </Button>
          </>
        )}
      </div>

      {open && (
        <div className="border-t border-border">
          {/* column headers — aligned with each row's columns below */}
          <div className="flex items-center gap-3 px-4 pb-1.5 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
            <span className="w-20 shrink-0">Source</span>
            <span className="flex-1">Transaction</span>
            <span className="w-12 text-right">Conf.</span>
            <span className="w-24 text-right">Amount</span>
            {/* spacer matching the two action buttons (Move + Remove) */}
            <span className="w-[3.75rem] shrink-0" aria-hidden />
          </div>
          {transactions.map((t) => (
            <div key={t.id} className="border-b border-border/50 last:border-0">
              <div className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <span className="text-muted-foreground w-20 shrink-0 text-xs uppercase">
                  {t.source}
                </span>
                <span className="flex-1">{t.description}</span>
                <span className="text-muted-foreground w-12 text-right text-xs">
                  {t.confidence != null ? `${t.confidence}%` : ""}
                </span>
                <span className="tabular-nums w-24 text-right">{fmt(t.amount)}</span>
                <button
                  type="button"
                  aria-label="Move to another category"
                  title="Move to another category"
                  disabled={rowPending}
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
                  disabled={rowPending}
                  onClick={() =>
                    startRowTransition(async () => {
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
                    disabled={rowPending || !moveTo}
                    onClick={() =>
                      startRowTransition(async () => {
                        await recategorizeTransaction(t.id, moveTo);
                        setMovingId(null);
                        setMoveTo("");
                      })
                    }
                  >
                    {rowPending ? "Moving…" : "Move"}
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

      <ConfirmDialog
        open={approveConfirm}
        onOpenChange={setApproveConfirm}
        title={`Approve "${category}" group?`}
        description={`${lowConfUnconfirmed} transaction(s) here are below 70% confidence — worth a look before approving the whole group.`}
        confirmLabel="Approve group"
        onConfirm={doApprove}
      />
    </div>
  );
}

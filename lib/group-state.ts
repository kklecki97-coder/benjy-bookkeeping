/**
 * Derive an auto-categorized group's header state from its transactions.
 *
 * The old code used `transactions.every(t => t.status === "manually_approved")`,
 * which is a vacuous-truth trap: Remove (skip) shrinks the group, and once the
 * only unconfirmed rows are gone, every() flips to true — so removing a row
 * made the header silently read "Approved" as if the user had clicked Approve.
 *
 * Instead we drive the button off the count of work REMAINING (unconfirmed) and
 * only show the affirmative badge when the group genuinely is non-empty and
 * fully approved. The button label winds a count down to zero rather than
 * toggling a verdict, so a Remove never reads as an approval.
 */
export interface GroupRow {
  status: string;
  confidence?: number | null;
}

export interface GroupApprovalState {
  /** rows still needing the owner's approval (pending or auto_approved) */
  unconfirmed: number;
  /** non-empty AND nothing left unconfirmed */
  fullyApproved: boolean;
  /** unconfirmed rows below the low-confidence threshold (worth a look) */
  lowConfUnconfirmed: number;
  buttonLabel: string;
  buttonDisabled: boolean;
  showApprovedBadge: boolean;
  /** there's an approved-but-not-yet-posted row whose approval can be undone.
   * Posted rows are excluded — undoing approval can't pull them back out of QBO. */
  canDisapprove: boolean;
}

const LOW_CONFIDENCE = 70;

export function groupApprovalState(rows: GroupRow[]): GroupApprovalState {
  const unconfirmedRows = rows.filter((t) => t.status !== "manually_approved");
  const unconfirmed = unconfirmedRows.length;
  const fullyApproved = rows.length > 0 && unconfirmed === 0;
  const lowConfUnconfirmed = unconfirmedRows.filter(
    (t) => t.confidence != null && t.confidence < LOW_CONFIDENCE,
  ).length;
  const canDisapprove = rows.some((t) => t.status === "manually_approved");

  return {
    unconfirmed,
    fullyApproved,
    lowConfUnconfirmed,
    buttonLabel: unconfirmed > 0 ? "Approve group" : "Approved",
    buttonDisabled: unconfirmed === 0,
    showApprovedBadge: fullyApproved,
    canDisapprove,
  };
}

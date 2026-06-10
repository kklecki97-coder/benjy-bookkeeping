import { describe, it, expect } from "vitest";
import { groupApprovalState } from "./group-state";

const s = (...statuses: string[]) => statuses.map((status) => ({ status }));

describe("groupApprovalState", () => {
  it("all auto_approved (nothing approved yet) → Approve group, no badge, enabled", () => {
    const g = groupApprovalState(s("auto_approved", "auto_approved", "auto_approved"));
    expect(g.unconfirmed).toBe(3);
    expect(g.fullyApproved).toBe(false);
    expect(g.buttonLabel).toBe("Approve group");
    expect(g.buttonDisabled).toBe(false);
    expect(g.showApprovedBadge).toBe(false);
  });

  it("mixed group → still 'Approve group', stays enabled until all confirmed", () => {
    const g = groupApprovalState(
      s("manually_approved", "auto_approved", "auto_approved"),
    );
    expect(g.unconfirmed).toBe(2);
    expect(g.fullyApproved).toBe(false);
    expect(g.buttonLabel).toBe("Approve group");
    expect(g.showApprovedBadge).toBe(false);
  });

  it("removing the LAST unconfirmed row → fully approved, badge shows, disabled", () => {
    // after Remove dropped the auto_approved row, only manually_approved remain
    const g = groupApprovalState(s("manually_approved", "manually_approved"));
    expect(g.unconfirmed).toBe(0);
    expect(g.fullyApproved).toBe(true);
    expect(g.buttonLabel).toBe("Approved");
    expect(g.buttonDisabled).toBe(true);
    expect(g.showApprovedBadge).toBe(true);
  });

  it("all manually_approved on load → Approved, disabled, badge (stable across reloads)", () => {
    const g = groupApprovalState(s("manually_approved"));
    expect(g.fullyApproved).toBe(true);
    expect(g.buttonLabel).toBe("Approved");
    expect(g.showApprovedBadge).toBe(true);
  });

  it("empty group never reads as approved (guards the vacuous every() trap)", () => {
    const g = groupApprovalState([]);
    expect(g.unconfirmed).toBe(0);
    expect(g.fullyApproved).toBe(false); // length === 0 guard
    expect(g.showApprovedBadge).toBe(false);
    expect(g.buttonDisabled).toBe(true); // nothing to approve
    expect(g.canDisapprove).toBe(false);
  });

  it("canDisapprove is true when there is an un-posted approved row to undo", () => {
    const g = groupApprovalState(s("manually_approved", "auto_approved"));
    expect(g.canDisapprove).toBe(true);
  });

  it("canDisapprove is false when nothing is approved yet", () => {
    const g = groupApprovalState(s("auto_approved", "auto_approved"));
    expect(g.canDisapprove).toBe(false);
  });

  it("canDisapprove is false when the only approved rows are already posted", () => {
    // posted rows are in QuickBooks — disapprove must not offer to touch them
    const g = groupApprovalState([
      { status: "posted" },
      { status: "posted" },
    ]);
    expect(g.canDisapprove).toBe(false);
  });

  it("canDisapprove ignores posted rows but stays true for un-posted approved ones", () => {
    const g = groupApprovalState([
      { status: "posted" },
      { status: "manually_approved" },
    ]);
    expect(g.canDisapprove).toBe(true);
  });

  it("pending rows also count as unconfirmed (defensive — auto tab is auto/manual, but be safe)", () => {
    const g = groupApprovalState(s("pending", "manually_approved"));
    expect(g.unconfirmed).toBe(1);
    expect(g.buttonLabel).toBe("Approve group");
    expect(g.fullyApproved).toBe(false);
  });

  it("reports low-confidence count independently of approval", () => {
    const rows = [
      { status: "auto_approved", confidence: 62 },
      { status: "auto_approved", confidence: 95 },
      { status: "manually_approved", confidence: 50 }, // approved already — not "to check"
    ];
    const g = groupApprovalState(rows);
    // only unconfirmed + low-confidence count toward "to check"
    expect(g.lowConfUnconfirmed).toBe(1);
  });
});

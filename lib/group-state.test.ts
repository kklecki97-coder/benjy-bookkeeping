import { describe, it, expect } from "vitest";
import { groupApprovalState } from "./group-state";

const s = (...statuses: string[]) => statuses.map((status) => ({ status }));

describe("groupApprovalState", () => {
  it("all auto_approved (nothing approved yet) → Approve N, no badge, enabled", () => {
    const g = groupApprovalState(s("auto_approved", "auto_approved", "auto_approved"));
    expect(g.unconfirmed).toBe(3);
    expect(g.fullyApproved).toBe(false);
    expect(g.buttonLabel).toBe("Approve 3");
    expect(g.buttonDisabled).toBe(false);
    expect(g.showApprovedBadge).toBe(false);
  });

  it("mixed group → button counts only the unconfirmed ones", () => {
    const g = groupApprovalState(
      s("manually_approved", "auto_approved", "auto_approved"),
    );
    expect(g.unconfirmed).toBe(2);
    expect(g.fullyApproved).toBe(false);
    expect(g.buttonLabel).toBe("Approve 2");
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
  });

  it("pending rows also count as unconfirmed (defensive — auto tab is auto/manual, but be safe)", () => {
    const g = groupApprovalState(s("pending", "manually_approved"));
    expect(g.unconfirmed).toBe(1);
    expect(g.buttonLabel).toBe("Approve 1");
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

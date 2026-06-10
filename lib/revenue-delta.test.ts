import { describe, it, expect } from "vitest";
import { revenueDelta } from "./revenue-delta";

describe("revenueDelta", () => {
  it("computes a positive percentage change", () => {
    const d = revenueDelta(110, 100);
    expect(d).not.toBeNull();
    expect(d!.direction).toBe("up");
    expect(d!.pct).toBe(10);
  });

  it("computes a negative percentage change", () => {
    const d = revenueDelta(80, 100);
    expect(d!.direction).toBe("down");
    expect(d!.pct).toBe(20);
  });

  it("rounds to a whole percent", () => {
    expect(revenueDelta(133, 100)!.pct).toBe(33);
    expect(revenueDelta(126.4, 100)!.pct).toBe(26);
  });

  it("treats no meaningful change as flat", () => {
    const d = revenueDelta(100, 100);
    expect(d!.direction).toBe("flat");
    expect(d!.pct).toBe(0);
  });

  it("returns null when there is no previous value to compare", () => {
    expect(revenueDelta(100, undefined)).toBeNull();
    expect(revenueDelta(100, null)).toBeNull();
  });

  it("returns 'new' when previous was zero but now there's revenue", () => {
    // can't divide by zero — surface it as a brand-new channel, not 'up 100%'
    const d = revenueDelta(500, 0);
    expect(d!.direction).toBe("new");
    expect(d!.pct).toBeNull();
  });
});

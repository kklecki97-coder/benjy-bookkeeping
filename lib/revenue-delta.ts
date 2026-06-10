/**
 * Month-over-month change for one revenue channel. Returns null when there's
 * no previous value to compare (e.g. the first month, or a channel that didn't
 * exist last month). "new" flags a channel that had zero last month and revenue
 * now — surfacing it as new rather than a meaningless "up 100%".
 */
export interface RevenueDelta {
  direction: "up" | "down" | "flat" | "new";
  pct: number | null;
}

const FLAT_THRESHOLD = 0.5; // sub-half-percent reads as flat

export function revenueDelta(
  current: number,
  previous: number | null | undefined,
): RevenueDelta | null {
  if (previous == null) return null;
  if (previous === 0) {
    return current > 0 ? { direction: "new", pct: null } : null;
  }

  const changePct = ((current - previous) / previous) * 100;
  if (Math.abs(changePct) < FLAT_THRESHOLD) {
    return { direction: "flat", pct: 0 };
  }
  return {
    direction: changePct > 0 ? "up" : "down",
    pct: Math.round(Math.abs(changePct)),
  };
}

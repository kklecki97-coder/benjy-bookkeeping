import { describe, it, expect } from "vitest";
import { mapWithConcurrency } from "./concurrency";

describe("mapWithConcurrency", () => {
  it("returns results in input order", async () => {
    const out = await mapWithConcurrency([1, 2, 3, 4], 2, async (n) => n * 10);
    expect(out).toEqual([10, 20, 30, 40]);
  });

  it("never runs more than `limit` tasks at once", async () => {
    let active = 0;
    let maxActive = 0;
    const work = async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return active;
    };
    await mapWithConcurrency([0, 1, 2, 3, 4, 5, 6], 2, work);
    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it("handles an empty list", async () => {
    expect(await mapWithConcurrency([], 3, async (x) => x)).toEqual([]);
  });

  it("processes every item exactly once", async () => {
    const seen: number[] = [];
    await mapWithConcurrency([5, 6, 7], 1, async (n) => {
      seen.push(n);
      return n;
    });
    expect(seen.sort()).toEqual([5, 6, 7]);
  });

  it("propagates an error from any task", async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error("boom");
        return n;
      }),
    ).rejects.toThrow("boom");
  });
});

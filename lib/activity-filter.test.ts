import { describe, it, expect } from "vitest";
import { activityBucket, type ActivityTab } from "./activity-filter";

const bucket = (action: string): ActivityTab => activityBucket(action);

describe("activityBucket", () => {
  it("routes posting actions to 'posted'", () => {
    expect(bucket("posted")).toBe("posted");
    expect(bucket("post_failed")).toBe("posted");
  });

  it("routes every skip/remove flavor to 'skipped'", () => {
    expect(bucket("skipped")).toBe("skipped");
    expect(bucket("skipped_revenue_mirror")).toBe("skipped");
    expect(bucket("skipped_already_posted")).toBe("skipped");
    expect(bucket("run_reset")).toBe("skipped");
  });

  it("leaves other actions as 'other' (only visible under All)", () => {
    expect(bucket("approved")).toBe("other");
    expect(bucket("approved_all_auto")).toBe("other");
    expect(bucket("edited")).toBe("other");
    expect(bucket("rule_created")).toBe("other");
    expect(bucket("run_completed")).toBe("other");
    expect(bucket("anything_new")).toBe("other");
  });
});

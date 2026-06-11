/**
 * Which Activity Log tab an audit action belongs to. "posted" = everything that
 * reached (or tried to reach) QuickBooks; "skipped" = everything removed from
 * the close or auto-skipped; "other" = approvals/edits/rules, visible only under
 * the All tab. Keeps the log readable instead of one undifferentiated stream.
 */
export type ActivityTab = "posted" | "skipped" | "other";

const POSTED = new Set(["posted", "post_failed"]);
const SKIPPED = new Set([
  "skipped",
  "skipped_revenue_mirror",
  "skipped_already_posted",
  "run_reset",
]);

export function activityBucket(action: string): ActivityTab {
  if (POSTED.has(action)) return "posted";
  if (SKIPPED.has(action)) return "skipped";
  return "other";
}

/**
 * A run's per-source ingestion result, stored on monthly_runs.source_summary.
 * Each source either imported a count, or recorded an error (and count 0).
 */
export type SourceSummary = Record<
  string,
  { count: number; error?: string }
>;

export interface FailedSource {
  source: string;
  error: string;
}

const SOURCE_LABELS: Record<string, string> = {
  hana: "Hana POS",
  honeybook: "HoneyBook",
  shopify: "Shopify",
  amex: "AmEx",
  boa_checking: "BoA Checking",
  boa_credit: "BankAmericard",
};

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

/**
 * Pull out the sources that errored during ingestion. A run that finished with
 * a failed source LOOKS complete on the dashboard but is silently missing a
 * whole channel — surface these so the owner doesn't post an incomplete month.
 */
export function failedSources(summary: SourceSummary | null | undefined): FailedSource[] {
  if (!summary) return [];
  return Object.entries(summary)
    .filter(([, v]) => v && typeof v.error === "string" && v.error.length > 0)
    .map(([source, v]) => ({ source, error: v.error as string }));
}

/**
 * Revenue is income from sales channels — NOT every positive amount.
 * Bank deposits and card charges have positive amounts but are not revenue.
 * Only these categories count toward "revenue" figures.
 */
export const REVENUE_CATEGORIES = new Set([
  "Hana Sales",
  "Honeybook Sales",
  "Shopify Sales",
  "Retail Sales",
]);

export function isRevenueCategory(category: string | null | undefined): boolean {
  return !!category && REVENUE_CATEGORIES.has(category);
}

/**
 * For Hana specifically: the parser emits several overlapping summary lines
 * (Net Taxable, Total Product, Total Sales, Net Total, Gross...). Only ONE
 * represents actual revenue. Net Total Sales is the canonical figure.
 */
export function isCanonicalHanaRevenueLine(description: string): boolean {
  return /Net Total Sales/i.test(description);
}

/**
 * Count revenue from the channel's OWN source file only — never from bank
 * deposits, which mirror the same sales and would double-count.
 * Maps a revenue category to the source it should be counted from.
 */
const REVENUE_SOURCE: Record<string, string> = {
  "Hana Sales": "hana",
  "Honeybook Sales": "honeybook",
  "Shopify Sales": "shopify",
  "Retail Sales": "hana",
};

/**
 * A "revenue mirror": a transaction categorized as a sales channel but coming
 * from a DIFFERENT source than that channel's own report — i.e. a bank deposit
 * reflecting money already booked as revenue from the channel's own line.
 *
 * The display layer already drops these from revenue totals (via countsAsRevenue)
 * so the sale isn't counted twice. The SAME guard must apply at QBO post time:
 * posting both the channel sales line AND its bank-deposit mirror would book the
 * income twice in the real ledger.
 */
export function isRevenueMirror(tx: {
  suggested_category?: string | null;
  approved_category?: string | null;
  source: string;
}): boolean {
  const category = tx.approved_category ?? tx.suggested_category ?? null;
  if (!isRevenueCategory(category)) return false;
  return REVENUE_SOURCE[category!] !== tx.source;
}

/** True only when this transaction should contribute to revenue totals. */
export function countsAsRevenue(tx: {
  suggested_category?: string | null;
  approved_category?: string | null;
  source: string;
  description?: string | null;
  status?: string | null;
}): boolean {
  // A sale the owner removed in review (skipped) is out of the close, so it
  // must not count toward revenue — otherwise the totals contradict what the
  // review screen shows and what posts to QuickBooks.
  if (tx.status === "skipped") return false;
  const category = tx.approved_category ?? tx.suggested_category ?? null;
  if (!isRevenueCategory(category)) return false;
  // must come from the channel's own source, not a bank deposit mirror
  if (isRevenueMirror(tx)) return false;
  // Hana emits overlapping summary lines — only the canonical one
  if (category === "Hana Sales") {
    return isCanonicalHanaRevenueLine(tx.description ?? "");
  }
  return true;
}

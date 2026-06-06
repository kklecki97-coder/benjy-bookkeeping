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

/** True only when this transaction should contribute to revenue totals. */
export function countsAsRevenue(tx: {
  suggested_category?: string | null;
  approved_category?: string | null;
  source: string;
  description?: string | null;
}): boolean {
  const category = tx.approved_category ?? tx.suggested_category ?? null;
  if (!isRevenueCategory(category)) return false;
  // must come from the channel's own source, not a bank deposit mirror
  if (REVENUE_SOURCE[category!] !== tx.source) return false;
  // Hana emits overlapping summary lines — only the canonical one
  if (category === "Hana Sales") {
    return isCanonicalHanaRevenueLine(tx.description ?? "");
  }
  return true;
}

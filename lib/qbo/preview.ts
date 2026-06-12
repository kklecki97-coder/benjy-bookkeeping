import { categoryResolvable } from "./routing";

export interface CategoryCount {
  category: string;
  count: number;
}

export interface PostabilityResult {
  ok: boolean; // true when every category has a matching QBO account
  missing: CategoryCount[]; // categories with no matching account (+ tx count)
  matchedCount: number; // # of transactions whose category maps to an account
  missingCount: number; // # of transactions that would fail to post
}

/**
 * Pure check: given the categories about to be posted (with transaction
 * counts) and the set of QBO account names (lowercased), determine which
 * categories won't post. A category is resolvable if it matches an account name
 * directly OR via a safe alias (e.g. "Software subscriptions" -> "Software &
 * apps"); owner-decision categories (Owner draw, Seller Note Split, …) are
 * deliberately treated as NOT resolvable so they surface as a warning before
 * posting. Mirrors what postTransactions actually does. No QBO/DB access.
 */
export function analyzePostability(
  categories: CategoryCount[],
  accountNames: Set<string>,
): PostabilityResult {
  const missing: CategoryCount[] = [];
  let matchedCount = 0;
  let missingCount = 0;

  for (const { category, count } of categories) {
    if (categoryResolvable(category, accountNames)) {
      matchedCount += count;
    } else {
      missing.push({ category, count });
      missingCount += count;
    }
  }

  return { ok: missing.length === 0, missing, matchedCount, missingCount };
}

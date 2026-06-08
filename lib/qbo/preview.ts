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
 * categories have no matching account. Account matching is case-insensitive,
 * mirroring accountMap(). No QBO/DB access — easy to unit test.
 */
export function analyzePostability(
  categories: CategoryCount[],
  accountNames: Set<string>,
): PostabilityResult {
  const missing: CategoryCount[] = [];
  let matchedCount = 0;
  let missingCount = 0;

  for (const { category, count } of categories) {
    const has = accountNames.has(category.toLowerCase().trim());
    if (has) {
      matchedCount += count;
    } else {
      missing.push({ category, count });
      missingCount += count;
    }
  }

  return { ok: missing.length === 0, missing, matchedCount, missingCount };
}

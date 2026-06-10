/**
 * Map over items running at most `limit` tasks concurrently, preserving input
 * order in the result. A bounded alternative to Promise.all(items.map(...)),
 * which fires everything at once — that overwhelmed the Anthropic per-minute
 * rate limit when a run had many transaction batches.
 *
 * If any task rejects, the whole call rejects (like Promise.all).
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await task(items[i], i);
    }
  }

  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

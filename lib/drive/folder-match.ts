/**
 * Pure helpers for locating the right monthly subfolder inside a shared Drive
 * "mother" folder organized as: mother → YEAR (2026) → MONTH (June).
 *
 * The owner names folders by hand, so matching is forgiving: a year folder is
 * "2026"; a month folder can be "June", "Jun", "06", "6", "2026-06", or
 * "June 2026". Matching is case-insensitive and ignores surrounding spaces.
 * No network here — easy to unit test.
 */

const MONTHS = [
  ["january", "jan"],
  ["february", "feb"],
  ["march", "mar"],
  ["april", "apr"],
  ["may", "may"],
  ["june", "jun"],
  ["july", "jul"],
  ["august", "aug"],
  ["september", "sep", "sept"],
  ["october", "oct"],
  ["november", "nov"],
  ["december", "dec"],
] as const;

const norm = (s: string) => s.toLowerCase().trim();

/** Parse "YYYY-MM" into { year: "2026", month: 6 }. */
export function parseMonthYear(monthYear: string): { year: string; month: number } | null {
  const m = monthYear.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (!m) return null;
  return { year: m[1], month: Number(m[2]) };
}

/** Does a folder name represent the given year (e.g. "2026", "2026 statements")? */
export function matchesYear(folderName: string, year: string): boolean {
  return new RegExp(`\\b${year}\\b`).test(norm(folderName));
}

/**
 * Does a folder name represent the given 1-based month?
 * Accepts the month name (full/abbrev), the zero-padded or plain number, or a
 * "YYYY-MM" form. Year, if present in the name, must not contradict.
 */
export function matchesMonth(folderName: string, month: number, year: string): boolean {
  const n = norm(folderName);
  const names = MONTHS[month - 1];
  const mm = String(month).padStart(2, "0");

  // explicit "YYYY-MM"
  if (n.includes(`${year}-${mm}`)) return true;

  // a month-name token (word-boundary so "mar" doesn't hit "march" only loosely,
  // and "may" doesn't match inside other words)
  const nameHit = names.some((nm) => new RegExp(`\\b${nm}\\b`).test(n));
  if (nameHit) {
    // if the name also carries a 4-digit year, it must be the right one
    const yr = n.match(/\b(20\d{2})\b/);
    return !yr || yr[1] === year;
  }

  // a bare numeric month token: "06", "6" (but NOT a 4-digit year)
  const numHit = new RegExp(`\\b0?${month}\\b`).test(n) && !/\b20\d{2}\b/.test(n);
  return numHit;
}

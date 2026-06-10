import type { NormalizedTransaction } from "@/types/transaction";
import { type ParseInput, type SourceConnector, shortHash } from "./types";
import { extractWords, groupRowsByY, findAmountInRow } from "./pdf-utils";

const DATE_RE = /^\d{2}\/\d{2}$/;

type CreditSection = "none" | "credits" | "charges";

/** Switch section only on a BARE header (no amount), like boa-checking does —
 * the page-1 summary lines carry a trailing amount and must not switch. */
function detectCreditSection(rowText: string): CreditSection | null {
  if (/^Payments and Other Credits\s*$/i.test(rowText.trim())) return "credits";
  if (/^Purchases and Other Charges\s*$/i.test(rowText.trim())) return "charges";
  return null;
}

/** Convert "MM/DD" + statement year context into ISO. */
function toIso(mmdd: string, year: number): string {
  const [mm, dd] = mmdd.split("/");
  return `${year}-${mm}-${dd}`;
}

export const boaCreditConnector: SourceConnector = {
  source: "boa_credit",
  async parse(input: ParseInput): Promise<NormalizedTransaction[]> {
    const src =
      input.kind === "file"
        ? input.path
        : input.kind === "buffer"
          ? input.buffer
          : (() => {
              throw new Error("BoA Credit connector requires a file/buffer");
            })();

    const words = await extractWords(src);
    const rows = groupRowsByY(words, 3);

    // Statement spans e.g. "December 15, 2025 - January 14, 2026". Capture BOTH
    // endpoint years so a Dec→Jan rollover stamps January rows with the later
    // year, not the first year seen. Closing month decides the split.
    const headerText = rows
      .slice(0, 12)
      .map((r) => r.map((w) => w.text).join(" "))
      .join(" ");
    const span = headerText.match(
      /([A-Z][a-z]+)\s+\d{1,2},\s+(20\d{2})\s*-\s*([A-Z][a-z]+)\s+\d{1,2},\s+(20\d{2})/,
    );
    const startYear = span ? parseInt(span[2], 10) : null;
    const endYear = span ? parseInt(span[4], 10) : null;
    // Closing month = the statement period's END month (1-12), if we have it.
    const MONTHS = "january february march april may june july august september october november december".split(" ");
    const closingMonth = span ? MONTHS.indexOf(span[3].toLowerCase()) + 1 : null;
    // Fallback single year: first 4-digit year in the header.
    const fallbackYear = (headerText.match(/\b(20\d{2})\b/) || [])[1];

    const yearForMonth = (mm: number): number => {
      if (startYear != null && endYear != null && startYear !== endYear && closingMonth != null) {
        // months after the closing month belong to the earlier (pre-rollover) year
        return mm > closingMonth ? startYear : endYear;
      }
      return endYear ?? startYear ?? (fallbackYear ? parseInt(fallbackYear, 10) : 2000);
    };

    const txs: NormalizedTransaction[] = [];
    let section: CreditSection = "none";
    let seq = 0;
    for (const row of rows) {
      const rowText = row.map((w) => w.text).join(" ");

      // Switch section on a bare header (no leading date / amount).
      const detected = detectCreditSection(rowText);
      if (detected !== null && !DATE_RE.test(row[0]?.text ?? "")) {
        section = detected;
        continue;
      }

      if (row.length < 3) continue;
      const first = row[0].text;
      if (!DATE_RE.test(first)) continue;
      if (section === "none") continue; // skip until we're inside a real section

      const amount = findAmountInRow(row);
      if (amount === null) continue;

      // Description = everything between the two leading dates and the amount.
      const desc = rowText
        .replace(/^\d{2}\/\d{2}\s+\d{2}\/\d{2}\s*/, "")
        .replace(/\s*-?\s*[\d,]+\.\d{2}\s*$/, "")
        .trim();

      // Sign by SECTION, not by a "PAYMENT" keyword — so a merchant refund in
      // the credits section is negative even without the word "payment".
      const mm = parseInt(first.slice(0, 2), 10);
      const year = yearForMonth(mm);
      const signed = section === "credits" ? -Math.abs(amount) : Math.abs(amount);

      txs.push({
        source: "boa_credit",
        externalId: `boacc_${toIso(first, year)}_${Math.abs(amount)}_${shortHash(desc)}_${seq++}`,
        date: toIso(first, year),
        amount: signed,
        description: desc,
        rawData: { rowText, section, page: row[0].page },
      });
    }
    return txs;
  },
};

import type { NormalizedTransaction } from "@/types/transaction";
import { type ParseInput, type SourceConnector, shortHash } from "./types";
import { extractWords, groupRowsByY, findAmountInRow } from "./pdf-utils";

const DATE_RE = /^\d{2}\/\d{2}$/;

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

    // Statement spans e.g. "March 14, 2026 - April 13, 2026" — derive year.
    const headerText = rows
      .slice(0, 10)
      .map((r) => r.map((w) => w.text).join(" "))
      .join(" ");
    const yearMatch = headerText.match(/\b(20\d{2})\b/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();

    const txs: NormalizedTransaction[] = [];
    for (const row of rows) {
      if (row.length < 3) continue;
      const first = row[0].text;
      if (!DATE_RE.test(first)) continue;

      const amount = findAmountInRow(row);
      if (amount === null) continue;

      const rowText = row.map((w) => w.text).join(" ");
      // Description = everything between the two leading dates and the amount.
      // Strip leading "MM/DD MM/DD" and trailing amount token.
      const desc = rowText
        .replace(/^\d{2}\/\d{2}\s+\d{2}\/\d{2}\s*/, "")
        .replace(/\s*-?\s*[\d,]+\.\d{2}\s*$/, "")
        .trim();

      // Payments (credits) are negative; everything else positive charge.
      const isPayment = /PAYMENT/i.test(rowText);
      const signed = isPayment ? -Math.abs(amount) : Math.abs(amount);

      txs.push({
        source: "boa_credit",
        externalId: `boacc_${toIso(first, year)}_${Math.abs(amount)}_${shortHash(desc)}`,
        date: toIso(first, year),
        amount: signed,
        description: desc,
        rawData: { rowText, page: row[0].page },
      });
    }
    return txs;
  },
};

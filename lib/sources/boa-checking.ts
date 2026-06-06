import type { NormalizedTransaction } from "@/types/transaction";
import { type ParseInput, type SourceConnector, shortHash } from "./types";
import { extractWords, groupRowsByY, findAmountInRow } from "./pdf-utils";

const DATE_RE = /^\d{2}\/\d{2}\/\d{2}$/;

type Section = "deposits" | "withdrawals" | "checks" | "fees" | "none";

function toIso(mmddyy: string): string {
  const [mm, dd, yy] = mmddyy.split("/");
  return `20${yy}-${mm}-${dd}`;
}

function detectSection(rowText: string): Section | null {
  if (/^Deposits and other credits/i.test(rowText)) return "deposits";
  if (/^Withdrawals and other debits/i.test(rowText)) return "withdrawals";
  if (/^Checks\b/i.test(rowText)) return "checks";
  if (/^Service fees/i.test(rowText)) return "fees";
  if (/^Total (deposits|withdrawals)/i.test(rowText)) return "none";
  return null;
}

export const boaCheckingConnector: SourceConnector = {
  source: "boa_checking",
  async parse(input: ParseInput): Promise<NormalizedTransaction[]> {
    const src =
      input.kind === "file"
        ? input.path
        : input.kind === "buffer"
          ? input.buffer
          : (() => {
              throw new Error("BoA Checking connector requires a file/buffer");
            })();

    const words = await extractWords(src);
    const rows = groupRowsByY(words, 3);

    const txs: NormalizedTransaction[] = [];
    let section: Section = "none";

    for (const row of rows) {
      const rowText = row.map((w) => w.text).join(" ");

      // The section-summary line (e.g. "Deposits and other credits 83,216.40")
      // appears on page 1; the real per-page section header is the bare title.
      const detected = detectSection(rowText);
      if (detected !== null) {
        // Only switch into a data section on the bare header (no leading date).
        section = detected;
        continue;
      }

      if (section === "none") continue;
      if (!DATE_RE.test(row[0]?.text ?? "")) continue;

      const amount = findAmountInRow(row);
      if (amount === null) continue;

      const date = toIso(row[0].text);
      const desc = rowText
        .replace(/^\d{2}\/\d{2}\/\d{2}\s*/, "")
        .replace(/\s*-?[\d,]+\.\d{2}\s*$/, "")
        .trim();

      const sign = section === "deposits" ? 1 : -1;
      const signed = sign * Math.abs(amount);

      txs.push({
        source: "boa_checking",
        externalId: `boachk_${date}_${Math.abs(amount)}_${shortHash(desc)}`,
        date,
        amount: signed,
        description: desc,
        rawData: { rowText, section, page: row[0].page },
      });
    }
    return txs;
  },
};

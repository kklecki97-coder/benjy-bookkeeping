import type { NormalizedTransaction } from "@/types/transaction";
import { type ParseInput, type SourceConnector, shortHash } from "./types";
import { extractWords, groupRowsByY, findAmountInRow } from "./pdf-utils";

const DATE_RE = /^\d{2}\/\d{2}\/\d{2}$/;
const CARD_RE = /Card Ending (7-\d{5})/;

function toIso(mmddyy: string): string {
  const [mm, dd, yy] = mmddyy.split("/");
  return `20${yy}-${mm}-${dd}`;
}

export const amexConnector: SourceConnector = {
  source: "amex",
  async parse(input: ParseInput): Promise<NormalizedTransaction[]> {
    const src =
      input.kind === "file"
        ? input.path
        : input.kind === "buffer"
          ? input.buffer
          : (() => {
              throw new Error("AmEx connector requires a file/buffer");
            })();

    const words = await extractWords(src);
    const rows = groupRowsByY(words, 3);

    const txs: NormalizedTransaction[] = [];
    let currentCard = "unknown";
    let inDetail = false;
    let seq = 0; // disambiguates identical charges on the same day

    for (const row of rows) {
      const rowText = row.map((w) => w.text).join(" ");

      const cardMatch = rowText.match(CARD_RE);
      if (cardMatch) {
        currentCard = cardMatch[1];
        inDetail = true;
        continue;
      }

      // Charge rows: start with a date and have an amount. Skip payment lines.
      if (!DATE_RE.test(row[0]?.text ?? "")) continue;
      if (!inDetail) continue;
      if (/PAYMENT|AUTOPAY|THANK YOU/i.test(rowText)) continue;
      // Interest and fees are not purchases — excluded from "new charges".
      if (/Interest Charge|Pay Over Time.*Fee|^Fees?\b/i.test(rowText)) continue;

      const amount = findAmountInRow(row);
      if (amount === null || amount <= 0) continue;

      const date = toIso(row[0].text);
      // Description: strip leading date and trailing "$amount ⧫" / state markers.
      const desc = rowText
        .replace(/^\d{2}\/\d{2}\/\d{2}\s*/, "")
        .replace(/\s*\$?[\d,]+\.\d{2}\s*[⧫*]?\s*$/, "")
        .trim();

      txs.push({
        source: "amex",
        externalId: `amex_${currentCard}_${date}_${amount}_${shortHash(desc)}_${seq++}`,
        date,
        amount: Math.abs(amount),
        description: desc,
        rawData: { rowText, card: currentCard, page: row[0].page },
      });
    }
    return txs;
  },
};

import * as XLSX from "xlsx";
import type { NormalizedTransaction } from "@/types/transaction";
import { type ParseInput, type SourceConnector, shortHash } from "./types";
import { extractWords, groupRowsByY, parseAmount } from "./pdf-utils";

/**
 * Summary lines we care about from the Daily Posting Summary (left column).
 * These are the figures that matter for bookkeeping (net sales, tax).
 */
const SUMMARY_LABELS = [
  "Net Taxable Sales",
  "Net Non Taxable Sales",
  "Total Product Sales",
  "Total Delivery Fee",
  "Total Sales",
  "Net Total Sales",
  "SalesTax Charged",
  "Total Gross Sales",
];

function matchLabel(text: string): string | null {
  if (!text) return null;
  const normalized = String(text).replace(/\s+/g, " ").trim();
  for (const label of SUMMARY_LABELS) {
    if (normalized.toLowerCase().startsWith(label.toLowerCase())) return label;
  }
  return null;
}

function buildTx(
  label: string,
  amount: number,
  monthYear: string,
): NormalizedTransaction {
  return {
    source: "hana",
    externalId: `hana_${monthYear}_${shortHash(label)}`,
    date: monthYear ? `${monthYear}-01` : "",
    amount,
    description: `Hana — ${label}`,
    rawData: { label, monthYear },
  };
}

function parseXlsx(path: string | Buffer): NormalizedTransaction[] {
  const wb =
    typeof path === "string"
      ? XLSX.readFile(path)
      : XLSX.read(path, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false });

  // Derive month-year from the "Order dates:" cell (e.g. "4/1/2026 - 4/30/2026").
  let monthYear = "";
  for (const r of rows) {
    const joined = (r as unknown[]).map((c) => String(c ?? "")).join(" ");
    const m = joined.match(/(\d{1,2})\/\d{1,2}\/(\d{4})/);
    if (m) {
      monthYear = `${m[2]}-${String(m[1]).padStart(2, "0")}`;
      break;
    }
  }

  const txs: NormalizedTransaction[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (!Array.isArray(r)) continue;
    const cells = r.map((c) => String(c ?? ""));
    const label = matchLabel(cells[0] ?? "");
    if (!label || seen.has(label)) continue;
    // amount is the first currency-looking cell after the label
    let amount: number | null = null;
    for (const c of cells.slice(1)) {
      const a = parseAmount(c);
      if (a !== null) {
        amount = a;
        break;
      }
    }
    if (amount === null) continue;
    seen.add(label);
    txs.push(buildTx(label, amount, monthYear));
  }
  return txs;
}

async function parsePdf(path: string | Buffer): Promise<NormalizedTransaction[]> {
  const words = await extractWords(path);
  const rows = groupRowsByY(words, 3);

  let monthYear = "";
  for (const r of rows) {
    const joined = r.map((w) => w.text).join(" ");
    const m = joined.match(/(\d{1,2})\/\d{1,2}\/(\d{4})/);
    if (m) {
      monthYear = `${m[2]}-${String(m[1]).padStart(2, "0")}`;
      break;
    }
  }

  const txs: NormalizedTransaction[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const text = r.map((w) => w.text).join(" ");
    const label = matchLabel(text);
    if (!label || seen.has(label)) continue;
    let amount: number | null = null;
    for (const w of r) {
      const a = parseAmount(w.text);
      if (a !== null) {
        amount = a;
        break;
      }
    }
    if (amount === null) continue;
    seen.add(label);
    txs.push(buildTx(label, amount, monthYear));
  }
  return txs;
}

export const hanaConnector: SourceConnector = {
  source: "hana",
  async parse(input: ParseInput): Promise<NormalizedTransaction[]> {
    if (input.kind === "api") {
      throw new Error("Hana connector requires a file/buffer");
    }
    const isPdf =
      input.kind === "file"
        ? input.path.toLowerCase().endsWith(".pdf")
        : input.mime === "application/pdf" ||
          input.filename.toLowerCase().endsWith(".pdf");

    const src = input.kind === "file" ? input.path : input.buffer;
    return isPdf ? parsePdf(src) : parseXlsx(src);
  },
};

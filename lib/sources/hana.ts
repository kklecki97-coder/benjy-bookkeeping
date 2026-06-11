import ExcelJS from "exceljs";
import type { NormalizedTransaction } from "@/types/transaction";
import { type ParseInput, type SourceConnector, shortHash } from "./types";
import { extractWords, groupRowsByY, parseAmount } from "./pdf-utils";

/**
 * Summary lines we care about from the Daily Posting Summary (left column).
 * These are the figures that matter for bookkeeping (net sales, tax).
 */
const SUMMARY_LABELS = [
  // Only the two lines that are real accounting postings. Hana's report has
  // several overlapping summary views (Gross, Taxable, Total Product, etc.) —
  // emitting all of them creates duplicate/confusing review items. Net Total
  // Sales is the revenue figure; Sales Tax Charged is the tax liability.
  "Net Total Sales",
  "SalesTax Charged",
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

/** Read the first worksheet into a 2D array of stringified cells (like
 * sheet_to_json with header:1). Uses exceljs — the npm `xlsx` package has
 * unpatched prototype-pollution + ReDoS CVEs. */
async function readXlsxRows(path: string | Buffer): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  if (typeof path === "string") {
    await wb.xlsx.readFile(path);
  } else {
    // exceljs wants an ArrayBuffer-ish input
    await wb.xlsx.load(path as unknown as ArrayBuffer);
  }
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    const cells: string[] = [];
    // row.values is 1-indexed (index 0 is unused); flatten to a 0-based array
    const vals = row.values as unknown[];
    for (let i = 1; i < vals.length; i++) {
      const v = vals[i];
      // exceljs may return rich-text/formula objects — coerce to plain text
      if (v != null && typeof v === "object" && "result" in (v as object)) {
        cells.push(String((v as { result: unknown }).result ?? ""));
      } else if (v != null && typeof v === "object" && "text" in (v as object)) {
        cells.push(String((v as { text: unknown }).text ?? ""));
      } else {
        cells.push(String(v ?? ""));
      }
    }
    rows.push(cells);
  });
  return rows;
}

async function parseXlsx(path: string | Buffer): Promise<NormalizedTransaction[]> {
  const rows = await readXlsxRows(path);

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

import { readFileSync } from "node:fs";

export interface Word {
  text: string;
  x: number; // left edge
  y: number; // baseline, higher = nearer top of page
  page: number;
}

/**
 * Extract every text token from a PDF with its x/y position and page.
 * Uses pdfjs-dist so amounts can be paired with descriptions by row (y),
 * which naive line-based text extraction gets wrong on bank statements.
 */
export async function extractWords(input: string | Buffer): Promise<Word[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const bytes =
    typeof input === "string"
      ? new Uint8Array(readFileSync(input))
      : new Uint8Array(input);
  const doc = await pdfjs.getDocument({
    data: bytes,
    useSystemFonts: true,
  }).promise;

  const words: Word[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    for (const item of content.items) {
      // TextItem has `str` and `transform`; TextMarkedContent does not.
      if (!("str" in item)) continue;
      const text = item.str;
      if (!text || !text.trim()) continue;
      words.push({
        text,
        x: item.transform[4],
        y: item.transform[5],
        page: p,
      });
    }
  }
  return words;
}

/**
 * Group words into rows by shared y-coordinate (within `tolerance`),
 * sorted top-to-bottom then left-to-right. One row ≈ one statement line.
 */
export function groupRowsByY(words: Word[], tolerance = 3): Word[][] {
  const byPage = new Map<number, Word[]>();
  for (const w of words) {
    if (!byPage.has(w.page)) byPage.set(w.page, []);
    byPage.get(w.page)!.push(w);
  }

  const rows: Word[][] = [];
  const pages = [...byPage.keys()].sort((a, b) => a - b);
  for (const page of pages) {
    const pageWords = byPage.get(page)!;
    const used = new Array(pageWords.length).fill(false);
    // sort by y descending (top first)
    const order = pageWords
      .map((_, i) => i)
      .sort((a, b) => pageWords[b].y - pageWords[a].y);
    for (const i of order) {
      if (used[i]) continue;
      const baseY = pageWords[i].y;
      const row: Word[] = [];
      for (let j = 0; j < pageWords.length; j++) {
        if (used[j]) continue;
        if (Math.abs(pageWords[j].y - baseY) <= tolerance) {
          row.push(pageWords[j]);
          used[j] = true;
        }
      }
      row.sort((a, b) => a.x - b.x);
      rows.push(row);
    }
  }
  return rows;
}

/** Parse a currency token like "$1,203.05" or "-$57.01" → number, or null. */
export function parseAmount(token: string | null | undefined): number | null {
  if (token == null) return null;
  const cleaned = String(token).replace(/[$,\s]/g, "");
  // must look like a number (optionally negative, with decimals)
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

/** Rightmost currency-looking token in a row, or null. */
export function findAmountInRow(row: Word[]): number | null {
  for (let i = row.length - 1; i >= 0; i--) {
    const amt = parseAmount(row[i].text);
    if (amt !== null) return amt;
  }
  return null;
}

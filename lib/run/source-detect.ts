import type { TransactionSource } from "@/types/transaction";

/**
 * Map an uploaded/Drive filename to its source connector. Single definition so
 * the filename→parser routing (which decides how real money is read) can't
 * drift between the upload and Drive paths.
 *
 * Order matters: "credit" is checked before the "boa"/"checking" catch-all so a
 * "BoA Credit Card" statement routes to boa_credit, not boa_checking.
 */
export function detectSource(filename: string): TransactionSource | null {
  const f = filename.toLowerCase();
  if (f.includes("honeybook") && f.includes("payment")) return "honeybook";
  if (f.includes("hana")) return "hana";
  if (f.includes("amex")) return "amex";
  if (f.includes("credit")) return "boa_credit";
  if (f.includes("checking") || f.includes("boa")) return "boa_checking";
  return null;
}

export function mimeFor(filename: string): string {
  const f = filename.toLowerCase();
  if (f.endsWith(".pdf")) return "application/pdf";
  if (f.endsWith(".csv")) return "text/csv";
  if (f.endsWith(".xlsx"))
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return "application/octet-stream";
}

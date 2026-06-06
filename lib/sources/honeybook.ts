import { readFileSync } from "node:fs";
import Papa from "papaparse";
import type { NormalizedTransaction } from "@/types/transaction";
import type { ParseInput, SourceConnector } from "./types";

/** Read CSV text from either a file path or an in-memory buffer. */
function readCsv(input: ParseInput): string {
  if (input.kind === "file") return readFileSync(input.path, "utf8");
  if (input.kind === "buffer") return input.buffer.toString("utf8");
  throw new Error("HoneyBook connector requires a file or buffer input");
}

/** Parse "Apr 08, 2026" → "2026-04-08". */
function parseHoneybookDate(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface PaymentRow {
  CLIENT_INFO?: string;
  PROJECT_NAME?: string;
  INVOICE?: string;
  PAYMENT_NAME?: string;
  PAYMENT_METHOD?: string;
  TRANSACTION_DATE?: string;
  NET_AMOUNT?: string;
  TOTAL_AMOUNT?: string;
}

export const honeybookConnector: SourceConnector = {
  source: "honeybook",
  async parse(input: ParseInput): Promise<NormalizedTransaction[]> {
    const csv = readCsv(input);
    const { data } = Papa.parse<PaymentRow>(csv, {
      header: true,
      skipEmptyLines: true,
    });

    return data
      .filter((row) => row.INVOICE || row.CLIENT_INFO)
      .map((row) => {
        const amount = parseFloat(row.NET_AMOUNT ?? "0") || 0;
        const invoice = (row.INVOICE ?? "").trim();
        const paymentName = (row.PAYMENT_NAME ?? "").trim();
        const client = (row.CLIENT_INFO ?? "").trim();
        return {
          source: "honeybook" as const,
          externalId: `hb_${invoice}_${paymentName}`.replace(/\s+/g, "_"),
          date: parseHoneybookDate(row.TRANSACTION_DATE ?? ""),
          amount,
          description: `${client} — ${paymentName}`.trim(),
          rawData: row as Record<string, unknown>,
        };
      });
  },
};

export interface BookedClient {
  projectName: string;
  projectType: string;
  projectDate: string;
  totalBookedValue: number;
  totalPaid: number;
}

interface BookedRow {
  "Project Name"?: string;
  "Project Type"?: string;
  "Project Date"?: string;
  "Total Booked Value"?: string;
  "Total Paid"?: string;
}

/** Parse the HoneyBook Booked Clients report (used later for A/R context). */
export function parseBookedClients(path: string): BookedClient[] {
  const csv = readFileSync(path, "utf8");
  const { data } = Papa.parse<BookedRow>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  return data
    .filter((row) => row["Project Name"])
    .map((row) => ({
      projectName: (row["Project Name"] ?? "").trim(),
      projectType: (row["Project Type"] ?? "").trim(),
      projectDate: (row["Project Date"] ?? "").trim(),
      totalBookedValue: parseFloat(row["Total Booked Value"] ?? "0") || 0,
      totalPaid: parseFloat(row["Total Paid"] ?? "0") || 0,
    }));
}

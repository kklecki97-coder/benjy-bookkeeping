import "server-only";
import { driveConnector, resolveMonthFolder } from "@/lib/drive/connector";
import { runMonthlyClose, type SourceInput, type RunResult } from "./orchestrate";
import type { TransactionSource } from "@/types/transaction";

/** Map a Drive filename to its source connector (same logic as upload path). */
function detectSource(filename: string): TransactionSource | null {
  const f = filename.toLowerCase();
  if (f.includes("honeybook") && f.includes("payment")) return "honeybook";
  if (f.includes("hana")) return "hana";
  if (f.includes("amex")) return "amex";
  if (f.includes("credit")) return "boa_credit";
  if (f.includes("checking") || f.includes("boa")) return "boa_checking";
  return null;
}

function mimeFor(filename: string): string {
  const f = filename.toLowerCase();
  if (f.endsWith(".pdf")) return "application/pdf";
  if (f.endsWith(".csv")) return "text/csv";
  if (f.endsWith(".xlsx"))
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return "application/octet-stream";
}

/**
 * Run a monthly close pulling files from a Google Drive folder instead of
 * manual upload. SCAFFOLD: works the moment driveConnector is implemented.
 */
export async function runCloseFromDrive(
  monthYear: string,
  folderId: string,
  userId: string | null,
): Promise<RunResult> {
  // The configured folder is the "mother" folder; descend into the
  // year → month subfolder for this run (falls back to the folder itself if
  // it already holds files directly).
  const monthFolderId = await resolveMonthFolder(folderId, monthYear);
  const files = await driveConnector.listFiles(monthFolderId);

  const sources: SourceInput[] = [];
  for (const file of files) {
    const source = detectSource(file.name);
    if (!source) continue;
    const buffer = await driveConnector.downloadFile(file.id);
    sources.push({
      source,
      input: { kind: "buffer", buffer, filename: file.name, mime: mimeFor(file.name) },
    });
  }

  return runMonthlyClose(monthYear, sources, userId);
}

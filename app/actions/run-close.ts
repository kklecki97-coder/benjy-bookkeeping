"use server";

import { revalidatePath } from "next/cache";
import { createSSRClient } from "@/lib/supabase/ssr";
import { runMonthlyClose, type SourceInput } from "@/lib/run/orchestrate";
import type { TransactionSource } from "@/types/transaction";

/** Map an uploaded filename to its source connector. */
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

export async function runClose(
  monthYear: string,
  formData: FormData,
): Promise<{ ok: boolean; message: string; runId?: string }> {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return { ok: false, message: "No files uploaded." };
  }

  const sources: SourceInput[] = [];
  const skipped: string[] = [];
  for (const file of files) {
    const source = detectSource(file.name);
    if (!source) {
      skipped.push(file.name);
      continue;
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    sources.push({
      source,
      input: { kind: "buffer", buffer, filename: file.name, mime: mimeFor(file.name) },
    });
  }

  if (sources.length === 0) {
    return {
      ok: false,
      message: `No recognized source files. Skipped: ${skipped.join(", ")}`,
    };
  }

  try {
    const result = await runMonthlyClose(monthYear, sources, user.id);
    revalidatePath("/dashboard");
    return {
      ok: true,
      runId: result.runId,
      message: `Processed ${result.totalTransactions} transactions (${result.exceptions} need review).${skipped.length ? ` Skipped: ${skipped.join(", ")}` : ""}`,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Run failed.",
    };
  }
}

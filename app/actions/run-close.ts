"use server";

import { revalidatePath } from "next/cache";
import { createSSRClient } from "@/lib/supabase/ssr";
import { runMonthlyClose, type SourceInput } from "@/lib/run/orchestrate";
import { detectSource, mimeFor } from "@/lib/run/source-detect";

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

  // A run with no files is still valid when Shopify is configured — the
  // orchestrator auto-pulls Shopify (API) for the month. Only block when there's
  // genuinely nothing to process (no recognized files AND no Shopify).
  const shopifyConfigured =
    !!process.env.SHOPIFY_STORE_DOMAIN &&
    !!process.env.SHOPIFY_CLIENT_ID &&
    !!process.env.SHOPIFY_CLIENT_SECRET;
  if (sources.length === 0 && !shopifyConfigured) {
    return {
      ok: false,
      message: files.length
        ? `No recognized source files. Skipped: ${skipped.join(", ")}`
        : "Upload source files or connect Shopify to start a close.",
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

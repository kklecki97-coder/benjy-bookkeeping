"use server";

import { revalidatePath } from "next/cache";
import { createSSRClient } from "@/lib/supabase/ssr";
import { createServiceClient } from "@/lib/supabase/server";
import { postTransactions } from "@/lib/qbo/post";
import { isConnected } from "@/lib/qbo/oauth";

export async function postToQbo(
  runId: string,
): Promise<{ ok: boolean; message: string }> {
  const ssr = await createSSRClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  if (!(await isConnected())) {
    return { ok: false, message: "QuickBooks is not connected. Connect it in Settings." };
  }

  try {
    // postTransactions needs full DB access (service role) for updates + audit
    const supabase = createServiceClient();
    const result = await postTransactions(runId, supabase as never);

    await supabase
      .from("monthly_runs")
      .update({
        status: result.failed > 0 ? "error" : "complete",
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId);

    revalidatePath("/dashboard");
    return {
      ok: result.failed === 0,
      message: `Posted ${result.posted} transactions to QuickBooks.${result.failed > 0 ? ` ${result.failed} failed — see retry queue.` : ""}`,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Posting failed.",
    };
  }
}

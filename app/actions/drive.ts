"use server";

import { revalidatePath } from "next/cache";
import { createSSRClient } from "@/lib/supabase/ssr";
import { setFolderId, getFolderId } from "@/lib/drive/auth";
import { runCloseFromDrive } from "@/lib/run/from-drive";

export async function saveDriveFolder(folderId: string) {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  // Accept a raw ID or a full Drive folder URL
  const id =
    folderId.match(/folders\/([a-zA-Z0-9_-]+)/)?.[1] ?? folderId.trim();
  if (!id) return { ok: false, message: "Provide a folder ID or link." };
  // Drive ids are URL-safe base64-ish; reject anything else before it ever
  // reaches the Drive query string.
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    return { ok: false, message: "That doesn't look like a valid Drive folder ID or link." };
  }

  await setFolderId(id);
  revalidatePath("/settings");
  return { ok: true, message: "Folder saved." };
}

export async function runFromDrive(monthYear: string) {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  try {
    const folderId = await getFolderId();
    if (!folderId) {
      return { ok: false, message: "No Drive folder configured. Set one in Settings." };
    }
    const result = await runCloseFromDrive(monthYear, folderId, user.id);
    revalidatePath("/dashboard");
    return {
      ok: true,
      message: `Pulled from Drive: ${result.totalTransactions} transactions (${result.exceptions} need review).`,
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Run failed." };
  }
}

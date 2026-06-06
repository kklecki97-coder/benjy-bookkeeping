"use server";

import { redirect } from "next/navigation";
import { createSSRClient } from "@/lib/supabase/ssr";

export async function signOut() {
  const supabase = await createSSRClient();
  await supabase.auth.signOut();
  redirect("/login");
}

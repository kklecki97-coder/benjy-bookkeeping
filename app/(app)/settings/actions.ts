"use server";

import { createSSRClient } from "@/lib/supabase/ssr";

/**
 * Change the signed-in user's password. Supabase verifies the active session,
 * so no current-password field is needed — only an authenticated user can call
 * this, and it only ever affects their own account.
 */
export async function changePassword(
  newPassword: string,
  confirmPassword: string,
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createSSRClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "You're not signed in." };

  if (newPassword.length < 8) {
    return { ok: false, message: "Password must be at least 8 characters." };
  }
  if (newPassword !== confirmPassword) {
    return { ok: false, message: "Passwords don't match." };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, message: error.message };

  return { ok: true, message: "Password updated." };
}

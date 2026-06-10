import { createSSRClient } from "@/lib/supabase/ssr";

/**
 * Resolve the current request's Supabase (SSR) client and authenticated user.
 * Single definition so the auth gate isn't re-implemented per server action.
 */
export async function requireUser() {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

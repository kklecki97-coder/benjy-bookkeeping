import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";

/**
 * Server-only Supabase client using the service-role key.
 * Bypasses RLS — use ONLY in server actions / API routes / route handlers.
 * NEVER import this into a client component.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing Supabase server env vars");
  }
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

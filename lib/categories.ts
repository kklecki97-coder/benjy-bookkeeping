import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * The set of categories the owner can pick from when reviewing transactions.
 * Drawn from the rulebook (the categories rules assign) plus any category the
 * AI has already suggested on a transaction — so the picker always offers
 * what's in use, while still allowing a free-typed new one in the UI.
 */
export async function getKnownCategories(): Promise<string[]> {
  const supabase = createServiceClient();

  const [{ data: rules }, { data: txs }] = await Promise.all([
    supabase.from("rulebook_rules").select("category"),
    supabase.from("transactions").select("suggested_category").not("suggested_category", "is", null),
  ]);

  const set = new Set<string>();
  for (const r of rules ?? []) {
    if (r.category) set.add(r.category.trim());
  }
  for (const t of txs ?? []) {
    if (t.suggested_category) set.add(t.suggested_category.trim());
  }

  return [...set].sort((a, b) => a.localeCompare(b));
}

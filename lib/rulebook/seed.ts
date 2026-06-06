import { createServiceClient } from "@/lib/supabase/server";
import { getRulebookRules } from "./parse";

/**
 * Idempotent seed: upserts the rulebook rules into rulebook_rules.
 * Safe to re-run — matches on pattern.
 */
export async function seedRulebookRules() {
  const supabase = createServiceClient();
  const rules = getRulebookRules();

  let inserted = 0;
  for (const r of rules) {
    const { data: existing } = await supabase
      .from("rulebook_rules")
      .select("id")
      .eq("pattern", r.pattern)
      .maybeSingle();

    if (existing) continue;

    const { error } = await supabase.from("rulebook_rules").insert({
      rule_type: r.rule_type,
      pattern: r.pattern,
      category: r.category,
      vendor: r.vendor,
      priority: r.priority,
      notes: r.notes,
    });
    if (error) throw new Error(`Seed failed for ${r.pattern}: ${error.message}`);
    inserted++;
  }
  return { total: rules.length, inserted };
}

"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";

export interface RuleInput {
  pattern: string;
  category: string;
  vendor: string | null;
  priority: number;
}

export async function createRule(input: RuleInput) {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, message: "Not authenticated." };
  if (!input.pattern || !input.category) {
    return { ok: false, message: "Pattern and category are required." };
  }

  const { data, error } = await supabase
    .from("rulebook_rules")
    .insert({
      rule_type: "vendor_match",
      pattern: input.pattern,
      category: input.category,
      vendor: input.vendor,
      priority: input.priority,
      notes: "",
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };

  await supabase.from("audit_log").insert({
    action: "rule_created",
    after_state: { ...input, id: data.id },
    user_id: user.id,
  });
  revalidatePath("/settings");
  return { ok: true, message: "Rule added." };
}

export async function updateRule(id: string, input: RuleInput) {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const { data: before } = await supabase
    .from("rulebook_rules")
    .select("pattern, category, vendor, priority")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("rulebook_rules")
    .update({
      pattern: input.pattern,
      category: input.category,
      vendor: input.vendor,
      priority: input.priority,
    })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };

  await supabase.from("audit_log").insert({
    action: "rule_updated",
    before_state: before as never,
    after_state: input as never,
    user_id: user.id,
  });
  revalidatePath("/settings");
  return { ok: true, message: "Rule updated." };
}

export async function deleteRule(id: string) {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const { data: before } = await supabase
    .from("rulebook_rules")
    .select("pattern, category")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("rulebook_rules").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };

  await supabase.from("audit_log").insert({
    action: "rule_deleted",
    before_state: before,
    user_id: user.id,
  });
  revalidatePath("/settings");
  return { ok: true, message: "Rule deleted." };
}

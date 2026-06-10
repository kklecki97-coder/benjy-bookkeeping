"use server";

import { createSSRClient } from "@/lib/supabase/ssr";
import { explainTransaction, type ExplainTx } from "@/lib/agent/explain";
import type { RuleForAgent } from "@/lib/agent/categorize";

/**
 * On-demand "Why was this uncertain?" explanation for a single exception.
 * Loads the transaction + any rulebook rules whose pattern relates to its
 * description, then asks Claude for a short, plain-English rationale.
 *
 * This is its own (cheap) call — not part of the bulk categorization pass —
 * so we only pay for an explanation when the owner actually asks for one.
 */
export async function explainException(
  txId: string,
): Promise<{ ok: boolean; explanation?: string; message?: string }> {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const { data: tx } = await supabase
    .from("transactions")
    .select(
      "source, transaction_date, amount, description, suggested_category, suggested_vendor, confidence, reasoning",
    )
    .eq("id", txId)
    .single();
  if (!tx) return { ok: false, message: "Transaction not found." };

  const { data: rules } = await supabase
    .from("rulebook_rules")
    .select("id, rule_type, pattern, category, vendor, priority, notes");

  // Candidate rules = those whose pattern token appears in the description, so
  // Claude sees what it *could* have matched (often empty — that's the point).
  const desc = (tx.description ?? "").toUpperCase();
  const candidates: RuleForAgent[] = (rules ?? [])
    .filter((r) => {
      const p = (r.pattern ?? "").toUpperCase().trim();
      return p.length > 0 && desc.includes(p);
    })
    .map((r) => ({
      id: r.id,
      rule_type: r.rule_type,
      pattern: r.pattern,
      category: r.category,
      vendor: r.vendor,
      priority: r.priority,
      notes: r.notes ?? "",
    }));

  const explainTx: ExplainTx = {
    source: tx.source,
    date: tx.transaction_date ?? "",
    amount: Number(tx.amount),
    description: tx.description ?? "",
    suggested_category: tx.suggested_category,
    suggested_vendor: tx.suggested_vendor,
    confidence: tx.confidence,
    reasoning: tx.reasoning,
  };

  try {
    const explanation = await explainTransaction(explainTx, candidates);
    return { ok: true, explanation };
  } catch {
    return {
      ok: false,
      message: "Couldn't reach the assistant just now — try again in a moment.",
    };
  }
}

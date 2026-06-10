import Anthropic from "@anthropic-ai/sdk";
import type { RuleForAgent } from "./categorize";

/** The exception details the dashboard already holds for a transaction. */
export interface ExplainTx {
  source: string;
  date: string;
  amount: number;
  description: string;
  suggested_category: string | null;
  suggested_vendor: string | null;
  confidence: number | null;
  reasoning: string | null;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

/**
 * Build the prompt that asks Claude to explain — in plain English, to the
 * business owner — why this transaction was uncertain and what it would take
 * to categorize it confidently. Pure (no I/O) so it's unit-testable.
 */
export function buildExplainPrompt(tx: ExplainTx, candidateRules: RuleForAgent[]): string {
  const lines: string[] = [];

  lines.push("Here is a single transaction the bookkeeping agent was NOT confident about:");
  lines.push("");
  lines.push(`- Source: ${tx.source}`);
  lines.push(`- Date: ${tx.date}`);
  lines.push(`- Amount: ${fmt(tx.amount)} (${tx.amount})`);
  lines.push(`- Description: ${tx.description}`);
  lines.push(
    `- The agent's tentative suggestion: ${tx.suggested_category ?? "(none — it couldn't decide)"}` +
      (tx.suggested_vendor ? ` / vendor "${tx.suggested_vendor}"` : ""),
  );
  lines.push(
    `- Confidence: ${tx.confidence ?? "unknown"} out of 100 (this is why it was flagged for review)`,
  );
  if (tx.reasoning) {
    lines.push(`- The agent's brief internal note: "${tx.reasoning}"`);
  }
  lines.push("");

  if (candidateRules.length > 0) {
    lines.push("Rules in the rulebook that look related:");
    for (const r of candidateRules) {
      lines.push(
        `- [${r.id}] pattern "${r.pattern}" → ${r.category ?? "(no category)"}` +
          (r.notes ? ` — ${r.notes}` : ""),
      );
    }
  } else {
    lines.push(
      "No rule in the rulebook matched this transaction's description, which is the usual reason it landed in review.",
    );
  }
  lines.push("");

  lines.push(
    "Explain to the business owner, in plain English (2-4 short sentences, conversational, no jargon, no bullet points), WHY this one was uncertain and what would resolve it. " +
      "Be specific to THIS transaction. If you have a best guess at the right category, say so and why. " +
      "If you genuinely can't tell, say what extra context (e.g. what was bought, which vendor) would settle it. " +
      "Write as if talking to the owner directly — start with the explanation, not a preamble.",
  );

  return lines.join("\n");
}

const MODEL = "claude-haiku-4-5";

/**
 * Ask Claude for a conversational explanation of why a single exception was
 * uncertain. Called on demand (owner clicks "Why?"), so it's a small, cheap
 * one-transaction request — not part of the bulk categorization pass.
 */
export async function explainTransaction(
  tx: ExplainTx,
  candidateRules: RuleForAgent[],
): Promise<string> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system:
      "You are a friendly, sharp bookkeeping assistant for a small florist business. " +
      "You explain your reasoning to the owner clearly and honestly, never overstating certainty.",
    messages: [{ role: "user", content: buildExplainPrompt(tx, candidateRules) }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  return text || "I couldn't generate an explanation for this one — try editing it directly.";
}

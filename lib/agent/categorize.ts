import Anthropic from "@anthropic-ai/sdk";
import type { NormalizedTransaction } from "@/types/transaction";
import {
  CategorizationBatchSchema,
  type Categorization,
  CONFIDENCE_THRESHOLD,
} from "./schema";

export interface RuleForAgent {
  id: string;
  rule_type: string;
  pattern: string;
  category: string | null;
  vendor: string | null;
  priority: number;
  notes: string;
}

type TxWithId = NormalizedTransaction & { id: string };

const MODEL = "claude-sonnet-4-6";

/** Render the rulebook rules into a stable, cacheable system-prompt block. */
function buildRulesContext(rules: RuleForAgent[]): string {
  const lines = rules
    .slice()
    .sort((a, b) => a.priority - b.priority)
    .map(
      (r) =>
        `- [${r.id}] (${r.rule_type}, priority ${r.priority}) pattern="${r.pattern}" → category="${r.category ?? ""}"${r.vendor ? ` vendor="${r.vendor}"` : ""}${r.notes ? ` — ${r.notes}` : ""}`,
    );
  return lines.join("\n");
}

const SYSTEM_INSTRUCTIONS = `You are a bookkeeping categorization agent for Towers Flowers (Mimosa Collective LLC), a retail and events florist.

Your job: categorize each bank/card/POS transaction to the correct QuickBooks account, using the rulebook below.

Core principles:
- Code every transaction to its revenue SOURCE or expense category, not its payment method.
- Match transactions against the rulebook patterns. When a transaction description contains a rule's pattern, apply that rule's category.
- Exception rules (priority 10) take precedence over vendor matches (priority 50).
- For the seller-note exception: a "Promise Floral" payment of ~$4,200 is the seller note (split principal/interest), NOT flower COGS. A smaller Promise Floral charge IS flower COGS.
- If a transaction matches no rule and you cannot confidently categorize it, set a LOW confidence (below ${CONFIDENCE_THRESHOLD}) so a human reviews it. Never guess silently.
- confidence is 0-100: 90+ = clear rule match; 70-89 = likely; below 70 = uncertain/needs review.
- Set matched_rule_id to the rule's id (e.g. "rule_3") when a rule applies, else null.

Return one result per transaction, preserving each transaction's id as transaction_id.
Keep "reasoning" very short (one brief phrase, max ~10 words) to stay within output limits.`;

/**
 * Categorize a batch of transactions against the rulebook using Claude.
 * Uses prompt caching on the (large, stable) rulebook context.
 */
export async function categorize(
  transactions: TxWithId[],
  rules: RuleForAgent[],
): Promise<Categorization[]> {
  if (transactions.length === 0) return [];

  const client = new Anthropic();
  const rulesContext = buildRulesContext(rules);

  // Batch to keep each response well under max_tokens. A single huge batch
  // overflows the output limit and returns truncated (invalid) JSON.
  const BATCH_SIZE = 40;

  // Split into batches, then run them concurrently. The batches are fully
  // independent (no batch needs another's result), so awaiting them one by one
  // wasted wall-clock time — total time was the SUM of all batches. With
  // Promise.all the total is the slowest SINGLE batch instead. Results are
  // collected in batch order so output stays deterministic.
  const batches: TxWithId[][] = [];
  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    batches.push(transactions.slice(i, i + BATCH_SIZE));
  }

  const batchResults = await Promise.all(
    batches.map((batch) => categorizeBatch(client, batch, rulesContext)),
  );

  return batchResults.flat();
}

async function categorizeBatch(
  client: Anthropic,
  transactions: TxWithId[],
  rulesContext: string,
): Promise<Categorization[]> {
  const txList = transactions
    .map(
      (t) =>
        `{"id": "${t.id}", "source": "${t.source}", "date": "${t.date}", "amount": ${t.amount}, "description": ${JSON.stringify(t.description)}}`,
    )
    .join("\n");

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    output_config: {
      effort: "low",
      format: {
        type: "json_schema",
        schema: zodToJsonSchema(),
      },
    },
    system: [
      { type: "text", text: SYSTEM_INSTRUCTIONS },
      {
        type: "text",
        text: `RULEBOOK RULES:\n${rulesContext}`,
        cache_control: { type: "ephemeral" }, // cached across batches (same rules)
      },
    ],
    messages: [
      {
        role: "user",
        content: `Categorize these transactions:\n${txList}`,
      },
    ],
  });

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error("Categorization returned no parseable output");
  }
  return CategorizationBatchSchema.parse(parsed).results;
}

/**
 * Whether a categorization should go to the exception queue
 * (low confidence or no rule matched).
 */
export function isException(c: Categorization): boolean {
  return c.confidence < CONFIDENCE_THRESHOLD || c.matched_rule_id === null;
}

/** Minimal JSON schema for the batch output (parse() validates against it). */
function zodToJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            transaction_id: { type: "string" },
            suggested_category: { type: "string" },
            suggested_vendor: { type: ["string", "null"] },
            confidence: { type: "integer" },
            reasoning: { type: "string" },
            matched_rule_id: { type: ["string", "null"] },
          },
          required: [
            "transaction_id",
            "suggested_category",
            "suggested_vendor",
            "confidence",
            "reasoning",
            "matched_rule_id",
          ],
        },
      },
    },
    required: ["results"],
  };
}

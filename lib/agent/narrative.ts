import Anthropic from "@anthropic-ai/sdk";
import { countsAsRevenue } from "./revenue";

export interface NarrativeTx {
  source: string;
  amount: number;
  suggested_category: string | null;
  status: string;
  description?: string | null;
}

export interface NarrativeFacts {
  monthYear: string;
  totalTransactions: number;
  exceptions: number;
  totalRevenue: number;
  revenueBySource: { source: string; amount: number }[];
  topExpenses: { category: string; amount: number }[];
}

/**
 * Compute the figures the month-in-review narrative is built from. Pure — no
 * AI, no DB — so it's unit-testable. Revenue uses countsAsRevenue (sales from
 * each channel's own file, excluding bank-deposit mirrors). Expenses are
 * negative amounts grouped by category.
 */
export function buildNarrativeFacts(
  monthYear: string,
  txs: NarrativeTx[],
): NarrativeFacts {
  const revBySource = new Map<string, number>();
  const expByCat = new Map<string, number>();
  let totalRevenue = 0;
  let exceptions = 0;

  for (const t of txs) {
    if (t.status === "pending") exceptions++;

    if (countsAsRevenue(t)) {
      const amt = Math.abs(Number(t.amount));
      totalRevenue += amt;
      revBySource.set(t.source, (revBySource.get(t.source) ?? 0) + amt);
    } else if (Number(t.amount) < 0 && t.suggested_category) {
      const amt = Math.abs(Number(t.amount));
      expByCat.set(t.suggested_category, (expByCat.get(t.suggested_category) ?? 0) + amt);
    }
  }

  return {
    monthYear,
    totalTransactions: txs.length,
    exceptions,
    totalRevenue,
    revenueBySource: [...revBySource.entries()]
      .map(([source, amount]) => ({ source, amount }))
      .sort((a, b) => b.amount - a.amount),
    topExpenses: [...expByCat.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5),
  };
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

/** Render one month's figures into a compact text block for the prompt. */
function factsBlock(label: string, f: NarrativeFacts): string {
  return [
    `${label} (${f.monthYear}):`,
    `  Total revenue: ${fmt(f.totalRevenue)}`,
    `  Revenue by channel: ${f.revenueBySource.map((r) => `${r.source} ${fmt(r.amount)}`).join(", ") || "none"}`,
    `  Top expenses: ${f.topExpenses.map((e) => `${e.category} ${fmt(e.amount)}`).join(", ") || "none"}`,
    `  Transactions: ${f.totalTransactions} (${f.exceptions} need review)`,
  ].join("\n");
}

/**
 * Ask Claude for a short, plain-English management summary of the month.
 * Called once per run after categorization; the result is stored on the run.
 * Uses a fast/cheap model — this is light prose over already-computed numbers.
 * If `previous` (the prior month's figures) is given, the summary compares the
 * two (e.g. "revenue up 11% from April").
 */
export async function generateNarrative(
  facts: NarrativeFacts,
  previous?: NarrativeFacts | null,
): Promise<string> {
  if (facts.totalTransactions === 0) return "";

  const client = new Anthropic();
  const blocks = [factsBlock("This month", facts)];
  if (previous && previous.totalTransactions > 0) {
    blocks.push(factsBlock("Previous month", previous));
  }

  const compareInstruction = previous
    ? " The previous month's figures are also given — compare them: note whether revenue is up or down (with an approximate %), and call out any expense category that changed notably."
    : "";

  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 400,
    system:
      "You are a friendly bookkeeper writing a short monthly summary for the owner of Towers Flowers, a retail and events florist. Write 3-5 short sentences in plain English: lead with how the month went (revenue and main channels), call out the largest expenses, and end by noting how many transactions need their review. Be concrete with the numbers given. No bullet points, no headers, no preamble — just the summary. Don't invent figures beyond what's provided." +
      compareInstruction,
    messages: [{ role: "user", content: blocks.join("\n\n") }],
  });

  const block = response.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text.trim() : "";
}

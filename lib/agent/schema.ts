import { z } from "zod";

/**
 * Structured output the categorization agent returns per transaction.
 * Validated by client.messages.parse() so the model retries on mismatch.
 */
export const CategorizationSchema = z.object({
  transaction_id: z.string(),
  suggested_category: z.string(),
  suggested_vendor: z.string().nullable(),
  confidence: z.number(), // 0-100
  reasoning: z.string(),
  matched_rule_id: z.string().nullable(),
});

export const CategorizationBatchSchema = z.object({
  results: z.array(CategorizationSchema),
});

export type Categorization = z.infer<typeof CategorizationSchema>;

/** Confidence below this routes a transaction to the exception queue. */
export const CONFIDENCE_THRESHOLD = 85;

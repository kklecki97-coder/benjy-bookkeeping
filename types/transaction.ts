/**
 * Source-agnostic transaction shape. Every parser/connector returns this,
 * so downstream (categorization, posting) never cares about the source format.
 */
export interface NormalizedTransaction {
  source: TransactionSource;
  externalId: string; // stable per-source id for idempotency
  date: string; // ISO yyyy-mm-dd
  amount: number; // positive = inflow/credit, negative = outflow/debit
  description: string;
  rawData: Record<string, unknown>; // original parsed row, for audit/debug
}

export type TransactionSource =
  | "shopify"
  | "hana"
  | "honeybook"
  | "amex"
  | "boa_checking"
  | "boa_credit";

import type {
  NormalizedTransaction,
  TransactionSource,
} from "@/types/transaction";

/**
 * Input to a source connector: either a local/uploaded file, or an API pull
 * for a given month (used by Shopify).
 */
export type ParseInput =
  | { kind: "file"; path: string; mime: string }
  | { kind: "buffer"; buffer: Buffer; filename: string; mime: string }
  | { kind: "api"; monthYear: string };

export interface SourceConnector {
  source: TransactionSource;
  parse(input: ParseInput): Promise<NormalizedTransaction[]>;
}

/** Stable hash helper for building external IDs from descriptions. */
export function shortHash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

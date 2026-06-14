import Papa from "papaparse";

/**
 * Aggregated revenue components for one platform for one month — the figures a
 * V3 compound revenue journal entry is built from. Revenue is recognized ONCE
 * per platform per month from the platform's own report; deposits only clear
 * the [Platform] Bank account. See rulebook V3 "Clearing-Account Model".
 */
export interface PlatformSummary {
  /** gross sales incl. tax (the top-line total) */
  gross: number;
  /** sales tax collected (credited to Sales Tax Payable) */
  tax: number;
  /** processing/transaction fees (debited to the platform Fees expense) */
  fee: number;
  /** net cash expected to clear from bank deposits (debits the [Platform] Bank plug) */
  net: number;
  /** shipping/delivery income (credited to Shipping Income), if any */
  shipping: number;
  /** discounts (contra), if any */
  discounts: number;
  /** refunds/returns (contra), if any */
  refunds: number;
  /** gratuity/tips income, if any */
  gratuity: number;
  /** sales net of tax — the [Platform] Sales credit line */
  salesNetOfTax: number;
  /** number of payment rows summarized (sanity check) */
  rows: number;
}

const num = (s: unknown): number =>
  parseFloat(String(s ?? "").replace(/[$,]/g, "")) || 0;

interface HbRow {
  INVOICE?: string;
  CLIENT_INFO?: string;
  TOTAL_AMOUNT?: string;
  NET_AMOUNT?: string;
  TRANSACTION_FEE?: string;
  TAX_1?: string;
  TAX_2?: string;
  TAX_3?: string;
  DISCOUNT_PAYMENT?: string;
  REFUNDED_AMOUNT?: string;
  GRATUITY?: string;
}

/**
 * Sum the HoneyBook Payments CSV into compound-JE components. Each payment row
 * contributes gross (TOTAL_AMOUNT), tax (TAX_1+2+3), fee (TRANSACTION_FEE), net
 * (NET_AMOUNT), plus discounts/refunds/gratuity. By construction the platform's
 * own report balances: gross == net + fee.
 */
export function summarizeHoneybook(csv: string): PlatformSummary {
  const { data } = Papa.parse<HbRow>(csv, { header: true, skipEmptyLines: true });
  const rows = data.filter((r) => r.INVOICE || r.CLIENT_INFO);

  let gross = 0,
    net = 0,
    fee = 0,
    tax = 0,
    discounts = 0,
    refunds = 0,
    gratuity = 0;
  for (const r of rows) {
    gross += num(r.TOTAL_AMOUNT);
    net += num(r.NET_AMOUNT);
    fee += num(r.TRANSACTION_FEE);
    tax += num(r.TAX_1) + num(r.TAX_2) + num(r.TAX_3);
    discounts += num(r.DISCOUNT_PAYMENT);
    refunds += num(r.REFUNDED_AMOUNT);
    gratuity += num(r.GRATUITY);
  }

  return {
    gross,
    tax,
    fee,
    net,
    shipping: 0, // HoneyBook CSV has no shipping field
    discounts,
    refunds,
    gratuity,
    salesNetOfTax: gross - tax,
    rows: rows.length,
  };
}

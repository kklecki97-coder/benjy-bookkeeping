import Papa from "papaparse";
import type { QboAccount } from "./accounts";
import type { JournalEntry } from "./post";
import { buildCompoundEntry, periodJeKey, type CompoundLine } from "./compound";

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
  /** refunds (contra), if any */
  refunds: number;
  /** returns (contra), if any */
  returns: number;
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
    returns: 0, // HoneyBook tracks refunds, not separate returns
    gratuity,
    salesNetOfTax: gross - tax,
    rows: rows.length,
  };
}

/** Find a Hana summary line's value by its leading label (case-insensitive). */
function hanaValue(rows: string[][], label: string): number {
  const key = label.toLowerCase();
  for (const r of rows) {
    const cell = String(r[0] ?? "").replace(/\s+/g, " ").trim().toLowerCase();
    if (cell.startsWith(key)) {
      for (let i = 1; i < r.length; i++) {
        const v = num(r[i]);
        if (v) return v;
      }
    }
  }
  return 0;
}

/**
 * Summarize the Hana Daily Posting Summary (already parsed into [label, value]
 * rows) into compound-JE components. Hana's "Net Total Sales" is already net of
 * discounts and is the Hana Sales credit; "SalesTax Charged" is the tax; "Total
 * Delivery Fee" is shipping income. Hana has no processor fee inside the JE
 * (the Clearent monthly fee is a separate flat subscription, not per-sale), so
 * the bank plug simply clears sales + tax. Returns/tips are absent in the
 * report (default 0).
 */
export function summarizeHanaRows(rows: string[][]): PlatformSummary {
  const salesNetOfTax = hanaValue(rows, "Net Total Sales");
  const tax = hanaValue(rows, "SalesTax Charged");
  const shipping = hanaValue(rows, "Total Delivery Fee");
  // Net cash the Hana deposits should clear = recognized revenue + tax.
  const net = salesNetOfTax + tax;
  return {
    gross: salesNetOfTax + tax,
    tax,
    fee: 0,
    net,
    shipping,
    discounts: 0, // already netted inside Net Total Sales
    refunds: 0,
    returns: 0,
    gratuity: 0,
    salesNetOfTax,
    rows: rows.length,
  };
}

export type Platform = "hana" | "honeybook" | "shopify";

/** Canonical QBO account names per platform (must match the chart of accounts). */
export const PLATFORM_ACCOUNTS: Record<
  Platform,
  { sales: string; bank: string; fees: string }
> = {
  hana: { sales: "Hana Sales", bank: "Hana Bank", fees: "Hana Wire Fee" },
  honeybook: { sales: "Honeybook Sales", bank: "Honeybook Bank", fees: "Honeybook Fees" },
  shopify: { sales: "Shopify Sales", bank: "Shopify Bank", fees: "Shopify Fees" },
};

const TAX_ACCOUNT = "Sales Tax Payable";
const SHIPPING_ACCOUNT = "Shipping Income";

const get = (accounts: Map<string, QboAccount>, name: string) =>
  accounts.get(name.toLowerCase().trim());

/**
 * Build the V3 month-end compound revenue JE for one platform from its summary.
 * Recognizes revenue ONCE: credit [Platform] Sales (net of tax), credit Sales
 * Tax Payable, credit Shipping Income (if any); debit platform Fees (if any);
 * debit [Platform] Bank with the net-cash plug (what the deposits should clear
 * to). The compound builder verifies it balances. Carries the per-period
 * idempotency key as PrivateNote so a re-run won't double the month.
 *
 * Returns null if a required account is missing from the chart of accounts —
 * fail loud, never post a half-mapped revenue entry to real books.
 */
export function buildPlatformRevenueJe(
  s: PlatformSummary,
  platform: Platform,
  period: string,
  accounts: Map<string, QboAccount>,
): JournalEntry | null {
  const names = PLATFORM_ACCOUNTS[platform];
  const salesAcct = get(accounts, names.sales);
  const bankAcct = get(accounts, names.bank);
  const taxAcct = get(accounts, TAX_ACCOUNT);
  // Required accounts. Fees/shipping only required when there's a non-zero figure.
  if (!salesAcct || !bankAcct || !taxAcct) return null;
  const feeAcct = get(accounts, names.fees);
  const shipAcct = get(accounts, SHIPPING_ACCOUNT);
  if (s.fee > 0 && !feeAcct) return null;
  if (s.shipping > 0 && !shipAcct) return null;

  const lines: CompoundLine[] = [
    { account: salesAcct, side: "Credit", amount: s.salesNetOfTax - s.shipping, description: `${platform} sales` },
    { account: taxAcct, side: "Credit", amount: s.tax, description: `${platform} sales tax` },
  ];
  if (s.shipping > 0 && shipAcct)
    lines.push({ account: shipAcct, side: "Credit", amount: s.shipping, description: `${platform} shipping` });
  if (s.fee > 0 && feeAcct)
    lines.push({ account: feeAcct, side: "Debit", amount: s.fee, description: `${platform} fees` });
  // Net-cash plug clears the platform bank account.
  lines.push({ account: bankAcct, side: "Debit", amount: s.net, description: `${platform} net to clearing` });

  const key = periodJeKey(period, `${platform.toUpperCase()}-REVENUE`);
  // Period is yyyy-mm; stamp the JE on the last day of that month.
  const txnDate = `${period}-${lastDayOfMonth(period)}`;
  return buildCompoundEntry(lines, { privateNote: key, txnDate });
}

/** Last day of a yyyy-mm period as a 2-digit day string. */
function lastDayOfMonth(period: string): string {
  const [y, m] = period.split("-").map((n) => parseInt(n, 10));
  // day 0 of next month = last day of this month
  const d = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return String(d).padStart(2, "0");
}

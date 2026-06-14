/**
 * Structured rules derived from the client's rulebook (samples/rulebook.md).
 * These are the explicit, unambiguous vendor→category mappings. They seed the
 * rulebook_rules table and are then editable by Benjy in the app — so this is
 * the initial seed, not a hardcoded runtime dependency.
 *
 * Priority: lower number = checked first. Exceptions (10) before vendor
 * matches (50) before defaults (100).
 */

export interface RulebookRule {
  rule_type: "vendor_match" | "category_default" | "exception";
  pattern: string;
  category: string;
  vendor: string | null;
  priority: number;
  notes: string;
}

function v(pattern: string, category: string, vendor?: string): RulebookRule {
  return {
    rule_type: "vendor_match",
    pattern,
    category,
    vendor: vendor ?? pattern,
    priority: 50,
    notes: "",
  };
}

function exception(pattern: string, category: string, notes: string): RulebookRule {
  return { rule_type: "exception", pattern, category, vendor: null, priority: 10, notes };
}

const REVENUE: RulebookRule[] = [
  v("CLEARENT LLC", "Hana Sales", "Hana POS"),
  v("Counter Credit", "Hana Sales", "Hana POS cash"),
  v("BKOFAMERICA ATM", "Hana Sales", "Hana POS cash"),
  v("Shopify DES:TRANSFER", "Shopify Sales", "Shopify"),
  v("Shopify", "Shopify Sales", "Shopify"),
  v("MIMOSA COLLECTIV DES:", "Honeybook Sales", "HoneyBook"),
  v("Teleflora", "Hana Sales", "Teleflora wire-in"),
  v("AP PAYMENT", "Hana Sales", "Teleflora wire-in"),
];

const COGS: RulebookRule[] = [
  v("Perri Farms", "Cost of goods sold"),
  v("Delaware Valley Floral", "Cost of goods sold"),
  v("Promise Floral", "Cost of goods sold"),
  v("J. Merullo Imports", "Cost of goods sold"),
  v("Merullo", "Cost of goods sold", "J. Merullo Imports"),
  v("David Shannon Florist", "Cost of goods sold"),
  v("Giuntas Meat Farms", "Cost of goods sold"),
];

const PAYROLL: RulebookRule[] = [
  v("ADP WAGE PAY", "Salaries & wages", "ADP"),
  v("ADP Tax", "Payroll Taxes", "ADP"),
  v("ADP PAYROLL FEES", "Payroll Fees", "ADP"),
  v("Ashley Edgar", "Salaries & wages"),
];

const SOFTWARE: RulebookRule[] = [
  "Hana Software",
  "QuickBooks",
  "Intuit",
  "Google Workspace",
  "Adobe",
  "Claude.ai",
  "Anthropic",
  "OpenAI",
  "ChatGPT",
  "Amazon Prime",
  "Spotify",
  "Ring",
  "Namecheap",
  "Uber One",
  "Bouncie",
  "Make.com",
  "Airtable",
  "Slack",
].map((s) => v(s, "Software subscriptions"));

const OTHER: RulebookRule[] = [
  v("HoneyBook", "Honeybook Fees"),
  v("National Grid", "Utilities"),
  v("NGRID", "Utilities", "National Grid"),
  v("Optimum", "Utilities"),
  v("Clearent Monthly Fee", "Hana Wire Fee"),
  v("Travelers", "Insurance"),
  v("M.E. Janitorial", "Janitorial"),
  v("Nesconset Auto Service", "Vehicle Repair & Maintenance"),
  v("Nesconset Fuel", "Vehicle expenses"),
  v("Delta Gas", "Vehicle expenses"),
  v("Speedway", "Vehicle expenses"),
  v("BJ'S WHOLESALE", "Office supplies", "BJ's Wholesale Club"),
  v("Bank of America Monthly Fee", "Bank Fees"),
];

const EXCEPTIONS: RulebookRule[] = [
  exception(
    "Promise Floral",
    "Seller Note Split",
    "~$4,200 'Payments and Invoicing payment to Promise Floral' is the SELLER NOTE — split principal/interest per amortization. NOT a flower purchase. Distinguish from real Promise Floral COGS by amount (~4200) and description.",
  ),
  exception(
    "Discover e-payment",
    "Owner draw",
    "Personal credit card payment — NOT a business expense.",
  ),
  exception(
    "TRANSFER to Kaela Gabrell",
    "Owner draw — Kaela",
    "Weekly owner draw via bank transfer.",
  ),
  // NYS DTF guard (V3): NY tax payments must NEVER be auto-booked to Sales Tax
  // Payable — the real BOA descriptor ("NYS DTF BILL PYT DES:Tax Paymnt") does
  // NOT say whether it's sales tax or personal income tax (PIT). Flag for owner
  // review instead of guessing. The PIT-vs-SALES distinction is the owner's call.
  exception(
    "NYS DTF",
    "Uncategorized",
    "NY tax payment (e.g. 'NYS DTF BILL PYT'). The bank does NOT encode sales-tax vs personal income tax — STOP and ask owner: SALES → Sales Tax Payable, PIT/personal → Owner draw, processing fee → Bank Fees. Never auto-book to Sales Tax Payable.",
  ),
];

export function getRulebookRules(): RulebookRule[] {
  return [...EXCEPTIONS, ...REVENUE, ...COGS, ...PAYROLL, ...SOFTWARE, ...OTHER];
}

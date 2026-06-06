# Towers Flowers Bookkeeping Agent — Design Spec

**Date:** 2026-06-06
**Client:** Benjy Baptiste — Mimosa Collective LLC (DBA Towers Flowers), Brooklyn NY
**Contract:** Upwork, $1,000 fixed, 2 milestones ($500 Kickoff + $500 Handoff)
**Author:** Kamil

---

## 1. Goal

An AI-assisted monthly bookkeeping tool for one client (Benjy). It pulls transactions from the business's financial sources, categorizes them using Claude against the client's rulebook, lets Benjy review by category and intervene on exceptions, and posts approved entries to QuickBooks Online — with a full audit trail. Turns a multi-day manual close into minutes of review.

**Explicit non-goal (confirmed by data):** This tool does NOT do reconciliation, A/R/A/P aging, or management reporting. The client already employs an external accountant ("Kept LLC") who produces P&L, Balance Sheet, Cash Flow, and aging reports. The agent's job ends at "categorized transactions posted to QBO." Kept LLC's reports serve as ground-truth validation, not a feature to replicate.

## 2. Scope

### In scope (6 sources from the contract brief)
1. **Shopify** — via official Admin REST API (or Shopify MCP)
2. **Hana POS** — XLSX *and* PDF (format drifts month to month; parser handles both)
3. **HoneyBook** — two CSVs: Payments report + Booked Clients report
4. **AmEx** — text PDF, 3 cardholders in one file (7-02009 Kaela, 7-01019 Kaela fuel, 7-02025 Benjy)
5. **Bank of America Checking** (-2300) — text PDF
6. **Bank of America / BankAmericard Credit Card** (-2797) — text PDF

### Out of scope (Phase 2 / separate engagement)
- Perri Farms statement parser (accrued COGS)
- Van (North Mill) + Mazda statement parsers
- Reconciliation, A/R/A/P aging, management summary (Kept LLC does this)
- Multi-entity QBO, multi-currency, split transactions, scanned-PDF OCR
- Natural-language rule assistant (plain-language chatbot for rules)

### Posting decisions (defaults adopted; schema flexible to change later)
- **Hana** → monthly category summary (pairs with grouped approval)
- **HoneyBook** → per-installment (each payment a separate transaction)
- **Entity** → single QBO account (Mimosa LLC; DBA noted in transaction descriptions)

## 3. Architecture — 3 layers

**Layer 1 — Source connectors** (`lib/sources/*`): each source is an independent module returning a normalized `Transaction[]`. One source failing must not break the others. PDF parsers use positional extraction (pdf word coordinates), NOT naive line text — amounts detach from descriptions in raw text extraction.

**Layer 2 — Categorization agent** (`lib/agent/*`): Claude reads rulebook rules (stored in DB, not hardcoded) + batch of transactions → returns `{suggested_category, suggested_vendor, confidence, reasoning, matched_rule_id}` via structured output. Prompt caching on the (large, stable) rulebook context. Model: Claude Sonnet 4.6 for categorization.

**Layer 3 — Output/posting** (`lib/qbo/*`): QBO REST API, OAuth 2.0 with token refresh, sandbox first. Idempotency via `external_id` check before every post. Failed posts → retry queue, never silent. Audit log entry per action.

## 4. Data model (Supabase Postgres, RLS enabled from day 1)

- `users` — Supabase Auth, single user (Benjy) at MVP, role admin/viewer
- `monthly_runs` — one per month-close; status state machine (pending→parsing→categorizing→awaiting_approval→posting→complete/error); source_summary jsonb
- `transactions` — core table; source, external_id, date, amount, raw_data jsonb, suggested_* + confidence + reasoning + matched_rule_id, status (pending/auto_approved/manually_approved/skipped/posted/post_failed), approved_* fields, qbo_journal_entry_id, qbo_post_error
- `rulebook_rules` — rule_type (vendor_match/category_default/exception), pattern, category, vendor, priority, notes — editable by Benjy in-app
- `audit_log` — append-only (insert-only RLS, no update/delete); action, before_state, after_state, user_id, timestamp

## 5. Categorization logic (from rulebook — the "brain")

Code to revenue SOURCE not payment METHOD. Key patterns:
- `CLEARENT LLC DES:Deposits` → Hana Sales
- `MIMOSA COLLECTIV DES:[Name]` → Honeybook Sales (cross-match to HoneyBook Payments CSV by name+amount; Damla Ates = two projects, match by installment amount)
- `Shopify DES:TRANSFER` → Shopify Sales
- `BKOFAMERICA ATM ... NESCONSET` / `Counter Credit` → Hana Sales (cash)
- Vendor→category: Perri/Delaware Valley/Promise/J.Merullo/David Shannon/Giuntas → COGS
- `Payments and Invoicing payment to Promise Floral ~$4,200` → seller note split (principal/interest per amortization), NOT a flower purchase
- ADP → Salaries/Taxes/Fees; Zelle Ashley Edgar $184.76 → Salaries; Zelle named contractors → Contract labor
- Personal cards / Discover → Owner draw / Owner Loan liability (not expenses)
- Software vendors (Adobe, Slack, Claude.ai, etc.) → Software subscriptions
- Anything unmatched / low confidence → exception queue, never silently coded

QBO account names taken from Kept LLC P&L (ground truth): Shopify/Hana/Honeybook Sales, Cost of goods sold, Bank Fees, Hana Wire Fee, Honeybook/Shopify Fees, Commissions & fees, Contract labor, Insurance, Interest paid, Accounting fees, Meals, Office supplies, Rent, Software & apps, Utilities, Payroll (Fees/Taxes/Salaries & wages).

## 6. UI

Single dashboard at `/dashboard`:
- **Run controls** — current month status card, "Run Monthly Close" button, progress, last run timestamp
- **Grouped approval** (client's explicit request) — transactions grouped by category (Hana Sales, HoneyBook, COGS as blocks); approve whole groups; drill into individual rows only for exceptions (low confidence / edge cases)
- **Final commit** — summary count, "Approve All & Post to QuickBooks" with confirm modal
- `/history` — past runs + audit log
- `/settings` — **visible editable rules table** (plain-language rules Benjy edits himself, no redeploy), integration connect/disconnect, sandbox/prod toggle
- `/login` — Supabase Auth (email+password)
- Mobile-first responsive (Benjy may review from phone)
- Dark theme, shadcn/ui, no emoji, components ≤200-300 lines

## 7. Monthly summary email (Resend)

After successful post: transaction counts, revenue by source, top expense categories, link to dashboard. Plain HTML + text fallback. No charts, no PDF.

## 8. Security

RLS on all tables; service-role key server-only; API keys (Shopify/QBO/Claude/Resend) in Vercel env vars never committed; OAuth refresh tokens encrypted in Supabase; audit log non-deletable; email+password auth at MVP.

## 9. Build order (single continuous plan; milestones billed by progress)

1. Repo scaffold (Next.js 14 + TS strict + Tailwind + shadcn) + Supabase project + schema + RLS + Vercel deploy + auth + protected dashboard
2. Normalized `Transaction` type + source-connector interface
3. Parsers easiest→hardest: HoneyBook CSV → Hana (XLSX+PDF) → BankAmericard PDF → BoA Checking PDF → AmEx PDF → Shopify API
4. Rulebook parser + `rulebook_rules` seeding from rulebook.md
5. Claude categorization (structured output + prompt caching + confidence/exception)
6. Dashboard: run trigger + grouped approval + exception drill-down
7. Editable rules table on /settings
8. QBO OAuth + posting + idempotency + audit (sandbox) — last, riskiest
9. Resend summary email + /history + polish + mobile QA
10. End-to-end test on real April 2026 data, validate sums vs Kept LLC P&L

## 10. Testing strategy

- Parsers: TDD against the real sample files (Apr + May 2026). Each parser has a test asserting known totals (e.g. Hana Net Taxable $48,032.00; BoA Apr 73 deposits/39 withdrawals).
- Categorization: test rule-matching against known transactions from samples.
- Ground-truth validation: categorized revenue totals must reconcile against Kept LLC P&L (Apr: Hana $50,681.98, HoneyBook $28,117.84, Shopify $2,587.90 sales).
- QBO: sandbox posting + idempotency (re-run posts nothing twice).

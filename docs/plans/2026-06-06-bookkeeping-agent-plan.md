# Towers Flowers Bookkeeping Agent — Implementation Plan

> **For agentic workers:** Implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Each task ends with a commit. TDD where logic is non-trivial (parsers, categorization, idempotency).

**Goal:** An AI-assisted monthly bookkeeping tool that pulls transactions from 6 sources, categorizes them with Claude against the client's rulebook, lets Benjy review by category, and posts approved entries to QuickBooks Online with a full audit trail.

**Architecture:** 3 layers — source connectors (`lib/sources/`) → categorization agent (`lib/agent/`) → QBO posting (`lib/qbo/`). Next.js App Router front-end, Supabase Postgres backend with RLS, deployed on Vercel.

**Tech Stack:** Next.js 14 (App Router), TypeScript strict, Tailwind, shadcn/ui, Supabase, Claude API (Sonnet 4.6), QuickBooks REST API, Resend, Vercel.

**Project root:** `c:\Users\Kamil\Desktop\Freelance work\benjy-bookkeeping\`

**Sample data for tests:** `benjy-bookkeeping/samples/` (real Apr + May 2026 files).

---

## Ground-truth values (from Kept LLC P&L — assert against these in parser/categorization tests)

- Hana Net Taxable Sales (Apr): `$48,032.00`; Net Non-Taxable: `$6,407.28`
- Hana Sales total (Apr P&L): `$50,681.98`
- HoneyBook Sales (Apr P&L): `$28,117.84`
- Shopify Sales (Apr P&L): `$2,587.90`
- BoA Checking Apr: 73 deposits/credits, 39 withdrawals/debits, ending balance `$12,724.32`
- BankAmericard Apr: New Balance `$10,316.79`, Purchases `$438.86`
- AmEx Apr: 3 cardholders (7-02009, 7-01019, 7-02025)

---

## TASK 0: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.mjs`, `app/layout.tsx`, `app/page.tsx`, `.gitignore`, `.env.local.example`

- [ ] **Step 1: Init Next.js 14 + TS + Tailwind**
```bash
cd "c:/Users/Kamil/Desktop/Freelance work/benjy-bookkeeping"
npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir=false --import-alias "@/*" --no-turbopack
```
Expected: scaffolds Next.js. If prompted to overwrite existing files (docs/, samples/), keep them.

- [ ] **Step 2: Enable TS strict + set up shadcn**
Ensure `tsconfig.json` has `"strict": true`. Then:
```bash
npx shadcn@latest init -d
npx shadcn@latest add button card table tabs dialog input badge select toast sonner
```

- [ ] **Step 3: Create `.env.local.example` with all required keys (no values)**
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
QBO_CLIENT_ID=
QBO_CLIENT_SECRET=
QBO_REDIRECT_URI=
QBO_ENVIRONMENT=sandbox
SHOPIFY_STORE_DOMAIN=
SHOPIFY_ADMIN_TOKEN=
RESEND_API_KEY=
ENCRYPTION_KEY=
```

- [ ] **Step 4: Add `.gitignore` entries**
Ensure `.env.local`, `samples/`, `node_modules/`, `.next/` are ignored. (samples/ contains client financial data — must NOT be committed.)

- [ ] **Step 5: Verify build**
Run: `npm run build`
Expected: builds with exit 0.

- [ ] **Step 6: Init git + first commit**
```bash
git init
git add -A
git commit -m "chore: scaffold Next.js 14 + TS + Tailwind + shadcn"
```

---

## TASK 1: Supabase project + schema + RLS

**Files:**
- Create: `supabase/migrations/0001_init.sql`, `lib/supabase/server.ts`, `lib/supabase/client.ts`, `types/db.ts`

- [ ] **Step 1: Create Supabase project**
Create a new Supabase project (Kamil's account; transfer to Benjy at handoff). Copy URL + anon key + service-role key into `.env.local`.

- [ ] **Step 2: Write migration `0001_init.sql`**
Tables exactly per spec section 4: `users`, `monthly_runs`, `transactions`, `rulebook_rules`, `audit_log`. Include:
- `transactions.external_id` unique per source (for idempotency)
- `audit_log` insert-only (no update/delete grants)
- All tables `enable row level security`
- RLS policies: authenticated user can select/insert/update own rows; `audit_log` allows insert + select only (NO update/delete)
- Indexes: `transactions(monthly_run_id)`, `transactions(source, external_id)`, `rulebook_rules(rule_type, priority)`

- [ ] **Step 3: Apply migration**
Run via Supabase SQL editor or CLI. Verify tables exist.

- [ ] **Step 4: Generate typed DB types**
```bash
npx supabase gen types typescript --project-id <id> > types/db.ts
```

- [ ] **Step 5: Supabase clients**
`lib/supabase/server.ts` — server client using service-role key (server-only, never imported in client components). `lib/supabase/client.ts` — browser client using anon key.

- [ ] **Step 6: Commit**
```bash
git add -A && git commit -m "feat: supabase schema, RLS, typed clients"
```

---

## TASK 2: Auth + protected dashboard shell

**Files:**
- Create: `app/login/page.tsx`, `app/dashboard/page.tsx`, `middleware.ts`, `lib/supabase/middleware.ts`

- [ ] **Step 1: Supabase Auth middleware**
`middleware.ts` redirects unauthenticated users to `/login`; protects `/dashboard`, `/history`, `/settings`.

- [ ] **Step 2: Login page**
Email + password form (shadcn) → Supabase `signInWithPassword`. Dark theme, centered card.

- [ ] **Step 3: Dashboard shell**
`/dashboard` — protected, shows "Towers Flowers — Monthly Close" header + placeholder. Sign-out button.

- [ ] **Step 4: Manually create Benjy's user**
Create one user in Supabase Auth dashboard + matching `users` row (role=admin).

- [ ] **Step 5: Verify auth flow**
Run `npm run dev`, confirm: unauthenticated → /login; login → /dashboard; sign out → /login.

- [ ] **Step 6: Commit**
```bash
git add -A && git commit -m "feat: supabase auth + protected dashboard shell"
```

---

## TASK 3: Vercel deploy (early, so env wiring is sorted)

- [ ] **Step 1: Push to GitHub** (Kamil's account, private repo)
- [ ] **Step 2: Import to Vercel**, set all env vars from `.env.local.example`
- [ ] **Step 3: Verify deployed login works** against Supabase
- [ ] **Step 4: Commit any config tweaks**
```bash
git add -A && git commit -m "chore: vercel deploy config"
```

---

## TASK 4: Normalized Transaction type + source interface

**Files:**
- Create: `types/transaction.ts`, `lib/sources/types.ts`

- [ ] **Step 1: Define `NormalizedTransaction`**
```typescript
export interface NormalizedTransaction {
  source: 'shopify' | 'hana' | 'honeybook' | 'amex' | 'boa_checking' | 'boa_credit';
  externalId: string;        // stable per-source id for idempotency
  date: string;              // ISO yyyy-mm-dd
  amount: number;            // positive = inflow/credit, negative = outflow/debit
  description: string;
  rawData: Record<string, unknown>; // original parsed row
}
```

- [ ] **Step 2: Define `SourceConnector` interface**
```typescript
export interface SourceConnector {
  source: NormalizedTransaction['source'];
  parse(input: ParseInput): Promise<NormalizedTransaction[]>;
}
export type ParseInput =
  | { kind: 'file'; path: string; mime: string }
  | { kind: 'api'; monthYear: string };
```

- [ ] **Step 3: Set up test runner**
```bash
npm i -D vitest
```
Add `"test": "vitest run"` to package.json scripts.

- [ ] **Step 4: Commit**
```bash
git add -A && git commit -m "feat: normalized transaction type + source connector interface"
```

---

## TASK 5: HoneyBook parser (easiest — proves the pipeline)

**Files:**
- Create: `lib/sources/honeybook.ts`, `lib/sources/honeybook.test.ts`

- [ ] **Step 1: Write failing test**
Test parses `samples/Honeybook April Payments.csv`, asserts: 22 transactions; first row client "Teresa Bebirian", amount `1162.06` (NET_AMOUNT), date `2026-04-08`; each transaction has `source: 'honeybook'`, externalId from INVOICE + PAYMENT_NAME.
```typescript
import { describe, it, expect } from 'vitest';
import { honeybookConnector } from './honeybook';

it('parses HoneyBook April payments CSV', async () => {
  const txs = await honeybookConnector.parse({ kind: 'file', path: 'samples/Honeybook April Payments.csv', mime: 'text/csv' });
  expect(txs.length).toBe(22);
  expect(txs[0].description).toContain('Teresa Bebirian');
  expect(txs[0].amount).toBeCloseTo(1162.06, 2);
  expect(txs[0].source).toBe('honeybook');
});
```

- [ ] **Step 2: Run test, verify it fails** — `npx vitest run lib/sources/honeybook.test.ts` → FAIL (module not found)

- [ ] **Step 3: Implement parser**
Use `papaparse` (`npm i papaparse @types/papaparse`). Map: amount=NET_AMOUNT, date=TRANSACTION_DATE (parse "Apr 08, 2026"→ISO), description=`${CLIENT_INFO} — ${PAYMENT_NAME}`, externalId=`hb_${INVOICE}_${PAYMENT_NAME}`, rawData=full row. Skip empty rows.

- [ ] **Step 4: Run test, verify pass**

- [ ] **Step 5: Add Booked Clients parser** (separate function `parseBookedClients`) — test against `samples/Honeybook April-2026-Booked Client-report.csv`. (Used later for A/R context, not posted.)

- [ ] **Step 6: Commit**
```bash
git add -A && git commit -m "feat: HoneyBook CSV parser (payments + booked clients)"
```

---

## TASK 6: Hana POS parser (XLSX + PDF, both formats)

**Files:**
- Create: `lib/sources/hana.ts`, `lib/sources/hana.test.ts`

- [ ] **Step 1: Write failing test (XLSX)**
Parse `samples/Hana April Report.xlsx`, assert Net Taxable Sales `$48,032.00` and Net Non-Taxable `$6,407.28` are extracted into category rows.
```typescript
it('parses Hana April XLSX summary', async () => {
  const txs = await hanaConnector.parse({ kind: 'file', path: 'samples/Hana April Report.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const netTaxable = txs.find(t => t.description.includes('Net Taxable'));
  expect(netTaxable?.amount).toBeCloseTo(48032.00, 2);
});
```

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement XLSX parser**
Use `xlsx` (SheetJS, `npm i xlsx`). Read Daily Posting Summary; extract the category-summary rows (Cash Sales, Credit Card Sales, Net Taxable Sales, Sales Tax, etc.) into one NormalizedTransaction per meaningful line. monthYear from "Order dates" cell. externalId=`hana_${monthYear}_${lineLabel}`.

- [ ] **Step 4: Run, verify pass (XLSX)**

- [ ] **Step 5: Write failing test (PDF)** against `samples/May 2026 Hana Report.pdf` — assert it extracts comparable summary lines.

- [ ] **Step 6: Implement PDF branch**
Detect by mime/extension. Use pdf text extraction (see Task 7 helper). Map same logical lines. Return same NormalizedTransaction shape so downstream is format-agnostic.

- [ ] **Step 7: Run both tests, verify pass**

- [ ] **Step 8: Commit**
```bash
git add -A && git commit -m "feat: Hana POS parser (XLSX + PDF)"
```

---

## TASK 7: PDF extraction helper (positional)

**Files:**
- Create: `lib/sources/pdf-utils.ts`, `lib/sources/pdf-utils.test.ts`

> Critical: amounts detach from descriptions in naive text extraction. Use positional (word + bbox) extraction so each row's amount pairs with its description by y-coordinate.

- [ ] **Step 1: Install** `npm i pdfjs-dist` (or `unpdf`). Choose one that exposes per-word x/y coordinates in Node.

- [ ] **Step 2: Write failing test**
Extract words-with-positions from `samples/BOA Credit Card.pdf`, assert it finds "New Balance Total" near amount `10,316.79` on the same line (y within tolerance).

- [ ] **Step 3: Implement `extractWords(path): Promise<Word[]>`** where `Word = { text, x, y, page }`. Add helper `groupRowsByY(words, tolerance)` → rows; helper `findAmountInRow(row)` → rightmost currency token.

- [ ] **Step 4: Run, verify pass**

- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "feat: positional PDF extraction helper"
```

---

## TASK 8: BankAmericard parser (easiest PDF)

**Files:**
- Create: `lib/sources/boa-credit.ts`, `lib/sources/boa-credit.test.ts`

- [ ] **Step 1: Write failing test** against `samples/BOA Credit Card.pdf` — assert New Balance `10316.79`, purchases total `438.86`, and that individual charge rows are extracted with date+amount+description.

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement** using `pdf-utils`. Locate "Charges" / transaction section, extract rows (date, description, amount). source='boa_credit'. externalId=`boacc_${date}_${amount}_${descHash}`.

- [ ] **Step 4: Run, verify pass**

- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "feat: BankAmericard PDF parser"
```

---

## TASK 9: BoA Checking parser (high volume, multi-line)

**Files:**
- Create: `lib/sources/boa-checking.ts`, `lib/sources/boa-checking.test.ts`

- [ ] **Step 1: Write failing test** against `samples/BOA April Statement (checking).pdf` — assert 73 deposits + 39 withdrawals (112 total transactions), ending balance context, and that a known row (`CLEARENT LLC DES:Deposits`) is captured with its amount.

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement section-aware parser**
Identify sections: "Deposits and other credits" (positive), "Withdrawals and other debits" (negative), "Checks", "Service fees". Handle multi-line descriptions (DES:/ID:/INDN: continuation lines belong to the preceding dated row). Pair amount by y-coordinate using pdf-utils. Deposits sign +, withdrawals/debits/fees sign −.

- [ ] **Step 4: Run, verify pass (counts match 73/39)**

- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "feat: BoA Checking PDF parser (section-aware, multi-line)"
```

---

## TASK 10: AmEx parser (3 cardholders)

**Files:**
- Create: `lib/sources/amex.ts`, `lib/sources/amex.test.ts`

- [ ] **Step 1: Write failing test** against `samples/AMEX April Statement.pdf` — assert transactions tagged with cardholder (7-02009/7-01019/7-02025), multi-line merchant names joined, payments (negative) separated from charges (positive).

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement** using pdf-utils. Segment by "Card Ending X" headers → tag each transaction with `rawData.cardholder`. Join multi-line merchant (continuation lines without a leading date belong to prior row). Skip "ONLINE PAYMENT/AUTOPAY" from charges (those are payments). source='amex'. externalId=`amex_${card}_${date}_${amount}_${descHash}`.

- [ ] **Step 4: Run, verify pass**

- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "feat: AmEx PDF parser (3 cardholders, multi-line merchants)"
```

---

## TASK 11: Shopify connector (API)

**Files:**
- Create: `lib/sources/shopify.ts`, `lib/sources/shopify.test.ts`

> Blocked on Benjy's Shopify token (app dev in progress). Build against API shape; test with mocked fetch until token available.

- [ ] **Step 1: Write test with mocked Admin API response** — assert orders map to NormalizedTransaction (date, total, fees, refunds) for a given month.

- [ ] **Step 2: Implement** Admin REST `GET /admin/api/2024-../orders.json?status=any&created_at_min=...&created_at_max=...`. Map order→tx. source='shopify'. externalId=`shopify_${order.id}`. Handle pagination + 429.

- [ ] **Step 3: Run, verify pass (mocked)**

- [ ] **Step 4: Commit**
```bash
git add -A && git commit -m "feat: Shopify Admin API connector"
```

---

## TASK 12: Rulebook → rulebook_rules seeding

**Files:**
- Create: `lib/rulebook/parse.ts`, `lib/rulebook/seed.ts`, `lib/rulebook/parse.test.ts`

- [ ] **Step 1: Write failing test** — parse `samples/rulebook.md`, assert it extracts structured rules (e.g. a vendor_match rule for "CLEARENT LLC"→"Hana Sales", "Perri Farms"→"Cost of goods sold", "Adobe"→"Software subscriptions").

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement parser** — extract the explicit vendor→category and pattern→category mappings from the rulebook markdown into `{rule_type, pattern, category, vendor, priority}` rows. Hardcode the well-defined ones; leave ambiguous ones as `category_default`/`exception` placeholders.

- [ ] **Step 4: Seed script** writes rows into `rulebook_rules` (idempotent upsert by pattern).

- [ ] **Step 5: Run test + seed against Supabase, verify rows present**

- [ ] **Step 6: Commit**
```bash
git add -A && git commit -m "feat: rulebook parser + rulebook_rules seeding"
```

---

## TASK 13: Claude categorization agent

**Files:**
- Create: `lib/agent/categorize.ts`, `lib/agent/schema.ts`, `lib/agent/categorize.test.ts`

- [ ] **Step 1: Install** `npm i @anthropic-ai/sdk`

- [ ] **Step 2: Define structured-output schema** (`schema.ts`): `{transaction_id, suggested_category, suggested_vendor, confidence, reasoning, matched_rule_id}`.

- [ ] **Step 3: Write test** — given a known transaction ("CLEARENT LLC DES:Deposits", +$2371) + seeded rules, assert Claude returns category "Hana Sales" with high confidence. (Integration test, real API, small batch.)

- [ ] **Step 4: Implement** `categorize(transactions, rules)`:
  - Build system prompt with rulebook rules as context; **prompt-cache** the rules block.
  - Send batch of transactions; model `claude-sonnet-4-6`; force structured output (tool use).
  - Confidence <85 → flag as exception. Return validated objects.

- [ ] **Step 5: Run test, verify pass**

- [ ] **Step 6: Commit**
```bash
git add -A && git commit -m "feat: Claude categorization agent (structured output + prompt caching)"
```

---

## TASK 14: Monthly run orchestration (server action)

**Files:**
- Create: `app/actions/run-close.ts`, `lib/run/orchestrate.ts`

- [ ] **Step 1: Implement `runMonthlyClose(monthYear, files)`**
  - Create `monthly_runs` row (status=parsing)
  - Run each source connector (isolated try/catch per source; record failures in source_summary)
  - Insert NormalizedTransactions into `transactions` (dedupe by source+external_id)
  - status=categorizing → call categorize → update transactions with suggestions
  - status=awaiting_approval
  - Write audit_log entries

- [ ] **Step 2: Wire as Next.js server action** triggered by dashboard button. File upload (Drive files for the month) handled via upload form or Drive fetch.

- [ ] **Step 3: Manual test** with real April samples → verify transactions land in DB categorized.

- [ ] **Step 4: Commit**
```bash
git add -A && git commit -m "feat: monthly run orchestration server action"
```

---

## TASK 15: Dashboard — run trigger + grouped approval

**Files:**
- Create: `app/dashboard/page.tsx` (expand), `components/run-controls.tsx`, `components/category-group.tsx`, `components/exception-row.tsx`, `app/actions/approve.ts`

- [ ] **Step 1: Run controls** — status card, "Run Monthly Close" button, progress, file upload for the month.
- [ ] **Step 2: Grouped approval view** — transactions grouped by `suggested_category`; each group shows count + total + "Approve group" button. (Client's explicit request.)
- [ ] **Step 3: Exception drill-down** — low-confidence/exception transactions listed individually with: accept suggestion / edit category (select) / edit vendor / add note / skip.
- [ ] **Step 4: Approve actions** (`approve.ts`) — update transaction status; write audit_log (before/after). Bulk approve a group in one action.
- [ ] **Step 5: Mobile responsive** — thumb-sized approve buttons, test breakpoints.
- [ ] **Step 6: Commit**
```bash
git add -A && git commit -m "feat: dashboard grouped approval + exception drill-down"
```

---

## TASK 16: Editable rules table (/settings)

**Files:**
- Create: `app/settings/page.tsx`, `components/rules-table.tsx`, `app/actions/rules.ts`

- [ ] **Step 1: Rules table** — list `rulebook_rules` in plain language ("Transactions matching 'AMZN MKTPL' → Office Supplies"). Add / edit / delete rows.
- [ ] **Step 2: Rule edit actions** (`rules.ts`) — CRUD; write audit_log on every change (Benjy cares about traceability).
- [ ] **Step 3: Priority ordering** — visible priority number per rule.
- [ ] **Step 4: Verify** — add a rule, re-run categorization, confirm it applies.
- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "feat: editable rules table on settings"
```

---

## TASK 17: QBO OAuth + posting + idempotency + audit (sandbox, LAST)

**Files:**
- Create: `lib/qbo/oauth.ts`, `lib/qbo/post.ts`, `lib/qbo/accounts.ts`, `app/api/qbo/callback/route.ts`, `lib/qbo/post.test.ts`

- [ ] **Step 1: OAuth flow** — `/api/qbo/callback`; store encrypted refresh token in Supabase; token refresh helper.
- [ ] **Step 2: Chart of accounts lookup** (`accounts.ts`) — `GET /v3/company/{realmId}/accounts`; map our category names → QBO account IDs.
- [ ] **Step 3: Write failing idempotency test** — posting the same transaction twice posts only once (external_id check).
- [ ] **Step 4: Implement `postTransactions`** — journal entries per approved transaction; idempotency check before each; handle 429 with backoff; failures → status=post_failed + qbo_post_error (retry queue), never crash the run; write audit_log per post.
- [ ] **Step 5: Run idempotency test, verify pass**
- [ ] **Step 6: Final commit flow** — dashboard "Approve All & Post to QuickBooks" + confirm modal → calls postTransactions.
- [ ] **Step 7: Sandbox end-to-end test** — post April approved transactions to QBO sandbox, verify entries appear.
- [ ] **Step 8: Commit**
```bash
git add -A && git commit -m "feat: QBO OAuth + posting + idempotency + audit (sandbox)"
```

---

## TASK 18: Monthly summary email (Resend)

**Files:**
- Create: `lib/email/summary.ts`, `app/actions/send-summary.ts`

- [ ] **Step 1: Install** `npm i resend`
- [ ] **Step 2: Implement HTML+text email** — counts, revenue by source, top expense categories, dashboard link. No charts.
- [ ] **Step 3: Trigger** after successful post.
- [ ] **Step 4: Test send** to Kamil's email.
- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "feat: monthly summary email via Resend"
```

---

## TASK 19: History page + polish + QA

**Files:**
- Create: `app/history/page.tsx`, `components/audit-log-view.tsx`

- [ ] **Step 1: History page** — past `monthly_runs`, drill into any, view audit log.
- [ ] **Step 2: Full end-to-end test on real April 2026 data** — run close → categorize → review → post to sandbox.
- [ ] **Step 3: Ground-truth validation** — categorized revenue totals reconcile vs Kept LLC P&L (Hana $50,681.98, HoneyBook $28,117.84, Shopify $2,587.90). Investigate any mismatch.
- [ ] **Step 4: Mobile responsive QA** across breakpoints.
- [ ] **Step 5: Run full test suite** — `npm run test` → all pass; `npm run build` → exit 0.
- [ ] **Step 6: Commit**
```bash
git add -A && git commit -m "feat: history page + end-to-end QA"
```

---

## TASK 20: Handoff docs

**Files:**
- Create: `README.md`, `docs/RUNBOOK.md`

- [ ] **Step 1: README** — setup, env vars, local run, deploy.
- [ ] **Step 2: RUNBOOK** — how Benjy runs a monthly close, step by step.
- [ ] **Step 3: Env var list** — every key, where it comes from.
- [ ] **Step 4: Commit**
```bash
git add -A && git commit -m "docs: README + monthly close runbook"
```

---

## Self-review checklist (run after plan, before execution)
- [x] Every spec section maps to a task (sources→5-11, agent→13, QBO→17, UI→15-16, email→18, audit→throughout)
- [x] No placeholders — each step has concrete files/commands/assertions
- [x] Type consistency — `NormalizedTransaction` shape used identically across all parsers
- [x] Ground-truth values embedded for test assertions
- [x] samples/ gitignored (client financial data never committed)
- [x] QBO last (riskiest, external); Shopify mock-testable until token arrives

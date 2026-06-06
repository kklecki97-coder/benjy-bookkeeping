# Towers Flowers — Bookkeeping Agent

AI-assisted monthly bookkeeping for Mimosa Collective LLC (DBA Towers Flowers).
Pulls transactions from the business's financial sources, categorizes them with
Claude against the client's rulebook, lets the owner review by category, and posts
approved entries to QuickBooks Online — with a full audit trail.

## Stack

- **Next.js (App Router)** + TypeScript (strict)
- **Tailwind + shadcn/ui**, dark theme
- **Supabase** (Postgres + Auth + RLS)
- **Claude API** (Sonnet 4.6) — categorization with structured output + prompt caching
- **QuickBooks Online REST API** — OAuth 2.0, journal-entry posting
- **Resend** — monthly summary email
- **Vercel** — hosting

## Architecture (3 layers)

1. **Source connectors** (`lib/sources/`) — one module per source, each returns a
   normalized `Transaction[]`. PDF parsers use positional extraction (`pdf-utils.ts`).
2. **Categorization agent** (`lib/agent/`) — Claude reads `rulebook_rules` from the DB
   and returns category + confidence + reasoning per transaction.
3. **Posting** (`lib/qbo/`) — OAuth, chart-of-accounts lookup, idempotent journal entries.

Orchestration (`lib/run/orchestrate.ts`) ties them together for a monthly close.

## Sources (Phase 1)

| Source | Format | Parser |
|---|---|---|
| HoneyBook | CSV (payments + booked) | `lib/sources/honeybook.ts` |
| Hana POS | XLSX or PDF | `lib/sources/hana.ts` |
| AmEx | text PDF (3 cardholders) | `lib/sources/amex.ts` |
| BoA Checking | text PDF | `lib/sources/boa-checking.ts` |
| BankAmericard | text PDF | `lib/sources/boa-credit.ts` |
| Shopify | Admin REST API | `lib/sources/shopify.ts` |

## Local setup

```bash
npm install
cp .env.local.example .env.local   # fill in the values (see below)
npm run dev                         # http://localhost:3000
```

### Environment variables (`.env.local`)

| Variable | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase -> Settings -> API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase -> Settings -> API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase -> Settings -> API (secret) |
| `ANTHROPIC_API_KEY` | console.anthropic.com -> API Keys |
| `QBO_CLIENT_ID` | developer.intuit.com -> your app -> Keys (Development = sandbox) |
| `QBO_CLIENT_SECRET` | same |
| `QBO_REDIRECT_URI` | `http://localhost:3000/api/qbo/callback` (local) |
| `QBO_ENVIRONMENT` | `sandbox` or `production` |
| `SHOPIFY_STORE_DOMAIN` | Shopify admin -> custom app |
| `SHOPIFY_ADMIN_TOKEN` | Shopify admin -> custom app (token) |
| `RESEND_API_KEY` | resend.com -> API Keys |
| `ENCRYPTION_KEY` | 32-byte hex: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

**Never commit `.env.local` or the `samples/` folder — both are gitignored (client data).**

## Database

Migrations in `supabase/migrations/`. Apply with the Supabase CLI:

```bash
npx supabase link --project-ref <ref>
npx supabase db push
```

Seed categorization rules from the rulebook (idempotent — see `lib/rulebook/seed.ts`).

## Tests

```bash
npm run test     # vitest — parsers validated against real sample sums
npm run build    # type-check + production build
```

Parser tests assert against ground-truth totals (Hana Net Taxable $48,032.00,
BoA Checking 73 deposits, AmEx charges $27,787.85) taken from the Kept LLC P&L reports.

## Deploy

Push to GitHub -> Vercel auto-deploys. Set all env vars in Vercel -> Settings ->
Environment Variables. After deploy, set the production Redirect URI in Intuit and
the Supabase Auth Site URL to the Vercel domain.

## Monthly close

See [`docs/RUNBOOK.md`](docs/RUNBOOK.md) for the step-by-step owner workflow.

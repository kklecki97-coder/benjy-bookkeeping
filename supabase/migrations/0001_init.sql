-- Towers Flowers Bookkeeping Agent — initial schema
-- Tables: users, monthly_runs, transactions, rulebook_rules, audit_log
-- RLS enabled from day 1. audit_log is insert-only (append-only history).

-- ============================================================
-- USERS (mirrors Supabase Auth; single user Benjy at MVP)
-- ============================================================
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  role text not null default 'admin' check (role in ('admin', 'viewer')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- MONTHLY_RUNS (one per monthly close)
-- ============================================================
create table if not exists public.monthly_runs (
  id uuid primary key default gen_random_uuid(),
  month_year text not null,                  -- e.g. "2026-04"
  status text not null default 'pending'
    check (status in ('pending','parsing','categorizing','awaiting_approval','posting','complete','error')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  source_summary jsonb,                       -- { source: { count, error } }
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- TRANSACTIONS
-- ============================================================
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  monthly_run_id uuid not null references public.monthly_runs(id) on delete cascade,
  source text not null
    check (source in ('shopify','hana','honeybook','amex','boa_checking','boa_credit')),
  external_id text not null,                  -- source's own id, for idempotency
  transaction_date date,
  amount numeric(12,2) not null,              -- + inflow / - outflow
  description text,
  raw_data jsonb,
  -- categorization (from Claude)
  suggested_category text,
  suggested_vendor text,
  confidence integer,                          -- 0-100
  reasoning text,
  matched_rule_id uuid,
  -- review/approval
  status text not null default 'pending'
    check (status in ('pending','auto_approved','manually_approved','skipped','posted','post_failed')),
  approved_category text,
  approved_vendor text,
  user_note text,
  approved_at timestamptz,
  -- posting
  posted_at timestamptz,
  qbo_journal_entry_id text,
  qbo_post_error text,
  created_at timestamptz not null default now(),
  unique (source, external_id)                 -- idempotency guard
);

create index if not exists idx_transactions_run on public.transactions(monthly_run_id);
create index if not exists idx_transactions_source_ext on public.transactions(source, external_id);
create index if not exists idx_transactions_status on public.transactions(status);

-- ============================================================
-- RULEBOOK_RULES (editable by Benjy in-app)
-- ============================================================
create table if not exists public.rulebook_rules (
  id uuid primary key default gen_random_uuid(),
  rule_type text not null
    check (rule_type in ('vendor_match','category_default','exception')),
  pattern text not null,                       -- e.g. "AMZN MKTPL" or "CLEARENT LLC"
  category text,
  vendor text,
  priority integer not null default 100,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rules_type_priority on public.rulebook_rules(rule_type, priority);

-- ============================================================
-- AUDIT_LOG (append-only — no update/delete policy granted)
-- ============================================================
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  monthly_run_id uuid references public.monthly_runs(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  action text not null,                        -- approved/edited/posted/post_failed/rule_changed
  before_state jsonb,
  after_state jsonb,
  user_id uuid references public.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_run on public.audit_log(monthly_run_id);
create index if not exists idx_audit_tx on public.audit_log(transaction_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.users          enable row level security;
alter table public.monthly_runs   enable row level security;
alter table public.transactions   enable row level security;
alter table public.rulebook_rules enable row level security;
alter table public.audit_log      enable row level security;

-- USERS: a user can read/update their own row
create policy "users_select_own" on public.users
  for select using (auth.uid() = id);
create policy "users_update_own" on public.users
  for update using (auth.uid() = id);

-- MONTHLY_RUNS: any authenticated user (single-tenant MVP) full access
create policy "runs_all_auth" on public.monthly_runs
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- TRANSACTIONS: any authenticated user full access
create policy "tx_all_auth" on public.transactions
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- RULEBOOK_RULES: any authenticated user full access (Benjy edits in-app)
create policy "rules_all_auth" on public.rulebook_rules
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- AUDIT_LOG: insert + select ONLY. No update/delete policy => append-only.
create policy "audit_insert_auth" on public.audit_log
  for insert with check (auth.role() = 'authenticated');
create policy "audit_select_auth" on public.audit_log
  for select using (auth.role() = 'authenticated');

-- ============================================================
-- updated_at trigger for rulebook_rules
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

create trigger trg_rules_updated_at
  before update on public.rulebook_rules
  for each row execute function public.set_updated_at();

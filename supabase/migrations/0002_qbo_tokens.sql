-- QuickBooks Online OAuth tokens (single connection at MVP).
-- refresh_token stored encrypted (AES-256-GCM) via lib/qbo/crypto.ts.

create table if not exists public.qbo_connection (
  id uuid primary key default gen_random_uuid(),
  realm_id text not null,                 -- QBO company id
  access_token text,                       -- short-lived; refreshed as needed
  refresh_token_enc text not null,         -- encrypted refresh token
  access_expires_at timestamptz,
  environment text not null default 'sandbox',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.qbo_connection enable row level security;

create policy "qbo_all_auth" on public.qbo_connection
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create trigger trg_qbo_updated_at
  before update on public.qbo_connection
  for each row execute function public.set_updated_at();

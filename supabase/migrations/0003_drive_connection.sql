-- Google Drive OAuth connection (single connection at MVP).
-- refresh_token stored encrypted (AES-256-GCM) via lib/qbo/crypto.ts.

create table if not exists public.drive_connection (
  id uuid primary key default gen_random_uuid(),
  access_token text,
  refresh_token_enc text not null,
  access_expires_at timestamptz,
  folder_id text,                          -- configured monthly-files folder
  account_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.drive_connection enable row level security;

create policy "drive_all_auth" on public.drive_connection
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create trigger trg_drive_updated_at
  before update on public.drive_connection
  for each row execute function public.set_updated_at();

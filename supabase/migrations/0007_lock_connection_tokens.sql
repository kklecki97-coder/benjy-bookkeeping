-- Lock down the secret-bearing connection tables.
--
-- Before: qbo_connection and drive_connection had a `for all` policy granting
-- any authenticated (anon-key) session full read/write — meaning a logged-in
-- user could read the live QBO access token + encrypted refresh token straight
-- from the browser. The app never actually needs that: all real token reads and
-- writes go through the service-role client (lib/qbo/oauth.ts, lib/drive/auth.ts),
-- which bypasses RLS. The only anon-side read is connection STATUS for the
-- settings page (environment / folder_id) — exposed via the views below.
--
-- After: no client-readable policy on the token tables (anon sessions get zero
-- rows; service-role still works), plus non-secret status views for the UI.

-- 1. Drop the over-broad policies (token columns no longer client-readable).
drop policy if exists "qbo_all_auth" on public.qbo_connection;
drop policy if exists "drive_all_auth" on public.drive_connection;

-- 2. Non-secret status views for the settings page (no tokens exposed).
-- security_invoker=false (the default, stated explicitly) so the view runs with
-- the owner's rights and bypasses the base table's RLS — otherwise an
-- authenticated session would get zero rows now that the broad policy is gone.
-- Only non-secret columns are projected; tokens are never selected.
create or replace view public.qbo_status
  with (security_invoker = false) as
  select
    environment,
    (refresh_token_enc is not null) as connected
  from public.qbo_connection;

create or replace view public.drive_status
  with (security_invoker = false) as
  select
    folder_id,
    account_email,
    (refresh_token_enc is not null) as connected
  from public.drive_connection;

-- Views run with the definer's rights, so authenticated sessions can read the
-- non-secret status without any policy on the underlying token tables.
grant select on public.qbo_status to authenticated;
grant select on public.drive_status to authenticated;

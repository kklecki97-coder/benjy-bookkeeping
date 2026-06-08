-- Switch Drive from per-user OAuth to a service account.
-- The app now authenticates as a service account (key in env) and reads a
-- folder the owner shares with it, so the OAuth token columns are no longer
-- used. Make them nullable — the only field we still persist is folder_id.

alter table public.drive_connection
  alter column refresh_token_enc drop not null;

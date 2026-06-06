-- Fix: external_id uniqueness should be per-run, not global.
-- The same statement re-imported in a new run (re-run, or same file next month)
-- must not be silently dropped as a global duplicate. Idempotency for QBO
-- posting is handled separately via qbo_journal_entry_id + status.

alter table public.transactions
  drop constraint if exists transactions_source_external_id_key;

alter table public.transactions
  add constraint transactions_run_source_external_id_key
  unique (monthly_run_id, source, external_id);

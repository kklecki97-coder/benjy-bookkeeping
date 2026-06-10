-- Plain-English "month in review" narrative, generated once per run after
-- categorization and stored here (not regenerated on every page load).

alter table public.monthly_runs
  add column if not exists narrative text;

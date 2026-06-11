-- Close two latent auth traps the security review found. Both are inert today
-- (single manually-provisioned admin, no public signup, and nothing in the code
-- ever reads users.role — verified) but would bite the moment a second account
-- exists. We take the honest YAGNI path: drop the role pretense entirely rather
-- than ship a "viewer" tier the code doesn't enforce.

-- 1. Self-escalation: users_update_own had no WITH CHECK, so a user could
--    UPDATE their own row (incl. role) via the anon client. The app never
--    updates the users row at all, so just drop the policy.
drop policy if exists "users_update_own" on public.users;

-- 2. Dead role column: declared (admin/viewer) but read by zero code paths and
--    enforced by no RLS policy — it advertised access control that didn't exist.
--    Remove it so the schema honestly reflects the single-admin model.
alter table public.users drop column if exists role;

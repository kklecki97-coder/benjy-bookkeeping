# Monthly Close — Runbook

Step-by-step guide for running a monthly bookkeeping close. ~10 minutes.

## Before you start

Gather this month's source files from your accounts:

- **Hana POS** — Daily Posting Summary (XLSX or PDF)
- **HoneyBook** — Payments report (CSV)
- **AmEx** — monthly statement (PDF)
- **Bank of America Checking** — monthly statement (PDF)
- **BankAmericard** — monthly statement (PDF)

(Shopify is pulled automatically once connected — no file needed.)

## Steps

### 1. Log in

Go to the app, sign in with your email and password.

### 2. Run the close

On the dashboard:

1. Confirm the **Month** field (e.g. `2026-05`).
2. Click **Choose files** and select all this month's source files.
3. Click **Run Monthly Close**.

The agent parses every file and categorizes each transaction. This takes a minute.

### 3. Review by category

Transactions are grouped by category under **Auto-categorized**:

- Each group shows the count and total.
- Click a group to expand and see the individual transactions.
- If a group looks right, click **Approve group**.

You only need to look inside groups if something seems off.

### 4. Handle exceptions

Switch to the **Exceptions** tab. These are transactions the agent wasn't confident
about. For each one:

- **Accept suggestion** — if the agent's category is correct.
- **Edit** — change the category/vendor, add a note, and approve.
- **Skip** — if it shouldn't be posted.

### 5. Post to QuickBooks

When everything is approved, the bar at the bottom shows how many are ready.

1. Click **Approve All & Post to QuickBooks**.
2. Confirm in the dialog.

Approved transactions are posted as journal entries. Anything already posted is
skipped automatically (safe to re-run). You'll get a summary email when it's done.

### 6. Done

Check **History** to see the run and its audit log. Nothing is ever deleted —
every category, edit, approval, and post is recorded with a timestamp.

## Managing rules

Go to **Settings → Categorization Rules** to add, edit, or remove rules — for
example, when a new vendor appears. Changes apply on your next close. No engineer
needed; every change is logged.

## If something goes wrong

- **A file wasn't recognized** — check the filename contains the source name
  (e.g. "Hana", "Amex", "HoneyBook"). Rename if needed and re-run.
- **A transaction failed to post** — it's marked "post_failed" and stays in the
  queue. Re-running the post skips already-posted items and retries the failures.
- **QuickBooks disconnected** — reconnect under Settings → QuickBooks Online.

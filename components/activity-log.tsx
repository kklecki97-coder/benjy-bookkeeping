"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { activityBucket } from "@/lib/activity-filter";

export interface ActivityEntry {
  action: string;
  created_at: string;
  // Supabase stores these as Json (object | string | number | array | null);
  // we only read object shapes, guarded by asRecord().
  before_state?: unknown;
  after_state?: unknown;
  // transaction detail joined in the page (null for run-level actions)
  txDescription?: string | null;
  txAmount?: number | null;
  txSource?: string | null;
}

const COLLAPSED_COUNT = 3;

const SOURCE_LABELS: Record<string, string> = {
  hana: "Hana POS",
  honeybook: "HoneyBook",
  shopify: "Shopify",
  amex: "AmEx",
  boa_checking: "BoA Checking",
  boa_credit: "BankAmericard",
};

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v : null;

/** Coerce a Json value to a plain record we can read keys off, else {}. */
const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

/**
 * Primary line = the action + its concrete detail (category, rule, JE number).
 * Secondary line = which transaction it acted on (description + amount), when
 * the entry is tied to one. Run-level actions (approved_all_auto) have no tx.
 */
function describe(a: ActivityEntry): { action: string; detail: string | null } {
  const after = asRecord(a.after_state);
  const before = asRecord(a.before_state);

  switch (a.action) {
    case "approved": {
      const cat = str(after.category);
      return { action: cat ? `Approved → ${cat}` : "Approved", detail: txLine(a) };
    }
    case "approved_all_auto": {
      const n = typeof after.count === "number" ? after.count : null;
      return {
        action: n != null ? `Approved ${n} auto-categorized` : "Approved all auto-categorized",
        detail: null,
      };
    }
    case "edited": {
      const from = str(before.category);
      const to = str(after.category);
      const vendor = str(after.vendor);
      const base =
        from && to ? `Edited: ${from} → ${to}` : to ? `Edited → ${to}` : "Edited category";
      return { action: vendor ? `${base} (${vendor})` : base, detail: txLine(a) };
    }
    case "rule_created": {
      const pattern = str(after.pattern);
      const cat = str(after.category);
      return {
        action: pattern && cat ? `Rule: “${pattern}” → ${cat}` : "Created a rule",
        detail: null,
      };
    }
    case "skipped":
      return { action: "Skipped", detail: txLine(a) };
    case "posted": {
      const je = str(after.qbo_journal_entry_id);
      return {
        action: je ? `Posted to QuickBooks (JE #${je})` : "Posted to QuickBooks",
        detail: txLine(a),
      };
    }
    case "post_failed": {
      const err = str(after.error);
      return { action: err ? `Post failed: ${err}` : "Post failed", detail: txLine(a) };
    }
    default:
      return { action: a.action, detail: txLine(a) };
  }
}

/** Build the "TRADER JOE S #551 · AmEx · -$23.90" secondary line, if any. */
function txLine(a: ActivityEntry): string | null {
  if (!a.txDescription) return null;
  const parts = [a.txDescription];
  if (a.txSource) parts.push(SOURCE_LABELS[a.txSource] ?? a.txSource);
  if (a.txAmount != null) parts.push(fmtMoney(a.txAmount));
  return parts.join(" · ");
}

/**
 * Audit trail list. Collapsed to the most recent COLLAPSED_COUNT entries by
 * default. Each row shows the action with its concrete detail, plus the
 * specific transaction it acted on where applicable.
 */
type Tab = "all" | "posted" | "skipped";

export function ActivityLog({ entries }: { entries: ActivityEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<Tab>("all");

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity recorded.</p>;
  }

  const postedCount = entries.filter((e) => activityBucket(e.action) === "posted").length;
  const skippedCount = entries.filter((e) => activityBucket(e.action) === "skipped").length;

  const filtered =
    tab === "all"
      ? entries
      : entries.filter((e) => activityBucket(e.action) === tab);

  const hasMore = filtered.length > COLLAPSED_COUNT;
  const visible = expanded ? filtered : filtered.slice(0, COLLAPSED_COUNT);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: "All", count: entries.length },
    { key: "posted", label: "Posted", count: postedCount },
    { key: "skipped", label: "Skipped", count: skippedCount },
  ];

  return (
    <div className="flex flex-col">
      <div className="mb-2 flex gap-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setExpanded(false);
            }}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              tab === t.key
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            }`}
          >
            {t.label} {t.count}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">
          Nothing in this category.
        </p>
      ) : (
        visible.map((a, i) => {
        const { action, detail } = describe(a);
        return (
          <div
            key={i}
            className="flex items-start justify-between gap-3 border-b border-border py-2 text-sm last:border-0"
          >
            <div className="min-w-0">
              <p className="truncate">{action}</p>
              {detail && (
                <p className="truncate text-xs text-muted-foreground">{detail}</p>
              )}
            </div>
            <span className="shrink-0 pt-0.5 text-xs text-muted-foreground">
              {String(a.created_at).slice(0, 16).replace("T", " ")}
            </span>
          </div>
        );
        })
      )}

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 flex cursor-pointer items-center justify-center gap-1 rounded-lg py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-expanded={expanded}
        >
          {expanded ? "Show less" : `Show all ${filtered.length} activities`}
          <ChevronDown
            className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
      )}
    </div>
  );
}

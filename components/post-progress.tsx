"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface PostStatus {
  status: string;
  posted: number;
  failed: number;
  pending: number;
  done: number;
  total: number;
}

/**
 * Shows live posting progress ("Posting 120 / 231") while a post action runs.
 * Polls /api/post-status every 1.5s — postTransactions updates each row's
 * status as it posts, so the counts climb in real time. Purely informational;
 * the server action's return value is the source of truth for the final result.
 */
export function PostProgress() {
  const [data, setData] = useState<PostStatus | null>(null);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch("/api/post-status", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as PostStatus;
        if (active) setData(json);
      } catch {
        /* transient — keep polling */
      }
    };
    const timer = setInterval(poll, 1500);
    poll();
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const done = data?.done ?? 0;
  const total = data?.total ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm text-foreground">
        <Loader2 className="size-4 animate-spin text-primary" />
        <span>
          Posting to QuickBooks
          {total > 0 ? ` — ${done} / ${total}` : "…"}
        </span>
      </div>
      {total > 0 && (
        <div className="h-1.5 overflow-hidden rounded-full bg-foreground/5">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

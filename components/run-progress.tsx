"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusResponse {
  status: string;
  total: number;
  categorized: number;
}

const STAGES = [
  { key: "parsing", label: "Reading your statements" },
  { key: "categorizing", label: "Categorizing transactions" },
  { key: "awaiting_approval", label: "Ready for review" },
];

const ORDER: Record<string, number> = {
  pending: 0,
  parsing: 1,
  categorizing: 2,
  awaiting_approval: 3,
  posting: 3,
  complete: 3,
  error: 3,
};

/**
 * Polls /api/run-status while a run is active and shows real progress.
 * When the run reaches awaiting_approval/complete, refreshes the dashboard.
 */
export function RunProgress({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  const [data, setData] = useState<StatusResponse | null>(null);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch("/api/run-status", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as StatusResponse;
        if (!active) return;
        setData(json);
        if (["awaiting_approval", "complete", "error"].includes(json.status)) {
          clearInterval(timer);
          router.refresh(); // pull fresh server data into the dashboard
          onDone?.();
        }
      } catch {
        /* transient — keep polling */
      }
    };
    const timer = setInterval(poll, 2500);
    poll();
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [router, onDone]);

  const current = data ? (ORDER[data.status] ?? 0) : 0;
  const showCounter =
    data?.status === "categorizing" && data.total > 0;

  return (
    <div className="glass flex flex-col gap-3 rounded-xl p-4">
      <p className="text-sm font-medium">Processing your monthly close…</p>
      <div className="flex flex-col gap-2">
        {STAGES.map((stage, i) => {
          const stepOrder = i + 1;
          const done = current > stepOrder;
          const activeStep = current === stepOrder;
          return (
            <div
              key={stage.key}
              className={cn(
                "flex items-center gap-2 text-sm",
                done && "text-muted-foreground",
                activeStep && "text-foreground",
                !done && !activeStep && "text-muted-foreground/50",
              )}
            >
              <span className="flex size-5 items-center justify-center">
                {done ? (
                  <Check className="size-4 text-primary" />
                ) : activeStep ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : (
                  <span className="size-1.5 rounded-full bg-current" />
                )}
              </span>
              {stage.label}
              {activeStep && showCounter && (
                <span className="text-muted-foreground">
                  ({data.categorized} / {data.total})
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "parsing", label: "Parsed" },
  { key: "categorizing", label: "Categorized" },
  { key: "awaiting_approval", label: "Reviewing" },
  { key: "posting", label: "Posting" },
  { key: "complete", label: "Posted" },
] as const;

const ORDER: Record<string, number> = {
  pending: 0,
  parsing: 1,
  categorizing: 2,
  awaiting_approval: 3,
  posting: 4,
  complete: 5,
  error: 3,
};

export function PipelineStatus({ status }: { status: string }) {
  const current = ORDER[status] ?? 0;

  return (
    <div className="glass flex items-center gap-2 rounded-xl p-4">
      {STEPS.map((step, i) => {
        const stepOrder = i + 1;
        const isLast = i === STEPS.length - 1;
        // A step is "done" once we've moved past it. The final step ("Posted")
        // has nothing after it, so it counts as done the moment it's reached.
        const done = current > stepOrder || (isLast && current >= stepOrder);
        const active = current === stepOrder && !done;
        return (
          <div key={step.key} className="flex flex-1 items-center gap-2">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs transition-colors",
                  done && "bg-primary text-primary-foreground",
                  active && "bg-primary/20 text-primary ring-1 ring-primary/50",
                  !done && !active && "bg-foreground/5 text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3.5" /> : stepOrder}
              </span>
              <span
                className={cn(
                  "text-xs whitespace-nowrap",
                  active ? "text-foreground font-medium" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-px flex-1 transition-colors",
                  done ? "bg-primary/40" : "bg-border",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

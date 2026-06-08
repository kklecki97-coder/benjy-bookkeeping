import type { LucideIcon } from "lucide-react";

/**
 * Consistent empty-state block: a glass panel with a centered icon and message,
 * so "nothing here yet" reads as a deliberate state rather than text that
 * failed to load. Used across the dashboard tabs, revenue, and history.
 */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  className = "",
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-muted/20 px-6 py-10 text-center ${className}`}
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-muted/40">
        <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint && <p className="max-w-xs text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

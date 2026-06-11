"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * A Card whose body collapses behind a clickable title row (like the category
 * groups on the dashboard). Default collapsed; click the header to expand.
 * Server pages render the heavy content into `children`; this only owns the
 * open/closed UI state.
 */
export function CollapsibleCard({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <span className="font-heading text-base font-medium">{title}</span>
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${
            open ? "" : "-rotate-90"
          }`}
          aria-hidden="true"
        />
      </button>
      {open && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );
}

"use client";

import { useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { unskipTransaction } from "@/app/actions/approve";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface SkippedTx {
  id: string;
  source: string;
  description: string;
  amount: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export function SkippedRow({ tx }: { tx: SkippedTx }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl glass p-3 text-sm">
      <Badge variant="secondary" className="shrink-0 text-xs uppercase">
        {tx.source}
      </Badge>
      <span className="min-w-0 flex-1 truncate text-muted-foreground">
        {tx.description}
      </span>
      <span className="tabular-nums text-muted-foreground">{fmt(tx.amount)}</span>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await unskipTransaction(tx.id);
          })
        }
      >
        <RotateCcw className="size-3.5" />
        {pending ? "Restoring…" : "Restore"}
      </Button>
    </div>
  );
}

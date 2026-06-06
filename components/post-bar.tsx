"use client";

import { useState, useTransition } from "react";
import { postToQbo } from "@/app/actions/post-qbo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function PostBar({
  runId,
  readyCount,
}: {
  runId: string;
  readyCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="sticky bottom-0 mt-6 flex items-center justify-between rounded-xl glass p-4">
      <p className="text-sm text-muted-foreground">
        {readyCount} transactions ready to post.{" "}
        {message && <span className="text-foreground">{message}</span>}
      </p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button disabled={readyCount === 0 || pending}>
              Approve All &amp; Post to QuickBooks
            </Button>
          }
        />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Post to QuickBooks?</DialogTitle>
            <DialogDescription>
              This will post {readyCount} approved transactions to your QuickBooks
              company. Already-posted transactions are skipped automatically. This
              action is logged.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await postToQbo(runId);
                  setMessage(result.message);
                  setOpen(false);
                })
              }
            >
              {pending ? "Posting…" : "Confirm & Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

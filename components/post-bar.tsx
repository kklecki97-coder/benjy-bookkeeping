"use client";

import { useState, useTransition } from "react";
import { postToQbo } from "@/app/actions/post-qbo";
import { approveAllAuto } from "@/app/actions/approve";
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
  autoCount,
}: {
  runId: string;
  readyCount: number;
  autoCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="sticky bottom-0 mt-6 flex flex-col gap-3 rounded-xl glass p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        <span className="text-foreground font-medium">{readyCount}</span> approved
        and ready to post.
        {autoCount > 0 && ` ${autoCount} auto-categorized awaiting your approval.`}
        {message && <span className="block text-foreground">{message}</span>}
      </p>
      <div className="flex items-center gap-2">
        {autoCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await approveAllAuto(runId);
                setMessage(r.message);
              })
            }
          >
            {pending ? "Approving…" : `Approve all auto (${autoCount})`}
          </Button>
        )}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button disabled={readyCount === 0 || pending}>
                Post {readyCount} to QuickBooks
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Post to QuickBooks?</DialogTitle>
              <DialogDescription>
                This will post {readyCount} approved transactions to your QuickBooks
                company. Only transactions you&apos;ve approved are posted.
                Already-posted ones are skipped automatically. This action is logged.
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
    </div>
  );
}

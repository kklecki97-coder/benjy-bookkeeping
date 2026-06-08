"use client";

import { useState, useTransition } from "react";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { postToQbo, previewPost } from "@/app/actions/post-qbo";
import { approveAllAuto } from "@/app/actions/approve";
import { PostProgress } from "@/components/post-progress";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MissingCategory {
  category: string;
  count: number;
}
interface Preview {
  ok: boolean;
  missing: MissingCategory[];
  matchedCount: number;
  missingCount: number;
}

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
  const [posting, setPosting] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [checking, setChecking] = useState(false);
  const [pending, startTransition] = useTransition();

  // Open the dialog and run the read-only pre-post account check.
  function openAndCheck() {
    setOpen(true);
    setPreview(null);
    setChecking(true);
    startTransition(async () => {
      const r = await previewPost(runId);
      setChecking(false);
      if (r.ok) setPreview(r.preview);
      else setMessage(r.message);
    });
  }

  function confirmPost() {
    setOpen(false);
    setPosting(true);
    startTransition(async () => {
      const result = await postToQbo(runId);
      setMessage(result.message);
      setPosting(false);
    });
  }

  return (
    <div className="sticky bottom-0 mt-6 flex flex-col gap-3 rounded-xl glass p-4 sm:flex-row sm:items-center sm:justify-between">
      {posting ? (
        <PostProgress />
      ) : (
        <p className="text-sm text-muted-foreground">
          <span className="text-foreground font-medium">{readyCount}</span> approved
          and ready to post.
          {autoCount > 0 && ` ${autoCount} auto-categorized awaiting your approval.`}
          {message && <span className="block text-foreground">{message}</span>}
        </p>
      )}
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
        <Button disabled={readyCount === 0 || pending} onClick={openAndCheck}>
          Post {readyCount} to QuickBooks
        </Button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Post to QuickBooks?</DialogTitle>
              <DialogDescription>
                Checking your QuickBooks accounts before posting…
              </DialogDescription>
            </DialogHeader>

            {checking ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-primary" />
                Checking accounts…
              </div>
            ) : preview && preview.missing.length > 0 ? (
              <div className="flex flex-col gap-3 py-2">
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" />
                  <div>
                    <p className="font-medium text-foreground">
                      {preview.missingCount}{" "}
                      {preview.missingCount === 1
                        ? "transaction can't post yet."
                        : "transactions can't post yet."}
                    </p>
                    <p className="text-muted-foreground">
                      These categories have no matching account in QuickBooks.
                      Create them in QuickBooks (or rename to match), then check
                      again. {preview.matchedCount} will post fine.
                    </p>
                  </div>
                </div>
                <ul className="max-h-44 overflow-y-auto rounded-lg border border-border">
                  {preview.missing.map((m) => (
                    <li
                      key={m.category}
                      className="flex items-center justify-between border-b border-border px-3 py-2 text-sm last:border-0"
                    >
                      <span>{m.category}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {m.count} tx
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : preview ? (
              <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                <p className="text-foreground">
                  All {preview.matchedCount} approved transactions map to a
                  QuickBooks account. Ready to post.
                </p>
              </div>
            ) : null}

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button disabled={pending || checking} onClick={confirmPost}>
                {preview && preview.missing.length > 0
                  ? `Post the ${preview.matchedCount} anyway`
                  : "Confirm & Post"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

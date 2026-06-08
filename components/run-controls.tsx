"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { runClose } from "@/app/actions/run-close";
import { runFromDrive } from "@/app/actions/drive";
import { RunProgress } from "@/components/run-progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function RunControls({
  defaultMonth,
  driveConnected = false,
  hasRun = false,
}: {
  defaultMonth: string;
  driveConnected?: boolean;
  hasRun?: boolean;
}) {
  const [month, setMonth] = useState(defaultMonth);
  const [files, setFiles] = useState<FileList | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // When a run already exists, start collapsed (review is the focus). The owner
  // expands this only when starting a new month's close.
  const [open, setOpen] = useState(!hasRun);
  const [pending, startTransition] = useTransition();

  function onRun() {
    if (!files || files.length === 0) {
      setMessage("Select source files first.");
      return;
    }
    const formData = new FormData();
    for (const f of Array.from(files)) formData.append("files", f);
    startTransition(async () => {
      setMessage(null);
      const result = await runClose(month, formData);
      setMessage(result.message);
    });
  }

  function onRunFromDrive() {
    startTransition(async () => {
      setMessage("Pulling from Google Drive…");
      const result = await runFromDrive(month);
      setMessage(result.message);
    });
  }

  // Collapsed bar — shown once a run exists and the form isn't expanded.
  if (hasRun && !open && !pending) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl glass glass-hover p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-expanded={false}
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <Plus className="size-4 text-primary" aria-hidden="true" />
          Start a new monthly close
        </span>
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
      </button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>Run Monthly Close</CardTitle>
            <CardDescription>
              Upload this month&apos;s source files (Hana, HoneyBook, AmEx, BoA).
              The agent parses and categorizes them for review.
            </CardDescription>
          </div>
          {hasRun && !pending && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setOpen(false)}
              aria-label="Collapse"
            >
              <ChevronDown className="size-4 rotate-180" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted-foreground">Month (YYYY-MM)</label>
          <Input value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted-foreground">Source files</label>
          <Input
            type="file"
            multiple
            accept=".pdf,.csv,.xlsx"
            onChange={(e) => setFiles(e.target.files)}
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={onRun} disabled={pending} className="flex-1">
            {pending ? "Processing…" : "Run from uploaded files"}
          </Button>
          {driveConnected && (
            <Button
              onClick={onRunFromDrive}
              disabled={pending}
              variant="outline"
              className="flex-1"
            >
              {pending ? "Processing…" : "Run from Google Drive"}
            </Button>
          )}
        </div>
        {pending && <RunProgress />}
        {!pending && message && (
          <p className="text-sm text-muted-foreground">{message}</p>
        )}
      </CardContent>
    </Card>
  );
}

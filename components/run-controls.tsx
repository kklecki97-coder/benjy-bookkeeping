"use client";

import { useState, useTransition } from "react";
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
}: {
  defaultMonth: string;
  driveConnected?: boolean;
}) {
  const [month, setMonth] = useState(defaultMonth);
  const [files, setFiles] = useState<FileList | null>(null);
  const [message, setMessage] = useState<string | null>(null);
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Run Monthly Close</CardTitle>
        <CardDescription>
          Upload this month&apos;s source files (Hana, HoneyBook, AmEx, BoA). The agent
          parses and categorizes them for review.
        </CardDescription>
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

"use client";

import { useState, useTransition } from "react";
import { runClose } from "@/app/actions/run-close";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function RunControls({ defaultMonth }: { defaultMonth: string }) {
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
        <Button onClick={onRun} disabled={pending}>
          {pending ? "Processing…" : "Run Monthly Close"}
        </Button>
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </CardContent>
    </Card>
  );
}

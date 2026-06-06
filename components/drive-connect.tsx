"use client";

import { useState, useTransition } from "react";
import { saveDriveFolder } from "@/app/actions/drive";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export function DriveConnect({
  connected,
  folderId,
}: {
  connected: boolean;
  folderId: string | null;
}) {
  const [folder, setFolder] = useState(folderId ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3 rounded-xl glass p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">
            Google Drive{" "}
            {connected && <Badge variant="secondary">connected</Badge>}
          </p>
          <p className="text-xs text-muted-foreground">
            {connected
              ? "Auto-pull this month's files from a Drive folder."
              : "Connect to auto-pull files, or upload them manually on the dashboard."}
          </p>
        </div>
        <a href="/api/drive/connect">
          <Button variant={connected ? "outline" : "default"} size="sm">
            {connected ? "Reconnect" : "Connect Drive"}
          </Button>
        </a>
      </div>

      {connected && (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">
              Monthly files folder (ID or link)
            </label>
            <Input
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/…"
              className="mt-1"
            />
          </div>
          <Button
            size="sm"
            disabled={pending || !folder}
            onClick={() =>
              startTransition(async () => {
                const r = await saveDriveFolder(folder);
                setMessage(r.message);
              })
            }
          >
            {pending ? "Saving…" : "Save folder"}
          </Button>
        </div>
      )}
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}

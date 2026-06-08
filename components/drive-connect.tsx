"use client";

import { useState, useTransition } from "react";
import { Copy, Check } from "lucide-react";
import { saveDriveFolder } from "@/app/actions/drive";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export function DriveConnect({
  connected,
  folderId,
  serviceEmail,
}: {
  connected: boolean;
  folderId: string | null;
  serviceEmail: string | null;
}) {
  const [folder, setFolder] = useState(folderId ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3 rounded-xl glass p-4">
      <div>
        <p className="text-sm font-medium">
          Google Drive{" "}
          {connected && <Badge variant="secondary">connected</Badge>}
        </p>
        <p className="text-xs text-muted-foreground">
          Share your statement folder with the address below (read-only), then
          paste the folder link. Files are pulled automatically each month.
        </p>
      </div>

      {/* Service account address to share the folder with */}
      {serviceEmail ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 p-2.5">
          <code className="min-w-0 flex-1 truncate text-xs text-foreground">
            {serviceEmail}
          </code>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              navigator.clipboard.writeText(serviceEmail);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-amber-400">
          Service account not configured — set GOOGLE_SERVICE_ACCOUNT_KEY_B64.
        </p>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label htmlFor="drive-folder" className="text-xs text-muted-foreground">
            Monthly files folder (ID or link)
          </label>
          <Input
            id="drive-folder"
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
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { changePassword } from "@/app/(app)/settings/actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AccountCard({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      setMessage(null);
      const r = await changePassword(password, confirm);
      setMessage({ ok: r.ok, text: r.message });
      if (r.ok) {
        setPassword("");
        setConfirm("");
        setOpen(false);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>
          Signed in as <span className="text-foreground">{email}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!open ? (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Change the password you use to sign in.
            </p>
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
              Change password
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="new-password"
                  className="text-xs text-muted-foreground"
                >
                  New password
                </label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="confirm-password"
                  className="text-xs text-muted-foreground"
                >
                  Confirm new password
                </label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Re-enter password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                disabled={pending || !password || !confirm}
                onClick={submit}
              >
                {pending ? "Saving…" : "Update password"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  setMessage(null);
                  setPassword("");
                  setConfirm("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {message && (
          <p
            className={`mt-3 text-sm ${message.ok ? "text-primary" : "text-destructive"}`}
          >
            {message.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

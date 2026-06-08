import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function QboConnect({
  connected,
  environment,
}: {
  connected: boolean;
  environment: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl glass p-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">
          QuickBooks Online{" "}
          {connected && <Badge variant="secondary">{environment}</Badge>}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {connected
            ? "Approved transactions post here each month."
            : "Not connected — posting is disabled until you connect."}
        </p>
      </div>
      <a href="/api/qbo/connect" className="shrink-0">
        <Button variant={connected ? "outline" : "default"} size="sm">
          {connected ? "Reconnect" : "Connect QuickBooks"}
        </Button>
      </a>
    </div>
  );
}

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
    <div className="flex items-center justify-between rounded-xl glass p-4">
      <div>
        <p className="text-sm font-medium">QuickBooks Online</p>
        <p className="text-xs text-muted-foreground">
          {connected ? (
            <>
              Connected <Badge variant="secondary">{environment}</Badge>
            </>
          ) : (
            "Not connected — posting is disabled until you connect."
          )}
        </p>
      </div>
      <a href="/api/qbo/connect">
        <Button variant={connected ? "outline" : "default"} size="sm">
          {connected ? "Reconnect" : "Connect QuickBooks"}
        </Button>
      </a>
    </div>
  );
}

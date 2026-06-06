import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * Google Drive connection card — SCAFFOLD.
 * Disabled until the integration method is confirmed with the client.
 * Manual file upload on the dashboard works today regardless.
 */
export function DriveConnect() {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
      <div>
        <p className="text-sm font-medium">
          Google Drive{" "}
          <Badge variant="secondary" className="text-xs">
            coming soon
          </Badge>
        </p>
        <p className="text-xs text-muted-foreground">
          Auto-pull this month&apos;s files from a Drive folder. For now, upload
          files directly on the dashboard.
        </p>
      </div>
      <Button variant="outline" size="sm" disabled>
        Connect Drive
      </Button>
    </div>
  );
}

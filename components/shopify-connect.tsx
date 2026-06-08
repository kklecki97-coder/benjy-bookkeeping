import { Badge } from "@/components/ui/badge";

export function ShopifyConnect({
  connected,
  storeDomain,
}: {
  connected: boolean;
  storeDomain: string | null;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl glass p-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">
          Shopify {connected && <Badge variant="secondary">connected</Badge>}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {connected
            ? `Orders pull automatically from ${storeDomain} each month.`
            : "Not connected — Shopify orders won't be pulled until credentials are set."}
        </p>
      </div>
    </div>
  );
}

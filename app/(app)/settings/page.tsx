import { createSSRClient } from "@/lib/supabase/ssr";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RulesTable, type Rule } from "@/components/rules-table";
import { QboConnect } from "@/components/qbo-connect";
import { DriveConnect } from "@/components/drive-connect";
import { ShopifyConnect } from "@/components/shopify-connect";
import { AccountCard } from "@/components/account-card";
import { serviceAccountEmail } from "@/lib/drive/auth";

export default async function SettingsPage() {
  const supabase = await createSSRClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: rules } = await supabase
    .from("rulebook_rules")
    .select("id, rule_type, pattern, category, vendor, priority")
    .order("priority", { ascending: true });

  // Read connection STATUS from non-secret views (qbo_status/drive_status), not
  // the token tables — those are no longer client-readable (migration 0007).
  const { data: qbo } = await supabase
    .from("qbo_status")
    .select("environment")
    .limit(1)
    .maybeSingle();

  const { data: drive } = await supabase
    .from("drive_status")
    .select("folder_id")
    .limit(1)
    .maybeSingle();
  const driveServiceEmail = serviceAccountEmail();

  const shopifyConnected =
    !!process.env.SHOPIFY_STORE_DOMAIN &&
    !!process.env.SHOPIFY_CLIENT_ID &&
    !!process.env.SHOPIFY_CLIENT_SECRET;
  const shopifyDomain = process.env.SHOPIFY_STORE_DOMAIN ?? null;

  return (
    <>
      <header className="mb-8">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Connections, categorization rules, and your account
        </p>
      </header>

      <Tabs defaultValue="connections">
        <TabsList>
          <TabsTrigger value="connections">Connections</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>

        {/* Sources first (where data comes from), then the destination (QBO). */}
        <TabsContent value="connections" className="mt-6 flex flex-col gap-3">
          <DriveConnect
            connected={!!drive?.folder_id}
            folderId={drive?.folder_id ?? null}
            serviceEmail={driveServiceEmail}
          />
          <ShopifyConnect
            connected={shopifyConnected}
            storeDomain={shopifyDomain}
          />
          <QboConnect
            connected={!!qbo}
            environment={qbo?.environment ?? "sandbox"}
          />
        </TabsContent>

        <TabsContent value="rules" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Categorization Rules</CardTitle>
              <CardDescription>
                These rules tell the agent how to categorize transactions. Edit
                them anytime — no engineer needed. Changes apply on your next
                monthly close, and every change is logged.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RulesTable rules={(rules ?? []) as Rule[]} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account" className="mt-6">
          <AccountCard email={user?.email ?? ""} />
        </TabsContent>
      </Tabs>
    </>
  );
}

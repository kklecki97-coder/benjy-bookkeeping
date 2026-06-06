import { createSSRClient } from "@/lib/supabase/ssr";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RulesTable, type Rule } from "@/components/rules-table";
import { QboConnect } from "@/components/qbo-connect";
import { DriveConnect } from "@/components/drive-connect";

export default async function SettingsPage() {
  const supabase = await createSSRClient();

  const { data: rules } = await supabase
    .from("rulebook_rules")
    .select("id, rule_type, pattern, category, vendor, priority")
    .order("priority", { ascending: true });

  const { data: qbo } = await supabase
    .from("qbo_connection")
    .select("environment")
    .limit(1)
    .maybeSingle();

  return (
    <>
      <header className="mb-8">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Integrations and categorization rules
        </p>
      </header>

      <div className="mb-6 flex flex-col gap-3">
        <QboConnect connected={!!qbo} environment={qbo?.environment ?? "sandbox"} />
        <DriveConnect />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Categorization Rules</CardTitle>
          <CardDescription>
            These rules tell the agent how to categorize transactions. Edit them
            anytime — no engineer needed. Changes apply on your next monthly close,
            and every change is logged.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RulesTable rules={(rules ?? []) as Rule[]} />
        </CardContent>
      </Card>
    </>
  );
}

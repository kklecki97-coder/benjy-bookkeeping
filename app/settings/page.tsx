import { redirect } from "next/navigation";
import Link from "next/link";
import { createSSRClient } from "@/lib/supabase/ssr";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RulesTable, type Rule } from "@/components/rules-table";

export default async function SettingsPage() {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rules } = await supabase
    .from("rulebook_rules")
    .select("id, rule_type, pattern, category, vendor, priority")
    .order("priority", { ascending: true });

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground">
              Manage categorization rules
            </p>
          </div>
          <Link href="/dashboard">
            <Button variant="outline" size="sm">
              Back to dashboard
            </Button>
          </Link>
        </header>

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
      </div>
    </main>
  );
}

import { redirect } from "next/navigation";
import { createSSRClient } from "@/lib/supabase/ssr";
import { signOut } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function DashboardPage() {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Towers Flowers — Monthly Close
            </h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
          <form action={signOut}>
            <Button variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Current month</CardTitle>
            <CardDescription>
              Run controls and the approval queue will appear here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Dashboard shell — wired up in later tasks.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

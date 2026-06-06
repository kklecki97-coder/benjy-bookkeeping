import { redirect } from "next/navigation";
import { createSSRClient } from "@/lib/supabase/ssr";
import { Sidebar } from "@/components/sidebar";
import { signOut } from "./actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar userEmail={user.email ?? ""} signOut={signOut} />
      <div className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-5xl p-6 md:p-8">{children}</div>
      </div>
    </div>
  );
}

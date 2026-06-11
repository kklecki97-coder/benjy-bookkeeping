import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/qbo/oauth";
import { createSSRClient } from "@/lib/supabase/ssr";

/** OAuth callback — Intuit redirects here with code + realmId. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const realmId = url.searchParams.get("realmId");
  const state = url.searchParams.get("state");
  const cookieState = request.cookies.get("qbo_oauth_state")?.value;

  const dashboard = new URL("/settings", url.origin);

  // Token exchange writes service-role data; require an authenticated session
  // before doing it, so a callback can't be replayed without a logged-in user.
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  // realmId must be a numeric company id. Validate the shape before persisting
  // it (it gets interpolated into QBO API URL paths) so a malformed value fails
  // fast here with a clear error instead of a confusing later QBO 4xx.
  if (!code || !realmId || !/^\d{1,20}$/.test(realmId)) {
    dashboard.searchParams.set("qbo", "error");
    return NextResponse.redirect(dashboard);
  }
  if (!state || state !== cookieState) {
    dashboard.searchParams.set("qbo", "state_mismatch");
    return NextResponse.redirect(dashboard);
  }

  try {
    await exchangeCode(code, realmId);
    dashboard.searchParams.set("qbo", "connected");
  } catch {
    dashboard.searchParams.set("qbo", "error");
  }
  return NextResponse.redirect(dashboard);
}

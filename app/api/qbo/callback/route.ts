import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/qbo/oauth";

/** OAuth callback — Intuit redirects here with code + realmId. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const realmId = url.searchParams.get("realmId");
  const state = url.searchParams.get("state");
  const cookieState = request.cookies.get("qbo_oauth_state")?.value;

  const dashboard = new URL("/settings", url.origin);

  if (!code || !realmId) {
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

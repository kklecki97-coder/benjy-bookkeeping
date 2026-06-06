import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/drive/oauth";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.cookies.get("drive_oauth_state")?.value;

  const settings = new URL("/settings", url.origin);

  if (!code) {
    settings.searchParams.set("drive", "error");
    return NextResponse.redirect(settings);
  }
  if (!state || state !== cookieState) {
    settings.searchParams.set("drive", "state_mismatch");
    return NextResponse.redirect(settings);
  }

  try {
    await exchangeCode(code);
    settings.searchParams.set("drive", "connected");
  } catch {
    settings.searchParams.set("drive", "error");
  }
  return NextResponse.redirect(settings);
}

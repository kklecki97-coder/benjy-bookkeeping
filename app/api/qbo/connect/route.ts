import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { authorizeUrl } from "@/lib/qbo/oauth";
import { createSSRClient } from "@/lib/supabase/ssr";

/** Start the QBO OAuth flow — redirects the user to Intuit's consent page. */
export async function GET() {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(
      new URL("/login", process.env.QBO_REDIRECT_URI ?? "http://localhost:3000"),
    );
  }

  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(authorizeUrl(state));
  // store state in a short-lived cookie for CSRF protection
  res.cookies.set("qbo_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
  });
  return res;
}

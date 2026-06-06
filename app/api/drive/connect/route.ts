import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { authorizeUrl } from "@/lib/drive/oauth";
import { createSSRClient } from "@/lib/supabase/ssr";

export async function GET() {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(
      new URL("/login", process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3000"),
    );
  }

  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(authorizeUrl(state));
  res.cookies.set("drive_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
  });
  return res;
}

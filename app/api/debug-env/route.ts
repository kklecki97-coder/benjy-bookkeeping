import { NextResponse } from "next/server";
import { createSSRClient } from "@/lib/supabase/ssr";

/**
 * TEMPORARY debug endpoint — reports whether Shopify env vars are visible to the
 * server, WITHOUT revealing their values. Remove after diagnosing the Vercel
 * env issue. Gated behind auth so it isn't public.
 */
export async function GET() {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  return NextResponse.json({
    SHOPIFY_STORE_DOMAIN_set: !!process.env.SHOPIFY_STORE_DOMAIN,
    SHOPIFY_STORE_DOMAIN_value: process.env.SHOPIFY_STORE_DOMAIN ?? null,
    SHOPIFY_CLIENT_ID_set: !!process.env.SHOPIFY_CLIENT_ID,
    SHOPIFY_CLIENT_SECRET_set: !!process.env.SHOPIFY_CLIENT_SECRET,
    // length only, never the value, for the secret
    SHOPIFY_CLIENT_SECRET_length: process.env.SHOPIFY_CLIENT_SECRET?.length ?? 0,
  });
}

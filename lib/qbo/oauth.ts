import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { encrypt, decrypt } from "./crypto";

const AUTH_BASE = "https://appcenter.intuit.com/connect/oauth2";
const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const SCOPE = "com.intuit.quickbooks.accounting";

export function qboEnv() {
  return process.env.QBO_ENVIRONMENT === "production" ? "production" : "sandbox";
}

export function apiBase(): string {
  return qboEnv() === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

/** Build the Intuit consent URL the user visits to authorize. */
export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.QBO_CLIENT_ID ?? "",
    redirect_uri: process.env.QBO_REDIRECT_URI ?? "",
    response_type: "code",
    scope: SCOPE,
    state,
  });
  return `${AUTH_BASE}?${params.toString()}`;
}

function basicAuth(): string {
  const id = process.env.QBO_CLIENT_ID ?? "";
  const secret = process.env.QBO_CLIENT_SECRET ?? "";
  return Buffer.from(`${id}:${secret}`).toString("base64");
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

/** Exchange the OAuth code for tokens and persist the connection. */
export async function exchangeCode(code: string, realmId: string): Promise<void> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth()}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.QBO_REDIRECT_URI ?? "",
    }),
  });
  if (!res.ok) throw new Error(`QBO token exchange failed: ${res.status}`);
  const tokens = (await res.json()) as TokenResponse;

  const supabase = createServiceClient();
  // single connection at MVP — clear any existing
  await supabase.from("qbo_connection").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("qbo_connection").insert({
    realm_id: realmId,
    access_token: encrypt(tokens.access_token),
    refresh_token_enc: encrypt(tokens.refresh_token),
    access_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    environment: qboEnv(),
  });
}

/** Get a valid access token, refreshing if expired. Returns {token, realmId}. */
export async function getValidAccessToken(): Promise<{
  token: string;
  realmId: string;
}> {
  const supabase = createServiceClient();
  const { data: conn } = await supabase
    .from("qbo_connection")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (!conn) throw new Error("QuickBooks is not connected");

  // The connection was authorized against one environment (sandbox/production),
  // but the running app picks its QBO host from QBO_ENVIRONMENT. If someone
  // flips that env var at go-live without reconnecting, a sandbox token would be
  // sent to the production host — QBO answers an opaque 401. Fail fast with an
  // owner-actionable message instead.
  if (conn.environment && conn.environment !== qboEnv()) {
    throw new Error(
      `QuickBooks was connected to '${conn.environment}' but the app is now running against '${qboEnv()}'. Reconnect QuickBooks in Settings to continue.`,
    );
  }

  const expired =
    !conn.access_expires_at ||
    new Date(conn.access_expires_at).getTime() < Date.now() + 60_000;

  if (!expired && conn.access_token) {
    // access_token is stored encrypted (like the refresh token). Fall back to
    // treating it as plaintext for any row written before this change, so an
    // existing connection keeps working without a forced reconnect.
    let token: string;
    try {
      token = decrypt(conn.access_token);
    } catch {
      token = conn.access_token;
    }
    return { token, realmId: conn.realm_id };
  }

  // refresh
  const refreshToken = decrypt(conn.refresh_token_enc);
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth()}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`QBO token refresh failed: ${res.status}`);
  const tokens = (await res.json()) as TokenResponse;

  await supabase
    .from("qbo_connection")
    .update({
      access_token: encrypt(tokens.access_token),
      refresh_token_enc: encrypt(tokens.refresh_token),
      access_expires_at: new Date(
        Date.now() + tokens.expires_in * 1000,
      ).toISOString(),
    })
    .eq("id", conn.id);

  return { token: tokens.access_token, realmId: conn.realm_id };
}

export async function isConnected(): Promise<boolean> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("qbo_connection")
    .select("id")
    .limit(1)
    .maybeSingle();
  return !!data;
}

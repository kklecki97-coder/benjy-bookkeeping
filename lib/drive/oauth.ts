import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { encrypt, decrypt } from "@/lib/qbo/crypto";

const AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/drive.readonly";

/** Build the Google consent URL. */
export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: process.env.GOOGLE_REDIRECT_URI ?? "",
    response_type: "code",
    scope: SCOPE,
    access_type: "offline", // get a refresh token
    prompt: "consent",
    state,
  });
  return `${AUTH_BASE}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

/** Exchange code for tokens and persist the connection. */
export async function exchangeCode(code: string): Promise<void> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: process.env.GOOGLE_REDIRECT_URI ?? "",
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Drive token exchange failed: ${res.status}`);
  const tokens = (await res.json()) as TokenResponse;
  if (!tokens.refresh_token) {
    throw new Error("No refresh token returned — revoke prior access and retry");
  }

  const supabase = createServiceClient();
  await supabase
    .from("drive_connection")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("drive_connection").insert({
    access_token: tokens.access_token,
    refresh_token_enc: encrypt(tokens.refresh_token),
    access_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  });
}

/** Valid access token, refreshing if needed. */
export async function getValidAccessToken(): Promise<string> {
  const supabase = createServiceClient();
  const { data: conn } = await supabase
    .from("drive_connection")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (!conn) throw new Error("Google Drive is not connected");

  const expired =
    !conn.access_expires_at ||
    new Date(conn.access_expires_at).getTime() < Date.now() + 60_000;
  if (!expired && conn.access_token) return conn.access_token;

  const refreshToken = decrypt(conn.refresh_token_enc);
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Drive token refresh failed: ${res.status}`);
  const tokens = (await res.json()) as TokenResponse;

  await supabase
    .from("drive_connection")
    .update({
      access_token: tokens.access_token,
      access_expires_at: new Date(
        Date.now() + tokens.expires_in * 1000,
      ).toISOString(),
    })
    .eq("id", conn.id);
  return tokens.access_token;
}

export async function getFolderId(): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("drive_connection")
    .select("folder_id")
    .limit(1)
    .maybeSingle();
  return data?.folder_id ?? null;
}

export async function setFolderId(folderId: string): Promise<void> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("drive_connection")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (data) {
    await supabase
      .from("drive_connection")
      .update({ folder_id: folderId })
      .eq("id", data.id);
  }
}

export async function isConnected(): Promise<boolean> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("drive_connection")
    .select("id")
    .limit(1)
    .maybeSingle();
  return !!data;
}

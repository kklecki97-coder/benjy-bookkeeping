import "server-only";
import { createSign } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Google Drive access via a SERVICE ACCOUNT (not per-user OAuth).
 *
 * The owner shares their statement folder with the service account's email
 * (read-only), and the app authenticates as that service account using its
 * JSON key. This avoids the OAuth consent flow entirely, the 7-day refresh
 * token expiry of "Testing" apps, and Google's restricted-scope verification
 * (CASA) — none of which apply to a service account reading a shared folder.
 *
 * The key is provided as base64-encoded JSON in GOOGLE_SERVICE_ACCOUNT_KEY_B64.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const JWT_GRANT = "urn:ietf:params:oauth:grant-type:jwt-bearer";

export interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

/** Parse the base64-encoded service account JSON from the environment. */
export function loadServiceAccountKey(): ServiceAccountKey | null {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64;
  if (!b64) return null;
  try {
    const json = Buffer.from(b64, "base64").toString("utf8");
    const key = JSON.parse(json) as ServiceAccountKey;
    if (!key.client_email || !key.private_key) return null;
    return key;
  } catch {
    return null;
  }
}

const b64url = (input: Buffer | string): string =>
  Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

/**
 * Build and RS256-sign a JWT asserting the service account's identity.
 * `now` is injected so the output is deterministic and unit-testable.
 */
export function signServiceAccountJwt(key: ServiceAccountKey, now: number): string {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: key.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  const signature = b64url(signer.sign(key.private_key));
  return `${header}.${claim}.${signature}`;
}

/** Exchange the signed JWT for a short-lived Google access token. */
export async function getAccessToken(): Promise<string> {
  const key = loadServiceAccountKey();
  if (!key) {
    throw new Error(
      "Google Drive service account not configured (GOOGLE_SERVICE_ACCOUNT_KEY_B64)",
    );
  }
  const jwt = signServiceAccountJwt(key, Math.floor(Date.now() / 1000));
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: JWT_GRANT, assertion: jwt }).toString(),
  });
  if (!res.ok) throw new Error(`Drive token request failed: ${res.status}`);
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new Error("Drive token request returned no token");
  return body.access_token;
}

/** The service account email the owner must share their folder with. */
export function serviceAccountEmail(): string | null {
  return loadServiceAccountKey()?.client_email ?? null;
}

/**
 * "Connected" now means: a service account key is configured AND a folder id
 * has been set (the owner has told us which folder to read).
 */
export async function isConnected(): Promise<boolean> {
  if (!loadServiceAccountKey()) return false;
  return (await getFolderId()) !== null;
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
  } else {
    // refresh_token_enc is a leftover OAuth column (now nullable in the DB via
    // migration 0005); pass empty to satisfy the not-yet-regenerated types.
    await supabase
      .from("drive_connection")
      .insert({ folder_id: folderId, refresh_token_enc: "" });
  }
}

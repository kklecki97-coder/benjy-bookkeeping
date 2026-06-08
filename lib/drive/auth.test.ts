import { describe, it, expect, afterEach, vi } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { loadServiceAccountKey, signServiceAccountJwt } from "./auth";

// A throwaway RSA key so we can sign/verify without a real Google key.
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const PEM = privateKey.export({ type: "pkcs8", format: "pem" }) as string;

const sampleKey = {
  client_email: "bookkeeping-drive@proj.iam.gserviceaccount.com",
  private_key: PEM,
};

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64;
});

describe("service account key loading", () => {
  it("decodes a base64 JSON key from the env", () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64 = Buffer.from(
      JSON.stringify(sampleKey),
    ).toString("base64");
    const key = loadServiceAccountKey();
    expect(key?.client_email).toBe(sampleKey.client_email);
    expect(key?.private_key).toContain("PRIVATE KEY");
  });

  it("returns null when the env var is missing", () => {
    expect(loadServiceAccountKey()).toBeNull();
  });

  it("returns null on malformed base64/JSON", () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64 = "not-valid-base64-json!!!";
    expect(loadServiceAccountKey()).toBeNull();
  });
});

describe("JWT signing", () => {
  it("builds a three-part JWT with the right claims", () => {
    const jwt = signServiceAccountJwt(sampleKey, 1_000_000);
    const parts = jwt.split(".");
    expect(parts.length).toBe(3);

    const decode = (s: string) =>
      JSON.parse(Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());

    const header = decode(parts[0]);
    const claim = decode(parts[1]);
    expect(header.alg).toBe("RS256");
    expect(claim.iss).toBe(sampleKey.client_email);
    expect(claim.scope).toContain("drive.readonly");
    expect(claim.iat).toBe(1_000_000);
    expect(claim.exp).toBe(1_000_000 + 3600);
    expect(parts[2].length).toBeGreaterThan(0); // signature present
  });
});

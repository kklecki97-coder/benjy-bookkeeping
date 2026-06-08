import type { NormalizedTransaction } from "@/types/transaction";
import type { ParseInput, SourceConnector } from "./types";

const API_VERSION = "2024-10";

interface ShopifyOrder {
  id: number;
  created_at: string;
  total_price: string;
  financial_status: string;
  name: string;
  total_tax?: string;
  total_discounts?: string;
}

/** First and last day of a "YYYY-MM" month as ISO timestamps. */
function monthBounds(monthYear: string): { min: string; max: string } {
  const [y, m] = monthYear.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1)); // first of next month
  return { min: start.toISOString(), max: end.toISOString() };
}

function parseLinkHeader(link: string | null): string | null {
  if (!link) return null;
  const next = link.split(",").find((p) => p.includes('rel="next"'));
  if (!next) return null;
  const m = next.match(/<([^>]+)>/);
  return m ? m[1] : null;
}

/**
 * Exchange the app's client credentials for a short-lived Admin API token.
 * Shopify removed static custom-app tokens in 2026 — Dev Dashboard apps now use
 * the client_credentials grant (token valid ~24h, requested per run). Requires
 * the app and store to be in the same Shopify organization.
 */
async function getAccessToken(
  domain: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const res = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });
  if (!res.ok) {
    throw new Error(`Shopify token exchange failed ${res.status}`);
  }
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) {
    throw new Error("Shopify token exchange returned no access_token");
  }
  return body.access_token;
}

export const shopifyConnector: SourceConnector = {
  source: "shopify",
  async parse(input: ParseInput): Promise<NormalizedTransaction[]> {
    if (input.kind !== "api") {
      throw new Error("Shopify connector requires an api input");
    }
    const domain = process.env.SHOPIFY_STORE_DOMAIN;
    const clientId = process.env.SHOPIFY_CLIENT_ID;
    const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
    if (!domain || !clientId || !clientSecret) {
      throw new Error(
        "Missing Shopify credentials (SHOPIFY_STORE_DOMAIN / SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET)",
      );
    }

    const token = await getAccessToken(domain, clientId, clientSecret);
    const { min, max } = monthBounds(input.monthYear);
    let url:
      | string
      | null = `https://${domain}/admin/api/${API_VERSION}/orders.json?status=any&limit=250&created_at_min=${encodeURIComponent(min)}&created_at_max=${encodeURIComponent(max)}`;

    const orders: ShopifyOrder[] = [];
    while (url) {
      const res = await fetch(url, {
        headers: { "X-Shopify-Access-Token": token },
      });
      if (res.status === 429) {
        // rate limited — back off and retry the same URL
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      if (!res.ok) {
        throw new Error(`Shopify API error ${res.status}`);
      }
      const body = (await res.json()) as { orders: ShopifyOrder[] };
      orders.push(...body.orders);
      url = parseLinkHeader(res.headers.get("Link"));
    }

    return orders.map((o) => ({
      source: "shopify" as const,
      externalId: `shopify_${o.id}`,
      date: o.created_at.slice(0, 10),
      amount: parseFloat(o.total_price) || 0,
      description: `Shopify order ${o.name}`,
      rawData: o as unknown as Record<string, unknown>,
    }));
  },
};

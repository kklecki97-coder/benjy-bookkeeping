import { describe, it, expect, vi, afterEach } from "vitest";
import { shopifyConnector } from "./shopify";

const SAMPLE_ORDERS = {
  orders: [
    {
      id: 5001,
      created_at: "2026-04-03T14:22:00-04:00",
      total_price: "120.50",
      financial_status: "paid",
      name: "#1001",
      total_tax: "9.95",
      total_discounts: "0.00",
    },
    {
      id: 5002,
      created_at: "2026-04-15T09:10:00-04:00",
      total_price: "85.00",
      financial_status: "paid",
      name: "#1002",
      total_tax: "7.02",
      total_discounts: "5.00",
    },
  ],
};

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.SHOPIFY_STORE_DOMAIN;
  delete process.env.SHOPIFY_CLIENT_ID;
  delete process.env.SHOPIFY_CLIENT_SECRET;
});

/**
 * Build a fetch mock for the two-step flow Shopify now requires:
 *  1. POST /admin/oauth/access_token  → { access_token }
 *  2. GET  /admin/api/.../orders.json → { orders }
 */
function mockTokenThenOrders() {
  return vi.fn(async (url: string, _init?: RequestInit) => {
    if (url.includes("/admin/oauth/access_token")) {
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ access_token: "shpat_runtime", expires_in: 86399 }),
      };
    }
    return {
      ok: true,
      status: 200,
      headers: { get: () => null }, // no pagination Link header
      json: async () => SAMPLE_ORDERS,
    };
  });
}

describe("Shopify connector", () => {
  it("exchanges client credentials for a token, then maps orders", async () => {
    process.env.SHOPIFY_STORE_DOMAIN = "towers.myshopify.com";
    process.env.SHOPIFY_CLIENT_ID = "client-id";
    process.env.SHOPIFY_CLIENT_SECRET = "client-secret";

    const fetchMock = mockTokenThenOrders();
    vi.stubGlobal("fetch", fetchMock);

    const txs = await shopifyConnector.parse({ kind: "api", monthYear: "2026-04" });

    // first call must be the token exchange with client_credentials
    const firstUrl = fetchMock.mock.calls[0][0] as string;
    expect(firstUrl).toContain("/admin/oauth/access_token");
    const firstInit = fetchMock.mock.calls[0][1] as RequestInit;
    expect(String(firstInit.body)).toContain("client_credentials");

    // orders call must carry the runtime token
    const ordersInit = fetchMock.mock.calls[1][1] as RequestInit;
    expect((ordersInit.headers as Record<string, string>)["X-Shopify-Access-Token"]).toBe(
      "shpat_runtime",
    );

    expect(txs.length).toBe(2);
    expect(txs[0].source).toBe("shopify");
    expect(txs[0].amount).toBeCloseTo(120.5, 2);
    expect(txs[0].date).toBe("2026-04-03");
    expect(txs[0].externalId).toBe("shopify_5001");
  });

  it("throws a clear error when credentials are missing", async () => {
    await expect(
      shopifyConnector.parse({ kind: "api", monthYear: "2026-04" }),
    ).rejects.toThrow(/credential|client|domain/i);
  });
});

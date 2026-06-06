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
  delete process.env.SHOPIFY_ADMIN_TOKEN;
});

describe("Shopify connector", () => {
  it("maps orders to normalized transactions", async () => {
    process.env.SHOPIFY_STORE_DOMAIN = "towers.myshopify.com";
    process.env.SHOPIFY_ADMIN_TOKEN = "test-token";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: { get: () => null }, // no pagination Link header
        json: async () => SAMPLE_ORDERS,
      })),
    );

    const txs = await shopifyConnector.parse({ kind: "api", monthYear: "2026-04" });
    expect(txs.length).toBe(2);
    expect(txs[0].source).toBe("shopify");
    expect(txs[0].amount).toBeCloseTo(120.5, 2);
    expect(txs[0].date).toBe("2026-04-03");
    expect(txs[0].externalId).toBe("shopify_5001");
  });

  it("throws a clear error when credentials are missing", async () => {
    await expect(
      shopifyConnector.parse({ kind: "api", monthYear: "2026-04" }),
    ).rejects.toThrow(/credential|token|domain/i);
  });
});

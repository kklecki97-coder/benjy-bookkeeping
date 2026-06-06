import { describe, it, expect } from "vitest";
import { renderSummaryText, renderSummaryHtml, type SummaryData } from "./summary";

const data: SummaryData = {
  monthYear: "2026-04",
  totalProcessed: 247,
  autoCategorized: 230,
  manuallyReviewed: 17,
  posted: 247,
  revenueBySource: [
    { source: "Hana POS", amount: 50681.98 },
    { source: "HoneyBook", amount: 28117.84 },
    { source: "Shopify", amount: 2587.9 },
  ],
  topExpenses: [{ category: "Cost of goods sold", amount: 30979.11 }],
  dashboardUrl: "https://benjy-bookkeeping.vercel.app/history",
};

describe("summary email rendering", () => {
  it("text version includes counts and revenue total", () => {
    const text = renderSummaryText(data);
    expect(text).toContain("247");
    expect(text).toContain("Hana POS");
    // revenue total = 50681.98 + 28117.84 + 2587.90 = 81387.72
    expect(text).toContain("$81,387.72");
  });

  it("html version includes the dashboard link", () => {
    const html = renderSummaryHtml(data);
    expect(html).toContain("benjy-bookkeeping.vercel.app/history");
    expect(html).toContain("Cost of goods sold");
  });
});

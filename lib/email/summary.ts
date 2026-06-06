import "server-only";
import { Resend } from "resend";

export interface SummaryData {
  monthYear: string;
  totalProcessed: number;
  autoCategorized: number;
  manuallyReviewed: number;
  posted: number;
  revenueBySource: { source: string; amount: number }[];
  topExpenses: { category: string; amount: number }[];
  dashboardUrl: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export function renderSummaryText(d: SummaryData): string {
  const rev = d.revenueBySource
    .map((r) => `  - ${r.source}: ${fmt(r.amount)}`)
    .join("\n");
  const exp = d.topExpenses
    .map((e) => `  - ${e.category}: ${fmt(e.amount)}`)
    .join("\n");
  const revTotal = d.revenueBySource.reduce((s, r) => s + r.amount, 0);
  return `Monthly close for ${d.monthYear} is complete.

Total transactions processed: ${d.totalProcessed}
Auto-categorized: ${d.autoCategorized}
Manually reviewed: ${d.manuallyReviewed}
Posted to QuickBooks: ${d.posted}

Revenue by source:
${rev}
  TOTAL: ${fmt(revTotal)}

Top expense categories:
${exp}

Full audit log: ${d.dashboardUrl}
`;
}

export function renderSummaryHtml(d: SummaryData): string {
  const revTotal = d.revenueBySource.reduce((s, r) => s + r.amount, 0);
  const rows = (items: { label: string; amount: number }[]) =>
    items
      .map(
        (i) =>
          `<tr><td style="padding:4px 12px 4px 0;color:#666">${i.label}</td><td style="padding:4px 0;text-align:right">${fmt(i.amount)}</td></tr>`,
      )
      .join("");
  return `<div style="font-family:system-ui,sans-serif;max-width:560px;color:#111">
  <h2 style="font-weight:600">Monthly close — ${d.monthYear}</h2>
  <p>Total processed: <strong>${d.totalProcessed}</strong> · Auto-categorized: ${d.autoCategorized} · Reviewed: ${d.manuallyReviewed} · Posted: <strong>${d.posted}</strong></p>
  <h3 style="font-weight:600;margin-top:24px">Revenue by source</h3>
  <table style="border-collapse:collapse">${rows(d.revenueBySource.map((r) => ({ label: r.source, amount: r.amount })))}
    <tr><td style="padding:8px 12px 0 0;font-weight:600;border-top:1px solid #eee">TOTAL</td><td style="padding:8px 0 0;text-align:right;font-weight:600;border-top:1px solid #eee">${fmt(revTotal)}</td></tr>
  </table>
  <h3 style="font-weight:600;margin-top:24px">Top expenses</h3>
  <table style="border-collapse:collapse">${rows(d.topExpenses.map((e) => ({ label: e.category, amount: e.amount })))}</table>
  <p style="margin-top:24px"><a href="${d.dashboardUrl}" style="color:#2563eb">View full audit log →</a></p>
</div>`;
}

/** Send the monthly summary email via Resend. No-op if RESEND_API_KEY unset. */
export async function sendSummaryEmail(
  to: string,
  data: SummaryData,
): Promise<{ ok: boolean; message: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, message: "RESEND_API_KEY not set" };

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: "Towers Flowers Bookkeeping <onboarding@resend.dev>",
    to,
    subject: `Monthly Close Complete — ${data.monthYear}`,
    text: renderSummaryText(data),
    html: renderSummaryHtml(data),
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Sent" };
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use — Towers Flowers Bookkeeping",
  description: "End-user license agreement for the Towers Flowers bookkeeping app.",
};

/**
 * Public EULA / terms page. Must be reachable without auth — Intuit's app
 * assessment requires a public EULA URL. Kept simple and honest: this is a
 * private, single-business tool, not a public SaaS.
 */
export default function LegalPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-foreground">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Terms of Use
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: June 2026
      </p>

      <div className="mt-8 flex flex-col gap-5 text-sm leading-relaxed text-foreground/90">
        <p>
          This application is a private bookkeeping tool built for Towers Flowers
          (Mimosa Collective LLC). It is not offered to the general public.
        </p>
        <p>
          The app reads transaction data from the business&apos;s own financial
          sources (bank and card statements, point-of-sale and payment reports),
          helps categorize those transactions, and — once the business owner
          reviews and approves them — records journal entries to the
          business&apos;s connected QuickBooks Online company.
        </p>
        <p>
          Access is limited to authorized users of the business. Use of the app
          is restricted to the business&apos;s own bookkeeping. The app is
          provided as-is for that purpose, without warranty.
        </p>
        <p>
          QuickBooks Online is connected by the business owner via Intuit&apos;s
          official OAuth authorization, and the connection can be revoked at any
          time from within the app or from the Intuit account.
        </p>
        <p>
          Questions about these terms can be directed to the business owner or
          the app administrator.
        </p>
      </div>
    </main>
  );
}

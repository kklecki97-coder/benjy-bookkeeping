import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Towers Flowers Bookkeeping",
  description: "How the Towers Flowers bookkeeping app handles data.",
};

/**
 * Public privacy policy. Must be reachable without auth — Intuit's app
 * assessment requires a public privacy-policy URL. Describes the real data flow
 * honestly: financial data in, categorized, posted to the owner's QuickBooks.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-foreground">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: June 2026
      </p>

      <div className="mt-8 flex flex-col gap-5 text-sm leading-relaxed text-foreground/90">
        <p>
          This is a private bookkeeping application for a single business (Towers
          Flowers / Mimosa Collective LLC). It is not a public service and does
          not collect data from the general public.
        </p>

        <h2 className="font-heading text-lg font-medium">What we process</h2>
        <p>
          The app processes the business&apos;s own financial records:
          transactions from bank and credit-card statements, point-of-sale and
          payment-processor reports, and the resulting categorizations. It reads
          the connected QuickBooks Online company&apos;s chart of accounts to
          post journal entries the owner has approved.
        </p>

        <h2 className="font-heading text-lg font-medium">How data is stored</h2>
        <p>
          Transaction data is stored in a private database accessible only to
          authorized users of the business. QuickBooks Online access tokens are
          encrypted at rest. The app never sells or shares the business&apos;s
          data with third parties.
        </p>

        <h2 className="font-heading text-lg font-medium">Third-party services</h2>
        <p>
          The app connects to Intuit QuickBooks Online (to post bookkeeping
          entries the owner approves) and uses Anthropic&apos;s Claude API to
          suggest transaction categories. Source files may be read from a Google
          Drive folder the owner shares. Each connection is authorized by the
          business and can be revoked at any time.
        </p>

        <h2 className="font-heading text-lg font-medium">QuickBooks data</h2>
        <p>
          QuickBooks data accessed through the Intuit API is used solely to
          record the business&apos;s own approved bookkeeping entries. It is not
          used for any other purpose. The QuickBooks connection can be
          disconnected at any time from within the app or from the Intuit
          account, which revokes the app&apos;s access.
        </p>

        <h2 className="font-heading text-lg font-medium">Contact</h2>
        <p>
          Questions about data handling can be directed to the business owner or
          the app administrator.
        </p>
      </div>
    </main>
  );
}

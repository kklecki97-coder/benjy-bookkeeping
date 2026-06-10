import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the PDF libraries external so their worker/polyfill resolution works
  // in the Next.js server runtime. unpdf ships a serverless pdf.js build (used
  // by lib/sources/pdf-utils.ts); pdfjs-dist stays listed in case it's pulled
  // transitively, but is no longer imported directly.
  serverExternalPackages: ["unpdf", "pdfjs-dist"],
  experimental: {
    serverActions: {
      // Monthly source files (AmEx ~800KB, BoA PDFs, Hana, etc.) can total a
      // few MB. Default Server Action body limit is 1MB — raise it.
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;

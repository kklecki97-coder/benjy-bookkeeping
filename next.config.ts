import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep pdfjs as an external server package so its worker resolution works
  // in the Next.js server runtime (otherwise it looks for a bundled worker file).
  serverExternalPackages: ["pdfjs-dist"],
  experimental: {
    serverActions: {
      // Monthly source files (AmEx ~800KB, BoA PDFs, Hana, etc.) can total a
      // few MB. Default Server Action body limit is 1MB — raise it.
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;

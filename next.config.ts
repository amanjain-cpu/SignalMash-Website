import type { NextConfig } from "next";
import { WEBFLOW_REDIRECTS, flattenRedirects } from "./src/lib/site/redirects";

/**
 * Turbopack is the Next 16 default. Do not add a `webpack()` block: it breaks `next build`.
 */
const nextConfig: NextConfig = {
  /**
   * Webflow answers "/blog/" with a 301 to "/blog". Next's built-in trailing-slash redirect is a
   * 308, so it is switched off and src/proxy.ts sends the 301 instead.
   */
  skipTrailingSlashRedirect: true,

  /**
   * `.next/standalone` is a self-contained server for a Docker image; the Dockerfile sets
   * NEXT_OUTPUT=standalone. Left off otherwise so `npm start` works, and so Vercel uses its own.
   */
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,

  /** Pages are read from content/ at build time, and at request time for unknown URLs (404). */
  outputFileTracingIncludes: { "/**": ["./content/**"] },

  /** The site never served this header; there is no reason to start advertising the framework. */
  poweredByHeader: false,

  /** Unknown URLs get the live 404 page: src/app/global-not-found.tsx. */
  experimental: { globalNotFound: true },

  async redirects() {
    return flattenRedirects(WEBFLOW_REDIRECTS).map(({ from, to }) => ({
      source: from,
      destination: to,
      statusCode: 301 as const,
    }));
  },

  async headers() {
    return [
      {
        /* Asset file names carry a content hash (Webflow's upload id), so they never change. */
        source: "/cdn/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;

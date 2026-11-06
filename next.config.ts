import type { NextConfig } from "next";
import { WEBFLOW_REDIRECTS, flattenRedirects } from "./src/lib/site/redirects";

/**
 * Turbopack is the Next 16 default. Do not add a `webpack()` block: it breaks `next build`.
 *
 * NEXT_OUTPUT selects how the site is built:
 *   (unset)       a Next.js server: `npm start`, Vercel
 *   standalone    a self-contained server for a Docker image
 *   export        plain files in out/, for a static host (Cloudflare Pages: `npm run build:cloudflare`).
 *                 Redirects, headers and src/proxy.ts do not run in a static export; the Cloudflare
 *                 build reproduces them in out/_worker.js (scripts/build-cloudflare.mjs).
 */
const OUTPUT = process.env.NEXT_OUTPUT;
const STATIC_EXPORT = OUTPUT === "export";

const nextConfig: NextConfig = {
  /**
   * Webflow answers "/blog/" with a 301 to "/blog". Next's built-in trailing-slash redirect is a
   * 308, so it is switched off and src/proxy.ts sends the 301 instead.
   */
  skipTrailingSlashRedirect: true,

  output: OUTPUT === "standalone" || STATIC_EXPORT ? OUTPUT : undefined,

  /** Pages are read from content/ at build time, and at request time for unknown URLs (404). */
  outputFileTracingIncludes: { "/**": ["./content/**"] },

  /** The site never served this header; there is no reason to start advertising the framework. */
  poweredByHeader: false,

  /** Unknown URLs get the live 404 page: src/app/global-not-found.tsx. */
  experimental: { globalNotFound: true },

  ...(STATIC_EXPORT
    ? {}
    : {
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
      }),
};

export default nextConfig;

/**
 * Builds the site as plain files for Cloudflare Pages, in out/.
 *
 *   npm run build:cloudflare          then   npm run deploy:cloudflare
 *
 * 1. `next build` with NEXT_OUTPUT=export: every page as HTML, plus public/ (assets, sitemap,
 *    robots.txt, llms.txt).
 * 2. out/_worker.js from cloudflare/worker.template.js: redirects, trailing slash, collection-list
 *    pagination and the 404 status, which a Next.js server would otherwise handle.
 * 3. out/_routes.json: static assets (/cdn, /_next) are served straight from Cloudflare's edge
 *    without running the worker; out/_headers gives /cdn files a one-year cache.
 *
 * Analytics follow the ANALYTICS variable as in any build (.env.local turns them off locally).
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const OUT = path.resolve("out");

/* Retries: on Windows an editor or indexer briefly holding a file makes a single attempt fail. */
fs.rmSync(OUT, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
execSync("npx next build", { stdio: "inherit", env: { ...process.env, NEXT_OUTPUT: "export" } });

const redirects = JSON.parse(fs.readFileSync("src/lib/site/redirects.json", "utf8"));
const paged = JSON.parse(fs.readFileSync("content/routes.json", "utf8"))
  .filter((r) => r.query)
  .map((r) => `${r.path}?${r.query}`);

const worker = fs
  .readFileSync("cloudflare/worker.template.js", "utf8")
  .replace("__REDIRECTS__", JSON.stringify(redirects))
  .replace("__PAGED__", JSON.stringify(paged));
fs.writeFileSync(path.join(OUT, "_worker.js"), worker);

/* Asset file names carry Webflow's upload id, so they never change: cache them for a year. */
fs.writeFileSync(
  path.join(OUT, "_headers"),
  ["/cdn/*", "  Cache-Control: public, max-age=31536000, immutable", ""].join("\n"),
);

fs.writeFileSync(
  path.join(OUT, "_routes.json"),
  JSON.stringify({ version: 1, include: ["/*"], exclude: ["/cdn/*", "/_next/*"] }, null, 2),
);

let files = 0;
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) walk(path.join(dir, e.name));
    else files++;
  }
};
walk(OUT);
console.log(`\nout/ ready for Cloudflare Pages: ${files} files (limit 20,000), ${redirects.length} redirects, ${paged.length} collection-list pages`);
if (files > 20_000) process.exit(1);

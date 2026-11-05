/**
 * Step 2 of the Webflow import: mirror every Webflow-hosted file the site uses.
 *
 *   node scripts/download-assets.mjs
 *
 * Webflow serves images, PDFs, CSS and JS from its own CDN. Those URLs stop working when the
 * Webflow site plan is cancelled, so every one of them has to be copied before the cutover.
 *
 * Reads capture/{pages,paged,404.html}, then every CSS/JS/JSON/SVG it downloads (a stylesheet can
 * reference more files), until no new URL turns up. Files land in capture/cdn/<host>/<path>,
 * percent-decoded once, which is exactly the path a static server resolves the original URL to.
 * Writes capture/asset-manifest.json: { url: "ok" | "failed: <reason>" }.
 */
import fs from "node:fs";
import path from "node:path";
import { ASSET_URL_RE, assetLocalPath } from "./lib/assets.mjs";

const CAP = path.resolve("capture");
const SCANNABLE = /\.(css|js|json|svg|html)$/i;
const CONCURRENCY = 16;

function scan(file) {
  const text = fs.readFileSync(file, "utf8");
  return new Set([...text.matchAll(ASSET_URL_RE)].map((m) => m[0].replaceAll("&amp;", "&")));
}

async function download(url) {
  const dest = path.join(CAP, "cdn", assetLocalPath(url));
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return { dest, status: "ok" };
  let reason = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        reason = `HTTP ${res.status}`;
        if (res.status < 500) break; // 403/404 are permanent: the file is gone on Webflow too
        continue;
      }
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      return { dest, status: "ok" };
    } catch (err) {
      reason = String(err);
    }
  }
  return { dest, status: `failed: ${reason}` };
}

const roots = [
  ...fs.readdirSync(path.join(CAP, "pages")).map((f) => path.join(CAP, "pages", f)),
  ...fs.readdirSync(path.join(CAP, "paged")).map((f) => path.join(CAP, "paged", f)),
  path.join(CAP, "404.html"),
].filter((f) => f.endsWith(".html"));

const manifest = {};
let queue = new Set();
for (const f of roots) for (const u of scan(f)) queue.add(u);

while (queue.size) {
  const batch = [...queue].filter((u) => !(u in manifest));
  queue = new Set();
  console.log(`downloading ${batch.length} files`);
  const work = [...batch];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (work.length) {
        const url = work.shift();
        const { dest, status } = await download(url);
        manifest[url] = status;
        if (status === "ok" && SCANNABLE.test(dest)) for (const u of scan(dest)) queue.add(u);
      }
    }),
  );
}

const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(path.join(CAP, "asset-manifest.json"), JSON.stringify(sorted, null, 2));
const failed = Object.entries(manifest).filter(([, s]) => s !== "ok");
console.log(`${Object.keys(manifest).length} files, ${failed.length} unavailable on Webflow too:`);
for (const [u, s] of failed) console.log(`  ${s}  ${u}`);

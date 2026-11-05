/**
 * Compares every page this site SERVES with the page Webflow published (capture/), on everything
 * search engines and visitors read:
 *
 *   status code · <title> · meta description · canonical · robots · Open Graph · Twitter card ·
 *   every JSON-LD block (parsed) · the visible text · every link · every image
 *
 *   npm run verify:seo [-- http://localhost:3000]
 *
 * Asset URLs are compared after mapping Webflow's CDN to this site's /cdn path. Analytics tags
 * are not compared (ANALYTICS=off leaves them out of local builds).
 */
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import { ASSET_URL_RE, assetPublicUrl } from "./lib/assets.mjs";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const CAP = path.resolve("capture");
const routes = JSON.parse(fs.readFileSync("content/routes.json", "utf8"));

const norm = (s) =>
  s
    .replace(ASSET_URL_RE, (u) => assetPublicUrl(u.replaceAll("&amp;", "&")))
    .replace(/https?:\/\/signalmash\.com(?=\/cdn\/)/g, "");
const squash = (s) => s.replace(/\s+/g, " ").trim();

/** Schema markup, wherever the page carries it: JSON-LD scripts, or bare JSON text (Webflow). */
function jsonLd($) {
  const blocks = $('script[type="application/ld+json"]').map((_, el) => $(el).html()).get();
  $("head, body").contents().each((_, n) => {
    if (n.type === "text" && n.data.includes("schema.org") && /^\s*\{/.test(n.data)) blocks.push(n.data);
  });
  return blocks
    .map((b) => {
      try {
        return JSON.stringify(JSON.parse(norm(b)));
      } catch {
        return `unparseable: ${squash(b).slice(0, 60)}`;
      }
    })
    .sort();
}

function facts(html) {
  const $ = cheerio.load(html);
  const meta = (sel) => $(sel).attr("content") ?? null;
  const out = {
    title: squash($("title").first().text()),
    description: meta('meta[name="description"]'),
    canonical: $('link[rel="canonical"]').attr("href") ?? null,
    robots: meta('meta[name="robots"]'),
    refresh: meta('meta[http-equiv="refresh"]'),
    og: Object.fromEntries($('meta[property^="og:"], meta[property^="article:"]').map((_, el) => [[$(el).attr("property"), norm($(el).attr("content") ?? "")]]).get()),
    twitter: Object.fromEntries($('meta[name^="twitter:"]').map((_, el) => [[$(el).attr("name"), norm($(el).attr("content") ?? "")]]).get()),
    jsonLd: jsonLd($),
    h1: $("h1").map((_, el) => squash($(el).text())).get(),
    links: $("a[href]").map((_, el) => norm($(el).attr("href"))).get(),
    images: $("img").map((_, el) => norm($(el).attr("src") ?? "") + " | " + norm($(el).attr("srcset") ?? "") + " | " + ($(el).attr("alt") ?? "")).get(),
  };
  $("script, style, noscript, template").remove();
  /* Schema markup Webflow printed as text is a JSON-LD script here: compared above, not as text. */
  $("head, body").contents().each((_, n) => {
    if (n.type === "text" && n.data.includes("schema.org") && /^\s*\{/.test(n.data)) $(n).remove();
  });
  out.text = squash($("body").text());
  return out;
}

/**
 * Intended differences from the live site.
 * The 404 page: Next.js marks not-found responses noindex, which is what a 404 should be anyway.
 */
function expectedDifference(route, key, live, local) {
  return route.status === 404 && key === "robots" && live === null && local === "noindex";
}

const captureFile = (r) =>
  r.status === 404 ? path.join(CAP, "404.html") : path.join(CAP, r.query ? "paged" : "pages", `${r.key}.html`);

const failures = [];
const queue = [...routes];
await Promise.all(
  Array.from({ length: 8 }, async () => {
    while (queue.length) {
      const r = queue.shift();
      const url = `${BASE}${r.status === 404 ? "/this-page-does-not-exist" : r.path}${r.query ? `?${r.query}` : ""}`;
      const res = await fetch(url, { redirect: "manual" });
      if (res.status !== r.status) {
        failures.push(`${url}: status ${res.status}, expected ${r.status}`);
        continue;
      }
      const want = facts(fs.readFileSync(captureFile(r), "utf8"));
      const got = facts(await res.text());
      for (const key of Object.keys(want)) {
        if (JSON.stringify(want[key]) !== JSON.stringify(got[key]) && !expectedDifference(r, key, want[key], got[key])) {
          failures.push(`${url}: ${key} differs\n    live:  ${JSON.stringify(want[key]).slice(0, 300)}\n    local: ${JSON.stringify(got[key]).slice(0, 300)}`);
        }
      }
    }
  }),
);

console.log(`${routes.length} pages compared with the published Webflow site`);
if (failures.length) {
  console.log(`${failures.length} difference(s):\n${failures.slice(0, 40).join("\n")}`);
  process.exit(1);
}
console.log("identical: status, title, description, canonical, robots, Open Graph, Twitter, JSON-LD, H1, text, links, images");

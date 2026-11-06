/**
 * Blog post schema, live vs this site.
 *
 * On Webflow a script built each post's BlogPosting and FAQPage schema in the browser. This site
 * builds the same schema into the HTML (src/lib/site/post-schema.ts). This check loads every post
 * on the live site in a real browser, lets the script run, collects every JSON-LD block, and
 * compares them with the JSON-LD in the HTML this site serves, with no JavaScript at all.
 *
 *   npm run verify:post-schema [-- http://localhost:3000]
 */
import fs from "node:fs";
import { chromium } from "@playwright/test";
import { ASSET_URL_RE, assetPublicUrl } from "./lib/assets.mjs";
import * as cheerio from "cheerio";

const LOCAL = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const LIVE = "https://signalmash.com";
const posts = JSON.parse(fs.readFileSync("content/routes.json", "utf8")).filter((r) => r.path.startsWith("/post/"));

/** Same schema wherever it is served from: CDN and origin differences mapped away. */
const norm = (json) =>
  JSON.stringify(JSON.parse(json))
    .replace(ASSET_URL_RE, (u) => `{origin}${assetPublicUrl(u)}`)
    .replaceAll(LIVE, "{origin}")
    .replaceAll(LOCAL, "{origin}");

const browser = await chromium.launch();
const context = await browser.newContext();
await context.route(/\.(png|jpe?g|webp|gif|svg|woff2?|ttf|mp4)(\?|$)|googletagmanager|google-analytics|b2bjsstore|salesiq|sf-syn|zohopublic|cloudflare/, (r) => r.abort());
const page = await context.newPage();

const failures = [];
let withFaq = 0;
for (const { path } of posts) {
  await page.goto(LIVE + path, { waitUntil: "load", timeout: 90_000 });
  await page.waitForTimeout(300);
  const live = (await page.$$eval('script[type="application/ld+json"]', (els) => els.map((e) => e.textContent))).map(norm).sort();

  const html = await (await fetch(LOCAL + path)).text();
  const $ = cheerio.load(html);
  const local = $('script[type="application/ld+json"]').map((_, e) => $(e).html()).get().map(norm).sort();

  if (local.some((s) => s.includes('"FAQPage"'))) withFaq++;
  if (JSON.stringify(live) !== JSON.stringify(local)) {
    const onlyLive = live.filter((s) => !local.includes(s));
    const onlyLocal = local.filter((s) => !live.includes(s));
    failures.push(`${path}\n    live only:  ${onlyLive.map((s) => s.slice(0, 220)).join("\n                ")}\n    local only: ${onlyLocal.map((s) => s.slice(0, 220)).join("\n                ")}`);
  }
}
await browser.close();

console.log(`${posts.length} posts compared (${withFaq} with an FAQ)`);
if (failures.length) {
  console.log(`${failures.length} differ:\n${failures.slice(0, 10).join("\n")}`);
  process.exit(1);
}
console.log("every post's schema in this site's HTML equals what the live site builds in the browser");

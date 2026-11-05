/**
 * Screenshots pages on the live Webflow site and on this site, at desktop and phone widths, and
 * reports how many pixels differ.
 *
 *   npm run verify:visual [-- http://localhost:3000] [/path ...]
 *
 * Each page is scrolled top to bottom first, so Webflow's scroll-triggered animations have run on
 * both sides before the full-page screenshot. Third-party trackers and the chat widget are blocked
 * on both sides: they load at random times and are not part of the page.
 *
 * Writes tests/.output/visual/<page>-<width>-{live,local,diff}.png and prints a table.
 * Needs Python 3 with Pillow for the pixel comparison (scripts/lib/pixel-diff.py).
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const LOCAL = (args.find((a) => a.startsWith("http")) ?? "http://localhost:3000").replace(/\/$/, "");
const LIVE = "https://signalmash.com";
const PAGES = args.filter((a) => a.startsWith("/")).length
  ? args.filter((a) => a.startsWith("/"))
  : [
      "/",
      "/pricing",
      "/blog",
      "/blog?56e6ea54_page=2",
      "/post/10-benefits-of-us-short-code-toll-free-text-messaging",
      "/case-study",
      "/case-studies/0-to-98-sms-delivery-rate",
      "/resources-library",
      "/hashtags/ai",
      "/contact-us",
      "/about-us",
      "/mashpbx",
      "/sip-trunking",
      "/10dlc-messaging",
      "/developers",
    ];
const WIDTHS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844, isMobile: true, hasTouch: true },
];
const BLOCK = /googletagmanager|google-analytics|b2bjsstore|salesiq|zohopublic\.com\/widget|sf-syn\.com|doubleclick/;
const OUT = path.resolve("tests/.output/visual");
fs.mkdirSync(OUT, { recursive: true });

async function capture(context, url, file) {
  const page = await context.newPage();
  await page.route(BLOCK, (route) => route.abort());
  await page.goto(url, { waitUntil: "load", timeout: 90_000 });
  await page.evaluate(() => document.fonts.ready);
  /* Walk the page so every scroll-into-view animation fires, then return to the top. */
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: file, fullPage: true, animations: "disabled" });
  await page.close();
}

const browser = await chromium.launch();
const rows = [];
for (const vp of WIDTHS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.isMobile ?? false,
    hasTouch: vp.hasTouch ?? false,
    deviceScaleFactor: 1,
  });
  for (const p of PAGES) {
    const slug = (p === "/" ? "home" : p.slice(1)).replace(/[^a-z0-9]+/gi, "_").slice(0, 60);
    const base = path.join(OUT, `${slug}-${vp.name}`);
    await capture(context, LIVE + p, `${base}-live.png`);
    await capture(context, LOCAL + p, `${base}-local.png`);
    const result = execFileSync("python", ["-I", "scripts/lib/pixel-diff.py", `${base}-live.png`, `${base}-local.png`, `${base}-diff.png`], { encoding: "utf8" }).trim();
    rows.push(`${vp.name.padEnd(8)} ${p.padEnd(62)} ${result}`);
    console.log(rows.at(-1));
  }
  await context.close();
}
await browser.close();
fs.writeFileSync(path.join(OUT, "report.txt"), rows.join("\n") + "\n");

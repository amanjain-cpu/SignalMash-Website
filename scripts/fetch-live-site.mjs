/**
 * Step 1 of the Webflow import: capture the PUBLISHED site exactly as visitors and Google see it.
 *
 *   node scripts/fetch-live-site.mjs [origin]      (default origin: https://signalmash.com)
 *
 * Writes into capture/ (gitignored):
 *   sitemap.xml, robots.txt     verbatim copies, served unchanged from public/
 *   pages/<key>.html            one file per sitemap URL ("/" is index.html, "/a/b" is a__b.html)
 *   paged/<key>@<q>.html        every Webflow collection-list page ("/blog?56e6ea54_page=2")
 *   404.html                    the custom not-found page
 *
 * The live site is the source of truth on purpose: it is what is indexed. Run this again right
 * before the DNS cutover so the last edits made in Webflow are not lost.
 */
import fs from "node:fs";
import path from "node:path";

const ORIGIN = (process.argv[2] ?? "https://signalmash.com").replace(/\/$/, "");
const CAP = path.resolve("capture");
const CONCURRENCY = 8;

async function get(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { redirect: "follow" });
      return { status: res.status, text: await res.text() };
    } catch (err) {
      if (attempt >= 3) throw err;
    }
  }
}

/** "/" -> "index", "/post/a-b" -> "post__a-b". Mirrored by keyForPath() in build-content. */
const fileKey = (p) => (p === "/" ? "index" : p.replace(/^\//, "").replaceAll("/", "__"));

async function pool(items, fn) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) await fn(queue.shift());
    }),
  );
}

fs.mkdirSync(path.join(CAP, "pages"), { recursive: true });
fs.mkdirSync(path.join(CAP, "paged"), { recursive: true });

const sitemap = await get(`${ORIGIN}/sitemap.xml`);
fs.writeFileSync(path.join(CAP, "sitemap.xml"), sitemap.text);
fs.writeFileSync(path.join(CAP, "robots.txt"), (await get(`${ORIGIN}/robots.txt`)).text);

const paths = [...sitemap.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => {
  const p = new URL(m[1]).pathname.replace(/\/$/, "");
  return p === "" ? "/" : p;
});
console.log(`sitemap: ${paths.length} urls`);

const failures = [];
await pool(paths, async (p) => {
  const { status, text } = await get(ORIGIN + p);
  if (status !== 200) failures.push(`${status} ${p}`);
  fs.writeFileSync(path.join(CAP, "pages", `${fileKey(p)}.html`), text);
});

/* Collection lists paginate with "?<listId>_page=N". Follow every "next" link until the end. */
const PAGE_LINK = /href="\?([0-9a-f]+)_page=(\d+)"/g;
let paged = 0;
for (const p of paths) {
  let html = fs.readFileSync(path.join(CAP, "pages", `${fileKey(p)}.html`), "utf8");
  const seen = new Set();
  for (;;) {
    const links = [...html.matchAll(PAGE_LINK)].map((m) => ({ id: m[1], n: Number(m[2]) }));
    const next = links.sort((a, b) => b.n - a.n).find((l) => !seen.has(`${l.id}_page=${l.n}`));
    if (!next) break;
    const q = `${next.id}_page=${next.n}`;
    seen.add(q);
    const res = await get(`${ORIGIN}${p}?${q}`);
    if (res.status !== 200) failures.push(`${res.status} ${p}?${q}`);
    fs.writeFileSync(path.join(CAP, "paged", `${fileKey(p)}@${q}.html`), res.text);
    html = res.text;
    paged++;
  }
}
console.log(`collection pages: ${paged}`);

const missing = await get(`${ORIGIN}/__signalmash-import-404-probe`);
fs.writeFileSync(path.join(CAP, "404.html"), missing.text);

console.log(failures.length ? `FAILURES:\n${failures.join("\n")}` : "all pages returned 200");

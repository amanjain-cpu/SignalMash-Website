/**
 * Step 3 of the Webflow import: turn the captured site into the content the Next.js app renders.
 *
 *   node scripts/build-content.mjs
 *
 * Reads capture/ (see fetch-live-site.mjs and download-assets.mjs) and writes:
 *
 *   public/cdn/**                 every Webflow asset, at the URL assets.mjs assigns it
 *   public/sitemap.xml, robots.txt, llms.txt   verbatim copies of the live files
 *   content/routes.json           every route: path, optional collection-page query, content file
 *   content/pages/<key>.json      per page: <html>/<body> attributes and the ordered <head>
 *   content/pages/<key>.html      per page: the <body> markup, shared parts as placeholders
 *   content/shared/               header, footer, site-wide scripts and head tags, stored once
 *
 * Nothing about a page's markup is rewritten except asset URLs (now served from this site) and,
 * on six pages, schema markup Webflow printed as body text (now a real JSON-LD script). Every page
 * is re-assembled with src/lib/site/assemble.mjs and compared with the original before anything
 * is written; a single mismatch fails the build.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import * as cheerio from "cheerio";
import { ASSET_URL_RE, assetLocalPath, assetPublicPath, assetPublicUrl } from "./lib/assets.mjs";
import { assembleBody, unmarkCurrentLinks } from "../src/lib/site/assemble.mjs";

const CAP = path.resolve("capture");
const OUT = path.resolve("content");
const PUBLIC = path.resolve("public");
/** A head tag or body script used on at least this many pages is stored once, in content/shared. */
const SHARED_MIN_PAGES = 20;

/* ── Assets ─────────────────────────────────────────────────────────────────────────────────── */

const manifest = JSON.parse(fs.readFileSync(path.join(CAP, "asset-manifest.json"), "utf8"));
const available = new Set(Object.keys(manifest).filter((u) => manifest[u] === "ok"));

/**
 * Points Webflow CDN URLs at the copies served by this site. "absolute" is for places that need a
 * full URL (JSON-LD, og:image); it uses the {{SITE_URL}} placeholder resolved at render time.
 * URLs Webflow itself no longer serves (7 of them, 403 on the live site too) are left untouched.
 */
function rewriteAssets(text, mode) {
  return text.replace(ASSET_URL_RE, (raw) => {
    const url = raw.replaceAll("&amp;", "&");
    if (!available.has(url)) return raw;
    return (mode === "absolute" ? "{{SITE_URL}}" : "") + assetPublicUrl(url);
  });
}

/**
 * Asset rewriting for a fragment of HTML: JSON-LD gets absolute URLs, everything else relative.
 * Subresource-integrity hashes are dropped from tags that now load a same-origin copy: the copy is
 * byte-identical, but integrity checks only protect third-party files and the stylesheet had to be
 * rewritten (it referenced a Webflow-hosted checkbox image).
 */
function rewriteHtml(html) {
  const rewritten = html
    .split(/(<script\b[^>]*>[\s\S]*?<\/script>)/i)
    .map((part, i) => {
      if (i % 2 === 0) return rewriteAssets(part, "relative");
      const open = part.slice(0, part.indexOf(">") + 1);
      const inner = part.slice(open.length);
      const isJsonLd = /type="application\/ld\+json"/i.test(open);
      return rewriteAssets(open, "relative") + rewriteAssets(inner, isJsonLd ? "absolute" : "relative");
    })
    .join("");
  return rewritten.replace(/<(?:script|link)\b[^>]*(?:src|href)="\/cdn\/[^>]*>/g, (tag) =>
    tag.replace(/\s+integrity="[^"]*"/, "").replace(/\s+crossorigin="[^"]*"/, ""),
  );
}

function copyAssets() {
  let copied = 0;
  for (const url of available) {
    const src = path.join(CAP, "cdn", assetLocalPath(url));
    const dest = path.join(PUBLIC, assetPublicPath(url));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (/\.(css|js|json)$/i.test(dest)) {
      fs.writeFileSync(dest, rewriteAssets(fs.readFileSync(src, "utf8"), "relative"));
    } else if (!fs.existsSync(dest) || fs.statSync(dest).size !== fs.statSync(src).size) {
      fs.copyFileSync(src, dest);
    }
    copied++;
  }
  return copied;
}

/* ── Sources ────────────────────────────────────────────────────────────────────────────────── */

/** capture file name -> route. "index" is "/", "a__b" is "/a/b", "blog@x_page=2" adds a query. */
function routeFor(file) {
  const [key, query = null] = file.replace(/\.html$/, "").split("@");
  const p = key === "index" ? "/" : `/${key.replaceAll("__", "/")}`;
  return { path: p, query };
}

const sources = [
  ...fs.readdirSync(path.join(CAP, "pages")).filter((f) => f.endsWith(".html")).map((f) => ({
    file: path.join(CAP, "pages", f),
    key: f.replace(/\.html$/, ""),
    ...routeFor(f),
    status: 200,
  })),
  ...fs.readdirSync(path.join(CAP, "paged")).filter((f) => f.endsWith(".html")).map((f) => ({
    file: path.join(CAP, "paged", f),
    key: f.replace(/\.html$/, ""),
    ...routeFor(f),
    status: 200,
  })),
  { file: path.join(CAP, "404.html"), key: "_404", path: "/404", query: null, status: 404 },
];

/* ── Pass 1: parse every page ───────────────────────────────────────────────────────────────── */

const DROP_HEAD = [
  (n) => n.tag === "meta" && ("charset" in n.attrs || n.attrs.name === "viewport"), // Next emits both
  (n) => n.tag === "meta" && n.attrs.name === "generator",
  (n) => n.tag === "link" && n.attrs.rel === "preconnect" && n.attrs.href?.includes("website-files"),
];

function headNode(el, $) {
  const attrs = { ...el.attribs };
  for (const k of ["href", "src"]) if (attrs[k]) attrs[k] = rewriteAssets(attrs[k], "relative");
  if (attrs.content) attrs.content = rewriteAssets(attrs.content, "absolute");
  const local = (attrs.href ?? attrs.src ?? "").startsWith("/cdn/");
  if (local) {
    delete attrs.integrity;
    delete attrs.crossorigin;
  }
  const node = { tag: el.name, attrs };
  if (el.name === "title") node.text = $(el).text();
  if (el.name === "script" || el.name === "style") {
    const isJsonLd = attrs.type === "application/ld+json";
    node.html = rewriteAssets($(el).html() ?? "", isJsonLd ? "absolute" : "relative");
  }
  return node;
}

const loc = (el) => el.sourceCodeLocation;

/**
 * Six pages carry schema markup that Webflow printed into <head> as bare text. Text is not
 * allowed in <head>, so browsers end the head right there: every tag after it on the live site is
 * really in the body, and a script there moves the JSON into a JSON-LD tag after load. Wrapping it
 * in the JSON-LD tag at the source keeps the head intact and gives crawlers the schema without
 * running JavaScript. Anything that does not parse as JSON is left alone.
 */
function wrapHeadSchemaText(raw, fixed) {
  const headEnd = raw.indexOf("</head>");
  if (headEnd === -1) return raw;
  /* Comments, whole script/style elements and tags pass through untouched; only bare text is
     looked at, so JSON that is already inside a <script> is never wrapped twice. */
  const TOKEN = /<!--[\s\S]*?-->|<(script|style|title)\b[\s\S]*?<\/\1>|<[^>]*>|[^<]+/gi;
  const head = raw.slice(0, headEnd).replace(TOKEN, (token) => {
    if (token.startsWith("<") || !token.includes("schema.org")) return token;
    const json = token.trim();
    try {
      JSON.parse(json);
    } catch {
      return token;
    }
    fixed.push(json.slice(0, 60));
    return `<script type="application/ld+json">${json.replaceAll("</", "<\\/")}</script>`;
  });
  return head + raw.slice(headEnd);
}

const schemaFixes = [];

const parsed = sources.map((src) => {
  const raw = wrapHeadSchemaText(fs.readFileSync(src.file, "utf8"), schemaFixes);
  const $ = cheerio.load(raw, { sourceCodeLocationInfo: true });
  const htmlEl = $("html")[0];
  const bodyEl = $("body")[0];

  const head = $("head")[0]
    .children.filter((c) => c.type === "tag" || c.type === "script" || c.type === "style")
    .map((el) => headNode(el, $))
    .filter((n) => !DROP_HEAD.some((drop) => drop(n)));

  const start = loc(bodyEl).startTag.endOffset;
  const end = loc(bodyEl).endTag?.startOffset ?? raw.lastIndexOf("</body>");
  const wfPageId = htmlEl.attribs["data-wf-page"] ?? "";

  /** Edits to the raw body, as [start, end, replacement] in absolute offsets. */
  const pieces = [];
  const header = $("header.header-update")[0];
  const footer = $("footer.footer")[0];
  const headerNorm = header && unmarkCurrentLinks(raw.slice(loc(header).startOffset, loc(header).endOffset));
  const footerNorm =
    footer &&
    unmarkCurrentLinks(raw.slice(loc(footer).startOffset, loc(footer).endOffset)).replaceAll(
      `data-wf-page-id="${wfPageId}"`,
      'data-wf-page-id="{{WF_PAGE_ID}}"',
    );

  const topScripts = bodyEl.children
    .filter((c) => c.type === "script" || (c.type === "tag" && c.name === "noscript"))
    .map((c) => ({ start: loc(c).startOffset, end: loc(c).endOffset, html: raw.slice(loc(c).startOffset, loc(c).endOffset) }));

  return { src, raw, start, end, wfPageId, head, header, footer, headerNorm, footerNorm, topScripts,
    htmlAttrs: { ...htmlEl.attribs }, bodyAttrs: { ...bodyEl.attribs } };
});

/* The live 404 is Webflow's generic error page, branded with Webflow's favicon. Same page, but
   with the site's own favicon. */
const siteIcon = parsed.find((p) => p.src.path === "/").head.find((n) => n.attrs.rel === "shortcut icon");
for (const p of parsed.filter((p) => p.src.status === 404)) {
  p.head = p.head.map((n) => (n.attrs.rel === "shortcut icon" ? siteIcon : n));
}

/* ── Shared parts ───────────────────────────────────────────────────────────────────────────── */

const mode = (values) => {
  const counts = new Map();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
};
const sharedHeader = mode(parsed.map((p) => p.headerNorm));
const sharedFooter = mode(parsed.map((p) => p.footerNorm));

const hash = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 10);

/** Readable names for the site-wide custom code, so content/shared says what each file is. */
const KNOWN_CODE = [
  [/googletagmanager\.com\/gtm\.js/, "google-tag-manager"],
  [/googletagmanager\.com\/gtag\/js/, "google-analytics-loader"],
  [/gtag\('config'/, "google-analytics-config"],
  [/reb2b/, "reb2b-visitor-id"],
  [/WebFont\.load/, "google-fonts"],
  [/w-mod-/, "webflow-js-detect"],
  [/function fix\(\)/, "schema-text-fix"],
  [/_page=/, "pagination-seo"],
  [/\$zoho/, "zoho-salesiq-chat"],
  [/webfont\.js/, "google-fonts-loader"],
  [/sf-syn\.com/, "sourceforge-badge"],
  [/BlogPosting/, "blog-post-schema"],
  [/wp-content\/uploads/, "legacy-download-links"],
  [/"@type":\s*"Organization"|@graph/, "organization-schema"],
  [/finsweet/, "finsweet-attributes"],
  [/is-list-active/, "finsweet-active-style"],
];
const describe = (text, fallback) => KNOWN_CODE.find(([re]) => re.test(text))?.[1] ?? fallback;
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);

const headCounts = new Map();
for (const p of parsed) for (const n of p.head) headCounts.set(JSON.stringify(n), (headCounts.get(JSON.stringify(n)) ?? 0) + 1);
const sharedHead = new Map(); // json -> id
for (const [json, count] of headCounts) {
  if (count < SHARED_MIN_PAGES) continue;
  const n = JSON.parse(json);
  const url = n.attrs.href ?? n.attrs.src;
  const label =
    n.tag === "meta" ? `meta-${n.attrs.name ?? n.attrs.property}`
    : n.tag === "link" && n.attrs.rel !== "stylesheet" ? `link-${n.attrs.rel}-${url.split("/").pop().split("_").pop()}`
    : n.tag === "link" ? `stylesheet-${url.split("/").pop().split(".")[0]}`
    : describe(`${url ?? ""} ${n.html ?? ""}`, `${n.tag}-${hash(json).slice(0, 6)}`);
  sharedHead.set(json, slugify(label));
}

const scriptCounts = new Map();
for (const p of parsed) for (const s of p.topScripts) scriptCounts.set(s.html, (scriptCounts.get(s.html) ?? 0) + 1);
const snippetIds = new Map(); // raw html -> id
for (const [html, count] of scriptCounts) {
  if (count < SHARED_MIN_PAGES) continue;
  const src = html.match(/src="([^"]+)"/)?.[1];
  const name = src
    ? src.split(/\/|%2F/i).pop().replace(/\?.*/, "").replace(/\.js$/, "")
    : describe(html, `inline-${hash(html).slice(0, 6)}`);
  snippetIds.set(html, slugify(name));
}
const ids = [...sharedHead.values(), ...snippetIds.values()];
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dupes.length) throw new Error(`Two shared parts got the same name: ${dupes.join(", ")}`);

/* ── Pass 2: write pages, verifying each one ────────────────────────────────────────────────── */

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "pages"), { recursive: true });
fs.mkdirSync(path.join(OUT, "shared", "snippets"), { recursive: true });

const shared = {
  header: rewriteHtml(sharedHeader),
  footer: rewriteHtml(sharedFooter),
  snippets: Object.fromEntries([...snippetIds].map(([html, id]) => [id, rewriteHtml(html)])),
};

const routes = [];
const problems = [];
const inlineHeaderOrFooter = [];

for (const p of parsed) {
  const edits = [];
  if (p.header) {
    if (p.headerNorm === sharedHeader) edits.push([loc(p.header).startOffset, loc(p.header).endOffset, "<!--sm:header-->"]);
    else inlineHeaderOrFooter.push(`${p.src.key}: header`);
  }
  if (p.footer) {
    if (p.footerNorm === sharedFooter) edits.push([loc(p.footer).startOffset, loc(p.footer).endOffset, "<!--sm:footer-->"]);
    else inlineHeaderOrFooter.push(`${p.src.key}: footer`);
  }
  for (const s of p.topScripts) {
    const id = snippetIds.get(s.html);
    if (id) edits.push([s.start, s.end, `<!--sm:s:${id}-->`]);
  }
  edits.sort((a, b) => a[0] - b[0]);

  /* Build the stored body and, independently, the body the page must re-assemble to. Both are cut
     from the same raw string; only the stored one gets placeholders. */
  let stored = "";
  let expected = "";
  let at = p.start;
  for (const [s, e, replacement] of edits) {
    const between = rewriteHtml(p.raw.slice(at, s));
    stored += between + (replacement.startsWith("<!--sm:") ? replacement : rewriteHtml(replacement));
    expected += between + rewriteHtml(replacement.startsWith("<!--sm:") ? p.raw.slice(s, e) : replacement);
    at = e;
  }
  const tail = rewriteHtml(p.raw.slice(at, p.end));
  stored += tail;
  expected += tail;

  const assembled = assembleBody(stored, shared, { path: p.src.path, wfPageId: p.wfPageId, siteUrl: "{{SITE_URL}}" });
  if (assembled !== expected) {
    let i = 0;
    while (i < assembled.length && assembled[i] === expected[i]) i++;
    problems.push(`${p.src.key}: differs at ${i}\n   got:  ${assembled.slice(i - 80, i + 120)}\n   want: ${expected.slice(i - 80, i + 120)}`);
  }

  const head = p.head.map((n) => {
    const id = sharedHead.get(JSON.stringify(n));
    return id ? { shared: id } : n;
  });
  const record = {
    path: p.src.path,
    query: p.src.query,
    status: p.src.status,
    wfPageId: p.wfPageId,
    html: p.htmlAttrs,
    body: p.bodyAttrs,
    head,
  };
  fs.writeFileSync(path.join(OUT, "pages", `${p.src.key}.json`), JSON.stringify(record, null, 2) + "\n");
  fs.writeFileSync(path.join(OUT, "pages", `${p.src.key}.html`), stored);
  routes.push({ path: p.src.path, query: p.src.query, key: p.src.key, status: p.src.status });
}

if (problems.length) {
  console.error(`${problems.length} page(s) do not re-assemble to the original:\n${problems.slice(0, 5).join("\n")}`);
  process.exit(1);
}

routes.sort((a, b) => a.path.localeCompare(b.path) || String(a.query).localeCompare(String(b.query)));
fs.writeFileSync(path.join(OUT, "routes.json"), JSON.stringify(routes, null, 2) + "\n");
fs.writeFileSync(path.join(OUT, "shared", "header.html"), shared.header);
fs.writeFileSync(path.join(OUT, "shared", "footer.html"), shared.footer);
for (const [id, html] of Object.entries(shared.snippets)) {
  fs.writeFileSync(path.join(OUT, "shared", "snippets", `${id}.html`), html);
}
const headPool = Object.fromEntries([...sharedHead].map(([json, id]) => [id, JSON.parse(json)]));
fs.writeFileSync(path.join(OUT, "shared", "head.json"), JSON.stringify(headPool, null, 2) + "\n");

fs.mkdirSync(PUBLIC, { recursive: true });
fs.copyFileSync(path.join(CAP, "sitemap.xml"), path.join(PUBLIC, "sitemap.xml"));
fs.copyFileSync(path.join(CAP, "robots.txt"), path.join(PUBLIC, "robots.txt"));
fs.copyFileSync(path.join(CAP, "llms.txt"), path.join(PUBLIC, "llms.txt"));
const assetCount = copyAssets();

console.log(`routes: ${routes.length} (${routes.filter((r) => r.query).length} collection pages)`);
console.log(`shared: header, footer, ${snippetIds.size} body scripts, ${sharedHead.size} head tags`);
console.log(`assets: ${assetCount} files in public/cdn`);
console.log(`schema text moved into JSON-LD tags: ${schemaFixes.length} page(s)`);
if (inlineHeaderOrFooter.length) console.log(`kept inline (differs from the shared copy): ${inlineHeaderOrFooter.join(", ")}`);
console.log("every page re-assembles byte-for-byte to the captured original");

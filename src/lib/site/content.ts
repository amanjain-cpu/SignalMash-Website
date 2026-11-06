import "server-only";
import fs from "node:fs";
import path from "node:path";
import { assembleBody } from "./assemble.mjs";
import { POST_SCHEMA_SNIPPET, postSchema } from "./post-schema";

/**
 * Reads the site content written by scripts/build-content.mjs. See content/README.md for the
 * format. Everything is read from disk once per server process and cached.
 */

export type Attrs = Record<string, string>;

export type HeadNode = {
  tag: "title" | "meta" | "link" | "script" | "style" | "base" | "noscript";
  attrs: Attrs;
  /** <title> text */
  text?: string;
  /** <script>/<style> contents */
  html?: string;
};

type StoredHeadEntry = HeadNode | { shared: string };

export type PageRecord = {
  path: string;
  /** "56e6ea54_page=2" for a Webflow collection-list page, otherwise null */
  query: string | null;
  status: 200 | 404;
  wfPageId: string;
  html: Attrs;
  body: Attrs;
  head: StoredHeadEntry[];
};

export type Route = { path: string; query: string | null; key: string; status: 200 | 404 };

const CONTENT = path.join(process.cwd(), "content");

const read = (...parts: string[]) => fs.readFileSync(path.join(CONTENT, ...parts), "utf8");

let cache: {
  routes: Route[];
  byUrl: Map<string, Route>;
  shared: { header: string; footer: string; snippets: Record<string, string> };
  headPool: Record<string, HeadNode>;
} | null = null;

function load() {
  if (cache) return cache;
  const routes: Route[] = JSON.parse(read("routes.json"));
  const snippetDir = path.join(CONTENT, "shared", "snippets");
  cache = {
    routes,
    byUrl: new Map(routes.map((r) => [routeId(r.path, r.query), r])),
    shared: {
      header: read("shared", "header.html"),
      footer: read("shared", "footer.html"),
      snippets: Object.fromEntries(
        fs
          .readdirSync(snippetDir)
          .filter((f) => f.endsWith(".html"))
          .map((f) => [f.replace(/\.html$/, ""), read("shared", "snippets", f)]),
      ),
    },
    headPool: JSON.parse(read("shared", "head.json")),
  };
  return cache;
}

const routeId = (p: string, query: string | null) => (query ? `${p}?${query}` : p);

/* ── URL <-> route params ─────────────────────────────────────────────────────────────────────
 * Webflow paginates collection lists with a query string ("/blog?56e6ea54_page=2"), and those
 * pages have their own content. Pages are generated statically, which cannot vary by query string,
 * so src/proxy.ts rewrites that URL to "/blog/~page/56e6ea54/2" internally. The visitor's URL does
 * not change and the internal one is never served directly.
 */
export const PAGED_SEGMENT = "~page";

export function slugFor(route: Pick<Route, "path" | "query">): string[] {
  const segments = route.path === "/" ? [] : route.path.slice(1).split("/");
  if (!route.query) return segments;
  const [, listId, n] = route.query.match(/^([0-9a-f]+)_page=(\d+)$/)!;
  return [...segments, PAGED_SEGMENT, listId, n];
}

function routeForSlug(slug: string[] | undefined): Route | undefined {
  const segments = (slug ?? []).map((s) => decodeURIComponent(s));
  const at = segments.indexOf(PAGED_SEGMENT);
  if (at !== -1 && at === segments.length - 3) {
    const p = `/${segments.slice(0, at).join("/")}`;
    return load().byUrl.get(routeId(p, `${segments[at + 1]}_page=${segments[at + 2]}`));
  }
  if (at !== -1) return undefined;
  return load().byUrl.get(`/${segments.join("/")}`);
}

/** For src/proxy.ts: is there a stored collection page for this path and query? */
export function hasPagedRoute(p: string, query: string) {
  return load().byUrl.has(routeId(p, query));
}

/* ── Pages ──────────────────────────────────────────────────────────────────────────────────── */

const records = new Map<string, PageRecord>();

function record(route: Route): PageRecord {
  let r = records.get(route.key);
  if (!r) {
    r = JSON.parse(read("pages", `${route.key}.json`)) as PageRecord;
    records.set(route.key, r);
  }
  return r;
}

export function allRoutes(): Route[] {
  return load().routes.filter((r) => r.status === 200);
}

/** The page for these route params, or undefined when there is none (a 404). */
export function getPage(slug: string[] | undefined): PageRecord | undefined {
  const route = routeForSlug(slug);
  return route && route.status === 200 ? record(route) : undefined;
}

export function getNotFoundPage(): PageRecord {
  return record(load().routes.find((r) => r.status === 404)!);
}

/** The absolute origin JSON-LD and social-preview URLs point at. */
export function siteUrl() {
  return (process.env.SITE_URL ?? "https://signalmash.com").replace(/\/$/, "");
}

/**
 * Site-wide tags that report visits to third parties. ANALYTICS=off (in .env.local) leaves them
 * out, so previews on localhost do not show up in the production Google Analytics or Reb2B data.
 */
const ANALYTICS_HEAD = new Set([
  "google-tag-manager",
  "google-analytics-loader",
  "google-analytics-config",
  "reb2b-visitor-id",
]);

/** The page's <head>, in Webflow's order, with site-wide entries resolved. */
export function headFor(page: PageRecord): HeadNode[] {
  const { headPool } = load();
  const origin = siteUrl();
  const analyticsOff = process.env.ANALYTICS === "off";
  return page.head
    .filter((entry) => !(analyticsOff && "shared" in entry && ANALYTICS_HEAD.has(entry.shared)))
    .map((entry) => {
    const node = "shared" in entry ? headPool[entry.shared] : entry;
    if (!node) throw new Error(`Unknown shared head entry on ${page.path}`);
    return resolveSiteUrl(node, origin);
  });
}

function resolveSiteUrl(node: HeadNode, origin: string): HeadNode {
  const json = JSON.stringify(node);
  return json.includes("{{SITE_URL}}")
    ? (JSON.parse(json.replaceAll("{{SITE_URL}}", origin)) as HeadNode)
    : node;
}

const bodies = new Map<string, string>();

/**
 * The page's <body> markup, as Webflow published it, with one exception: the script that built
 * blog post schema in the browser is left out, because postSchema() now puts that schema in the
 * page's <head> when the page is built (see post-schema.ts).
 */
export function bodyFor(page: PageRecord): string {
  const key = keyOf(page);
  let html = bodies.get(key);
  if (html === undefined) {
    const { shared } = load();
    html = assembleBody(
      read("pages", `${key}.html`),
      { ...shared, snippets: { ...shared.snippets, [POST_SCHEMA_SNIPPET]: "" } },
      { path: page.path, wfPageId: page.wfPageId, siteUrl: siteUrl() },
    );
    bodies.set(key, html);
  }
  return html;
}

/** Schema markup generated at build time, rendered after the page's own <head> entries. */
export function generatedSchemaFor(page: PageRecord): object[] {
  return postSchema(page, headFor(page), bodyFor(page), siteUrl());
}

function keyOf(page: PageRecord): string {
  return load().byUrl.get(routeId(page.path, page.query))?.key ??
    load().routes.find((r) => r.status === 404)!.key;
}

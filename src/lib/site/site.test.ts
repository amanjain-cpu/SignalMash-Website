import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assembleBody, markCurrentLinks, unmarkCurrentLinks } from "./assemble.mjs";
import { WEBFLOW_REDIRECTS, flattenRedirects } from "./redirects";
import { assetPublicPath, assetPublicUrl } from "../../../scripts/lib/assets.mjs";

const CONTENT = path.resolve("content");
const routes: Array<{ path: string; query: string | null; key: string; status: number }> =
  JSON.parse(fs.readFileSync(path.join(CONTENT, "routes.json"), "utf8"));

describe("current-page links", () => {
  it("marks links to the current page the way Webflow does", () => {
    expect(markCurrentLinks('<a href="/pricing" class="nav-link">Pricing</a>', "/pricing")).toBe(
      '<a href="/pricing" aria-current="page" class="nav-link w--current">Pricing</a>',
    );
  });

  it("leaves links to other pages alone", () => {
    const html = '<a href="/pricing-old" class="x">a</a><a href="/blog" class="x">b</a>';
    expect(markCurrentLinks(html, "/pricing")).toBe(html);
  });

  it("removes only current-page marks, not an active tab's w--current", () => {
    const html =
      '<a href="/p" aria-current="page" class="l w--current">p</a><a data-w-tab="Tab 1" class="t w--current">t</a>';
    expect(unmarkCurrentLinks(html)).toBe(
      '<a href="/p" class="l">p</a><a data-w-tab="Tab 1" class="t w--current">t</a>',
    );
  });
});

describe("redirects", () => {
  const flat = flattenRedirects(WEBFLOW_REDIRECTS);
  const pages = new Set(routes.filter((r) => r.status === 200).map((r) => r.path));

  it("keeps every redirect Webflow had", () => {
    expect(flat).toHaveLength(35);
  });

  it("sends every old URL straight to a page that exists, in one hop", () => {
    for (const { from, to } of flat) {
      expect(pages.has(to), `${from} -> ${to}`).toBe(true);
      expect(flat.some((r) => r.from === to), `${to} is itself redirected`).toBe(false);
    }
  });

  it("resolves the three-hop nonprofit chain", () => {
    expect(flat.find((r) => r.from === "/signalmash-for-nonprofits")?.to).toBe("/non-profit");
  });

  it("never redirects a URL that is a page", () => {
    for (const { from } of flat) expect(pages.has(from), from).toBe(false);
  });
});

describe("asset URLs", () => {
  it("maps the Webflow CDN to /cdn", () => {
    expect(assetPublicUrl("https://cdn.prod.website-files.com/abc/x_Group%2030.webp")).toBe(
      "/cdn/abc/x_Group%2030.webp",
    );
  });

  it("writes parentheses plainly, which Next's static server requires", () => {
    const url = "https://cdn.prod.website-files.com/abc/x_Group%204%20%283%29.webp";
    expect(assetPublicUrl(url)).toBe("/cdn/abc/x_Group%204%20(3).webp");
    expect(assetPublicPath(url)).toBe("cdn/abc/x_Group 4 (3).webp");
  });

  it("turns an encoded slash into a real directory", () => {
    expect(assetPublicUrl("https://cdn.prod.website-files.com/a%2Fb%2Fc.js")).toBe("/cdn/a/b/c.js");
  });
});

describe("stored content", () => {
  const read = (...p: string[]) => fs.readFileSync(path.join(CONTENT, ...p), "utf8");
  const shared = {
    header: read("shared", "header.html"),
    footer: read("shared", "footer.html"),
    snippets: Object.fromEntries(
      fs
        .readdirSync(path.join(CONTENT, "shared", "snippets"))
        .map((f) => [f.replace(/\.html$/, ""), read("shared", "snippets", f)]),
    ),
  };

  it("has a page for every URL in the sitemap", () => {
    const sitemap = fs.readFileSync("public/sitemap.xml", "utf8");
    const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (m) => new URL(m[1]).pathname.replace(/\/$/, "") || "/",
    );
    const pages = new Set(routes.map((r) => r.path));
    expect(paths.length).toBeGreaterThan(300);
    for (const p of paths) expect(pages.has(p), p).toBe(true);
  });

  it("assembles every page: all placeholders resolve, none are left over", () => {
    for (const r of routes) {
      const record = JSON.parse(read("pages", `${r.key}.json`));
      const html = assembleBody(read("pages", `${r.key}.html`), shared, {
        path: record.path,
        wfPageId: record.wfPageId,
        siteUrl: "https://signalmash.com",
      });
      expect(html, r.key).not.toMatch(/<!--sm:|\{\{(SITE_URL|WF_PAGE_ID)\}\}/);
    }
  }, 120_000);

  it("has no links left to Webflow's CDN, except files Webflow no longer serves", () => {
    const leftovers = new Set<string>();
    for (const r of routes) {
      for (const m of read("pages", `${r.key}.html`).matchAll(/https:\/\/cdn\.prod\.website-files\.com\/[^"'\s)]+/g)) {
        leftovers.add(m[0]);
      }
    }
    /* 7 files return 403 on the live site too (see capture/asset-manifest.json). */
    expect(leftovers.size).toBeLessThanOrEqual(7);
  }, 120_000);
});

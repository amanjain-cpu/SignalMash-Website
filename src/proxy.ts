import { NextResponse, type NextRequest } from "next/server";
import routes from "../content/routes.json";

/**
 * Three URL behaviours of the live site that are not plain page routes.
 *
 *  1. "/blog/" answers 301 to "/blog" (Webflow's behaviour; Next's own redirect would be a 308).
 *  2. "www.signalmash.com" answers 301 to "signalmash.com", the canonical host.
 *  3. Collection-list pages ("/blog?56e6ea54_page=2") are rewritten, invisibly, to the internal
 *     route their static page was generated at. See PAGED_SEGMENT in src/lib/site/content.ts.
 *
 * The 35 Webflow 301 redirects are in next.config.ts and run before this.
 */

const PAGED_PARAM = /^([0-9a-f]+)_page$/;
const pagedUrls = new Set(
  (routes as Array<{ path: string; query: string | null }>)
    .filter((r) => r.query)
    .map((r) => `${r.path}?${r.query}`),
);

export function proxy(req: NextRequest) {
  const url = req.nextUrl;
  const host = req.headers.get("host") ?? "";

  if (host.startsWith("www.")) {
    return NextResponse.redirect(`https://${host.slice(4)}${url.pathname}${url.search}`, 301);
  }

  /* Built by hand: a clone of nextUrl remembers the original trailing slash and puts it back. */
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    const target = new URL(req.url);
    target.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return NextResponse.redirect(target, 301);
  }

  /* The internal route is never served under its own URL: it would be duplicate content. */
  if (url.pathname.split("/").includes("~page")) {
    const target = url.clone();
    target.pathname = "/__not-found";
    return NextResponse.rewrite(target);
  }

  /* Other parameters (utm_*, Finsweet's own) may come along; only the list's page number counts. */
  for (const [name, value] of url.searchParams) {
    const listId = name.match(PAGED_PARAM)?.[1];
    if (!listId || !pagedUrls.has(`${url.pathname}?${name}=${value}`)) continue;
    const target = url.clone();
    target.pathname = `${url.pathname === "/" ? "" : url.pathname}/~page/${listId}/${value}`;
    return NextResponse.rewrite(target);
  }

  return NextResponse.next();
}

export const config = {
  /* Pages only: not Next's own files, and not the mirrored Webflow assets in public/. */
  matcher: ["/((?!_next/|cdn/|sitemap\\.xml|robots\\.txt).*)"],
};

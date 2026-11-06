import redirects from "./redirects.json";

/**
 * The 301 redirects configured in Webflow (Site settings → Publishing → 301 redirects), copied on
 * 2026-11-05 and checked against the live site: every one answered 301 to its target.
 *
 * The list is in redirects.json so both ways of serving the site read the same one: the Next.js
 * server (next.config.ts) and the Cloudflare Pages build (scripts/build-cloudflare.mjs).
 * To add a redirect, add a line there. Nothing else needs to change.
 *
 * Several were chains on Webflow (/signalmash-for-nonprofits took three hops to reach
 * /non-profit). `flattenRedirects` points every old URL straight at its final page, which is what
 * search engines prefer; the pages people land on are unchanged.
 */
export const WEBFLOW_REDIRECTS = redirects as unknown as ReadonlyArray<
  readonly [from: string, to: string]
>;

/** Resolves every chain to its final destination. Throws on a loop. */
export function flattenRedirects(
  rules: ReadonlyArray<readonly [string, string]>,
): Array<{ from: string; to: string }> {
  const next = new Map(rules);
  return rules.map(([from]) => {
    const seen = new Set([from]);
    let to = next.get(from)!;
    while (next.has(to)) {
      if (seen.has(to)) throw new Error(`Redirect loop: ${[...seen, to].join(" -> ")}`);
      seen.add(to);
      to = next.get(to)!;
    }
    return { from, to };
  });
}

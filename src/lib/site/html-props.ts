import type { Attrs } from "./content";

/** HTML attribute names whose React prop is spelled differently. */
const RENAMED: Record<string, string> = {
  class: "className",
  charset: "charSet",
  "http-equiv": "httpEquiv",
  crossorigin: "crossOrigin",
  itemprop: "itemProp",
  hreflang: "hrefLang",
  referrerpolicy: "referrerPolicy",
  fetchpriority: "fetchPriority",
  nomodule: "noModule",
  "accept-charset": "acceptCharset",
  tabindex: "tabIndex",
};

const BOOLEAN = new Set(["async", "defer", "nomodule"]);

/**
 * Attributes captured from Webflow's HTML, as React props. `data-*` and `aria-*` pass through
 * unchanged; boolean attributes written as `async=""` become `true`.
 */
export function toProps(attrs: Attrs): Record<string, string | boolean> {
  const props: Record<string, string | boolean> = {};
  for (const [name, value] of Object.entries(attrs)) {
    props[RENAMED[name] ?? name] = BOOLEAN.has(name) ? true : value;
  }
  return props;
}

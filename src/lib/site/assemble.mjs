/**
 * Turns a stored page back into the exact <body> markup Webflow published.
 *
 * Plain JavaScript on purpose: the content build (scripts/build-content.mjs) runs it over every
 * page and compares the result with the captured original, byte for byte, so the importer and the
 * app can never disagree about how a page is put together.
 *
 * Stored page bodies contain placeholders for markup shared across the site:
 *   <!--sm:header-->      content/shared/header.html  (the nav and the announcement bar)
 *   <!--sm:footer-->      content/shared/footer.html  (has {{WF_PAGE_ID}} in the newsletter form)
 *   <!--sm:s:<id>-->      content/shared/snippets/<id>.html  (site-wide scripts)
 * and {{SITE_URL}} wherever an absolute URL is required (JSON-LD), so the same content serves
 * localhost, a preview deployment and production.
 */

const PLACEHOLDER = /<!--sm:(header|footer|s:[a-z0-9-]+)-->/g;

/**
 * Webflow marks every link to the current page: it adds `aria-current="page"` directly after the
 * href attribute and appends `w--current` to the class list. The shared header and footer are
 * stored with those marks removed and get them back here, per page.
 *
 * @param {string} html
 * @param {string} path  the page path, e.g. "/pricing"
 */
export function markCurrentLinks(html, path) {
  const href = `href="${path}"`;
  return html.replace(/<a\b[^>]*>/g, (tag) => {
    const at = tag.indexOf(` ${href}`);
    if (at === -1) return tag;
    const afterHref = at + 1 + href.length;
    let out = `${tag.slice(0, afterHref)} aria-current="page"${tag.slice(afterHref)}`;
    out = /\sclass="/.test(out)
      ? out.replace(/(\sclass="[^"]*)"/, '$1 w--current"')
      : out.replace(/>$/, ' class="w--current">');
    return out;
  });
}

/**
 * Removes what markCurrentLinks adds, and nothing else: `w--current` also marks the active tab of
 * a Webflow tabs component, which is not a current-page link and has no aria-current.
 * Used by the importer to normalise shared markup.
 */
export function unmarkCurrentLinks(html) {
  return html.replace(/<a\b[^>]* aria-current="page"[^>]*>/g, (tag) =>
    tag.replace(' aria-current="page"', "").replace(" w--current", ""),
  );
}

/**
 * @param {string} content  the stored page body
 * @param {{ header: string, footer: string, snippets: Record<string, string> }} shared
 * @param {{ path: string, wfPageId: string, siteUrl: string }} ctx
 */
export function assembleBody(content, shared, ctx) {
  const html = content.replace(PLACEHOLDER, (_, name) => {
    if (name === "header") return markCurrentLinks(shared.header, ctx.path);
    if (name === "footer") {
      return markCurrentLinks(shared.footer.replaceAll("{{WF_PAGE_ID}}", ctx.wfPageId), ctx.path);
    }
    const snippet = shared.snippets[name.slice(2)];
    if (snippet === undefined) throw new Error(`Unknown snippet "${name}" on ${ctx.path}`);
    return snippet;
  });
  return html.replaceAll("{{SITE_URL}}", ctx.siteUrl);
}

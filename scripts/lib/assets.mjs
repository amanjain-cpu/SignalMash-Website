/**
 * Where Webflow-hosted files live before and after the migration. Shared by the downloader and the
 * content build so both agree on every path.
 *
 *   https://cdn.prod.website-files.com/<p>        ->  /cdn/<p>
 *   https://d3e54v103j8qbb.cloudfront.net/<p>     ->  /cdn/_webflow/<p>   (jQuery, form checkbox svg)
 *   https://app-assets.website-files.com/<p>      ->  /cdn/_webflow-app/<p>  (the 404 page's stylesheet)
 *
 * Webflow percent-encodes "/" as %2F inside some custom-code URLs. Those become real directories,
 * because a static server will not resolve an encoded slash to a file.
 */

export const ASSET_HOSTS = [
  "cdn.prod.website-files.com",
  "d3e54v103j8qbb.cloudfront.net",
  "app-assets.website-files.com",
];

/**
 * A Webflow asset URL inside HTML, CSS or JS. File names can contain balanced parentheses
 * ("Untitled design (4).png") and commas not followed by whitespace; ", " separates srcset
 * candidates and a bare ")" closes a CSS url().
 */
export const ASSET_URL_RE =
  /https?:\/\/(?:cdn\.prod\.website-files\.com|d3e54v103j8qbb\.cloudfront\.net|app-assets\.website-files\.com)\/(?:[^"'\s()<>,\\]|\([^"'\s()<>\\]*\)|,(?!\s))+/g;

/** Percent-decode once, leaving malformed escapes alone (Python's urllib.parse.unquote behaviour). */
export function decodeOnce(s) {
  return s.replace(/(?:%[0-9A-Fa-f]{2})+/g, (run) => {
    try {
      return decodeURIComponent(run);
    } catch {
      return run;
    }
  });
}

/** capture/cdn/<this>: "<first host label>/<decoded path>". */
export function assetLocalPath(url) {
  const u = new URL(url);
  return [u.hostname.split(".")[0], ...decodeOnce(u.pathname).replace(/^\//, "").split("/")].join(
    "/",
  );
}

/** The site-relative URL the file is served from after the migration. */
export function assetPublicUrl(url) {
  const u = new URL(url);
  /* Next's static file server matches "(" and ")" only when written plainly, not as %28/%29
     ("Group%204%20%283%29.webp" is a 404, "Group%204%20(3).webp" is served). Webflow writes most
     of its URLs with plain parentheses already; this makes the rest match. */
  const p = u.pathname.replace(/%2F/gi, "/").replace(/%28/gi, "(").replace(/%29/gi, ")");
  if (u.hostname === "cdn.prod.website-files.com") return `/cdn${p}`;
  if (u.hostname === "app-assets.website-files.com") return `/cdn/_webflow-app${p}`;
  return `/cdn/_webflow${p}`;
}

/** public/<this>: the file a static server finds for assetPublicUrl(url). */
export function assetPublicPath(url) {
  return decodeOnce(assetPublicUrl(url)).replace(/^\//, "");
}

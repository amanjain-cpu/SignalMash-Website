/**
 * A page's body markup, exactly as Webflow published it.
 *
 * It is server-rendered as HTML rather than converted to React components, deliberately:
 * webflow.js (nav menus, tabs, sliders, scroll animations), Finsweet's blog filters and the
 * custom scripts all change this markup in the browser. React must never reconcile it, or it
 * would undo their work on hydration. Scripts inside it run as the browser parses the page, in
 * the same order as on Webflow.
 *
 * `display: contents` makes the wrapper invisible to layout, so the page's elements behave as
 * direct children of <body> exactly as they did on Webflow (nothing in the stylesheet selects on
 * `body >`; checked when the site was imported).
 */
export function WebflowBody({ html }: { html: string }) {
  return (
    <div
      style={{ display: "contents" }}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

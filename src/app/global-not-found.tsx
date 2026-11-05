import { bodyFor, getNotFoundPage, headFor } from "@/lib/site/content";
import { HeadNodes } from "@/lib/site/head-nodes";
import { toProps } from "@/lib/site/html-props";
import { WebflowBody } from "@/lib/site/webflow-body";

/**
 * Any URL without a page gets the live site's 404 page, with a 404 status.
 *
 * Every real page is generated at build time and app/[[...slug]]/page.tsx sets
 * `dynamicParams = false`, so an unknown URL never reaches the page route at all: Next.js answers
 * it with this document directly. It has to be a whole document because the root layout lives
 * inside the catch-all segment (see that layout for why).
 */
export default function GlobalNotFound() {
  const page = getNotFoundPage();
  return (
    <html {...toProps(page.html)}>
      <head>
        <HeadNodes nodes={headFor(page)} />
      </head>
      <body {...toProps(page.body)}>
        <WebflowBody html={bodyFor(page)} />
      </body>
    </html>
  );
}

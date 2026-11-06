import type { ReactNode } from "react";
import { generatedSchemaFor, getNotFoundPage, getPage, headFor } from "@/lib/site/content";
import { HeadNodes } from "@/lib/site/head-nodes";
import { toProps } from "@/lib/site/html-props";
import { newsletterScript } from "@/lib/site/newsletter";
import "../globals.css";

/**
 * The root layout lives inside the catch-all segment, not at app/layout.tsx, because every page
 * has its own <html> attributes and its own <head>:
 *
 *  · <html data-wf-page="…"> tells webflow.js which page's interactions to run (scroll and load
 *    animations, the nav menus). Without the right id, animated elements stay invisible.
 *  · the <head> is the page's SEO: title, description, canonical, Open Graph, schema markup, in
 *    the order Webflow published them.
 *
 * suppressHydrationWarning on <html> and <body>: Webflow's own script adds classes to <html>
 * (w-mod-js, w-mod-ix) before React hydrates, and the chat widget appends to <body>. Both are
 * expected, and neither element is ever re-rendered by React.
 */
export default async function RootLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const page = getPage(slug) ?? getNotFoundPage();

  return (
    <html {...toProps(page.html)} suppressHydrationWarning>
      <head>
        <HeadNodes nodes={headFor(page)} />
        {generatedSchemaFor(page).map((schema, i) => (
          <script
            key={`schema-${i}`}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replaceAll("<", "\\u003c") }}
          />
        ))}
        <script dangerouslySetInnerHTML={{ __html: newsletterScript() }} />
      </head>
      <body {...toProps(page.body)} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

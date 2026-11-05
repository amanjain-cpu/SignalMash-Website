import { notFound } from "next/navigation";
import { allRoutes, bodyFor, getPage, slugFor } from "@/lib/site/content";
import { WebflowBody } from "@/lib/site/webflow-body";

/**
 * Every page, and every collection-list page, is generated at build time. Any other URL is not a
 * page: it is answered by app/global-not-found.tsx.
 *
 * Must stay false. With true, an unknown URL reaches notFound() below, and because the root
 * layout lives in this dynamic segment Next.js can only answer with its bare error shell, not the
 * 404 page (tested on 16.2.10). With false, Next.js 16.2.10 logs "Error: Internal: NoFallbackError"
 * once per unknown URL; the response itself is correct (404 with the 404 page), so it is noise.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return allRoutes().map((route) => ({ slug: slugFor(route) }));
}

export default async function Page({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  const page = getPage(slug);
  if (!page) notFound();
  return <WebflowBody html={bodyFor(page)} />;
}

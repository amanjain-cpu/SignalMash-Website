import * as cheerio from "cheerio";
import type { HeadNode } from "./content";

/**
 * Blog post schema markup (BlogPosting, plus FAQPage when the post has an FAQ), generated when the
 * page is built.
 *
 * On Webflow, a site-wide script built this in the visitor's browser after the page loaded
 * (content/shared/snippets/blog-post-schema.html). Search engines that run JavaScript saw it; most
 * AI crawlers (GPTBot, ClaudeBot, PerplexityBot) do not run JavaScript, so on the live site they
 * never saw it. This is the same logic, rule for rule, run on the page's HTML instead, so the
 * schema is in the page itself. The browser script is left out of the page (see content.ts), so
 * nothing is added twice.
 *
 * Only for /post/ pages with a rich-text body, as before.
 */

/** Webflow's text clean-up: zero-width characters out, whitespace collapsed (like the script). */
const txt = (s: string) => s.replace(/[​‍﻿]/g, "").replace(/\s+/g, " ").trim();

export const POST_SCHEMA_SNIPPET = "blog-post-schema";

export function postSchema(
  page: { path: string },
  head: HeadNode[],
  bodyHtml: string,
  origin: string,
): object[] {
  if (!page.path.startsWith("/post/")) return [];
  const $ = cheerio.load(bodyHtml);
  const rt = $(".w-richtext").first();
  if (!rt.length) return [];

  const meta = (match: (n: HeadNode) => boolean) => head.find((n) => n.tag === "meta" && match(n))?.attrs.content;
  const title = head.find((n) => n.tag === "title")?.text ?? "";
  const h1 = $("h1").first();
  const url = origin + page.path;

  /* 1. BlogPosting, with speakable: the quick answer is the first h2 and the paragraph after it. */
  const post: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: h1.length ? txt(h1.text()) : title,
    description: meta((n) => n.attrs.name === "description") ?? "",
    mainEntityOfPage: url,
    url,
    inLanguage: "en-US",
    author: { "@type": "Organization", name: "Signalmash", url: "https://www.signalmash.com/" },
    publisher: {
      "@type": "Organization",
      name: "Signalmash",
      url: "https://www.signalmash.com/",
      logo: {
        "@type": "ImageObject",
        url: `${origin}/cdn/68a3572908cc6b1214445ee3/68f9032823611c6fafc614cf_Group%2030.webp`,
      },
    },
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: [".w-richtext > h2:first-of-type", ".w-richtext > h2:first-of-type + p"],
    },
  };
  const image = meta((n) => n.attrs.property === "og:image");
  if (image) post.image = image;
  const published = meta((n) => n.attrs.property === "article:published_time");
  if (published) post.datePublished = published;
  const modified = meta((n) => n.attrs.property === "article:modified_time");
  if (modified) post.dateModified = modified;

  /* 2. FAQPage, from a "People also ask" or "Frequently asked questions" section: each question
        (an h3/h4/h5, or a short bold paragraph ending in "?") with the paragraph(s) after it. */
  const qa: object[] = [];
  const kids = rt.children().toArray();
  let faq = false;
  for (let i = 0; i < kids.length; i++) {
    const el = kids[i];
    const tag = el.tagName.toUpperCase();
    if (tag === "H2") {
      const t = txt($(el).text()).toLowerCase();
      faq = t.startsWith("people also ask") || t.startsWith("frequently asked");
      continue;
    }
    if (!faq) continue;
    const text = txt($(el).text());
    const isQuestion =
      tag === "H3" || tag === "H4" || tag === "H5" ||
      (tag === "P" && $(el).find("strong").length > 0 && text.endsWith("?") && text.length < 160);
    if (!isQuestion) continue;
    const answer: string[] = [];
    let j = i + 1;
    while (j < kids.length && kids[j].tagName.toUpperCase() === "P") {
      const pt = txt($(kids[j]).text());
      if (pt) answer.push(pt);
      if (answer.length >= 2) break;
      j++;
    }
    if (text && answer.length && text.endsWith("?")) {
      qa.push({ "@type": "Question", name: text, acceptedAnswer: { "@type": "Answer", text: answer.join(" ") } });
    }
    i = j - 1;
  }

  return qa.length
    ? [post, { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: qa }]
    : [post];
}

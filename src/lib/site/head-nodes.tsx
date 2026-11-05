import type { HeadNode } from "./content";
import { toProps } from "./html-props";

/**
 * Renders a page's <head> entries in Webflow's order: title, SEO and social meta, canonical,
 * the Webflow stylesheet, Google Fonts, analytics, schema markup and the page's own custom code.
 */
export function HeadNodes({ nodes }: { nodes: HeadNode[] }) {
  return nodes.map((node, i) => {
    const props = toProps(node.attrs);
    switch (node.tag) {
      case "title":
        return <title key={i}>{node.text}</title>;
      case "meta":
        return <meta key={i} {...props} />;
      case "link":
        return <link key={i} {...props} />;
      case "base":
        return <base key={i} {...props} />;
      case "style":
        return <style key={i} {...props} dangerouslySetInnerHTML={{ __html: node.html ?? "" }} />;
      case "script":
        return node.html ? (
          <script key={i} {...props} dangerouslySetInnerHTML={{ __html: node.html }} />
        ) : (
          <script key={i} {...props} />
        );
      case "noscript":
        return <noscript key={i} {...props} dangerouslySetInnerHTML={{ __html: node.html ?? "" }} />;
    }
  });
}

# SignalMash-Website

signalmash.com, moved off Webflow onto Next.js. Frontend only: there is no backend, database or
admin panel. Same stack as ValueOS's web app: Next.js 16, React 19, TypeScript, Tailwind 4,
Vitest, Playwright.

## Run it

```bash
npm install
npm run build
npm start            # http://localhost:3000
```

`npm run dev` also works, but `build` + `start` is what production serves. Put `ANALYTICS=off` in
`.env.local` (gitignored) so local visits are not sent to the production Google Analytics, GTM and
Reb2B accounts.

Requires Node 20.9 or later.

## What "the same as the live site" means here

The site was imported from the published Webflow site on 2026-11-05, and checked against it:

| Check | Result |
| --- | --- |
| Pages | all 328 sitemap URLs, plus 61 collection-list pages (`/blog?56e6ea54_page=2` … `=16`, the hashtag lists), plus the 404 page |
| Markup | every page's `<body>` re-assembles byte-for-byte to Webflow's (checked on every `npm run import:build`) |
| SEO | `npm run verify:seo`: status, title, description, canonical, robots, Open Graph, Twitter card, every JSON-LD block, H1s, visible text, every link and every image, identical on all 390 URLs |
| Looks | `npm run verify:visual`: full-page screenshots of live and local at 1440px and 390px, compared pixel by pixel |
| Redirects | the 35 Webflow 301s, plus `/path/` → `/path` and `www.` → apex, all as 301 |
| AEO | `robots.txt` (allows GPTBot, ClaudeBot, PerplexityBot …) and `llms.txt` identical to live |
| Files | all 1,134 images, PDFs, CSS and JS files Webflow hosted are served from `/cdn/` here (7 more were already broken on Webflow) |

Deliberate differences, all improvements:

- On 6 pages Webflow printed the schema markup as text in `<head>`, which made browsers end the
  head early; a script repaired it after load. Here it is a proper JSON-LD tag from the start.
- Redirect chains (e.g. three hops for `/signalmash-for-nonprofits`) go to the final page in one hop.
- The 404 page uses the Signalmash favicon instead of Webflow's, and is marked `noindex`.
- Blog post schema (BlogPosting on all 181 posts, FAQPage on the 45 with an FAQ) is in the page
  HTML. On Webflow a script added it after load, so crawlers that do not run JavaScript, which
  includes most AI crawlers, never saw it. `npm run verify:post-schema` checks it is identical to
  what that script builds.

## How it works

Pages are stored as the HTML Webflow published and served as static pages by Next.js. They are
deliberately not rewritten into React components: Webflow's runtime (menus, tabs, sliders, scroll
animations), the Finsweet blog filters and the site's custom scripts all work on that exact
markup, and converting it would mean re-implementing all of them, with visible differences.

```
content/
  routes.json              every URL the site serves
  pages/<page>.html        a page's body; shared parts appear as <!--sm:header--> etc.
  pages/<page>.json        the page's <head> (title, SEO, schema) and <html>/<body> attributes
  shared/header.html       the navigation and announcement bar, used by every page
  shared/footer.html       the footer, used by every page
  shared/head.json         site-wide <head> tags: Google Tag Manager, Analytics, fonts, schema …
  shared/snippets/         site-wide scripts at the end of <body>: jQuery, Webflow, Zoho chat …
public/
  cdn/                     the files Webflow hosted (images, PDFs, CSS, JS)
  sitemap.xml, robots.txt  copies of the live ones
  llms.txt                 the site summary for AI models (not in the sitemap)
src/
  app/[[...slug]]/         the one route: every page goes through it
  app/global-not-found.tsx the 404 page
  proxy.ts                 trailing slash, www, collection-list pagination
  lib/site/redirects.ts    the 35 Webflow redirects
  lib/site/newsletter.ts   the footer newsletter form (see below)
scripts/                   the Webflow import and the checks
```

### Editing content

There is no CMS. To change a page, edit its file in `content/pages/` and deploy. To change the
navigation or footer, edit `content/shared/header.html` or `footer.html`: it changes on every
page. To add a redirect, add a line to `src/lib/site/redirects.ts`.

A new page needs an entry in `content/routes.json`, a `.json` and an `.html` file in
`content/pages/` (copy an existing page of the same kind), and a `<url>` in `public/sitemap.xml`.

### Forms

- **Contact Us, Get Started, MashPBX and RCS Studio onboarding, Reseller/Affiliate**: these are
  Zoho Forms embedded in the pages. They keep working unchanged.
- **Blog search and filters** run in the browser (Finsweet Attributes). Nothing to configure.
- **Footer newsletter** ("Stay Updated"): Webflow's form service handled this one and goes away
  with Webflow. Create a Zoho form with one Email field that notifies the team, then set its
  submit URL in the environment:

  ```
  NEWSLETTER_FORM_ACTION=https://forms.zohopublic.com/mashtech/form/<Form>/formperma/<key>/htmlRecords/submit
  NEWSLETTER_EMAIL_FIELD=Email     # the field's name in that form
  ```

  Until it is set, submitting shows the form's existing error message and sends nothing.

## Cloudflare Pages (shareable preview)

The site also builds as plain files, for Cloudflare Pages:

```bash
npx wrangler@3 login          # once per machine; opens the browser
npm run build:cloudflare      # out/: every page, the assets, and out/_worker.js
npm run deploy:cloudflare     # https://signalmash-website.pages.dev
```

A static host has no Next.js server, so `out/_worker.js` (from `cloudflare/worker.template.js`)
does what `src/proxy.ts` and `next.config.ts` do on a Node host: the 35 redirects, `/path/` →
`/path`, collection-list pages, and 404s. `npm run verify:seo -- <url>` passes against it.

On a `*.pages.dev` address every page is sent with `X-Robots-Tag: noindex`, so the preview is never
indexed as a duplicate of signalmash.com. Analytics are off in builds made with this repo's
`.env.local` (`ANALYTICS=off`), so preview visits stay out of the production numbers.

Wrangler 3 is used because Wrangler 4 needs Node 22.

## Re-importing from Webflow

If anything is edited in Webflow before the switch, import again so it is not lost:

```bash
npm run import:fetch      # capture the live site into capture/ (gitignored)
npm run import:assets     # download every Webflow-hosted file
npm run import:build      # write content/ and public/, verifying every page
npm run build && npm start
npm run verify:seo        # compare every page with the live site
npm run verify:post-schema  # blog post schema vs what the live site builds in the browser
npm run verify:visual     # screenshot comparison (needs Python 3 + Pillow)
```

## Environment

| Variable | Default | |
| --- | --- | --- |
| `SITE_URL` | `https://signalmash.com` | origin used in JSON-LD and social-preview image URLs |
| `ANALYTICS` | on | `off` leaves out GTM, Google Analytics and Reb2B (local previews) |
| `NEWSLETTER_FORM_ACTION` | none | where the footer newsletter form posts |
| `NEWSLETTER_EMAIL_FIELD` | `Email` | the email field's name at that URL |
| `NEXT_OUTPUT` | none | `standalone`: a self-contained server for a Docker image; `export`: plain files (used by `build:cloudflare`) |

## Before switching DNS

1. Run the re-import above, so the last Webflow edits are included.
2. Set up the newsletter Zoho form and `NEWSLETTER_FORM_ACTION`.
3. Deploy, and run `npm run verify:seo -- https://<deployment-url>`.
4. Point `signalmash.com` and `www.signalmash.com` at the deployment.
5. In Google Search Console, resubmit `https://signalmash.com/sitemap.xml`.
6. Only then cancel the Webflow site plan: until the switch, the live site still loads from it.

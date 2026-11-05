/**
 * The 301 redirects configured in Webflow (Site settings → Publishing → 301 redirects), copied on
 * 2026-11-05 and checked against the live site: every one answered 301 to the target below.
 *
 * Several were chains on Webflow (/signalmash-for-nonprofits took three hops to reach
 * /non-profit). `flattenRedirects` points every old URL straight at its final page, which is what
 * search engines prefer; the pages people land on are unchanged.
 *
 * To add a redirect, add a line here. Nothing else needs to change.
 */
export const WEBFLOW_REDIRECTS: ReadonlyArray<readonly [from: string, to: string]> = [
  ["/customer-support-as-service", "/support-as-a-service"],
  ["/welcome-to-the-signalmash-developer-hub", "/developers"],
  ["/signalmash-for-marketers", "/marketing"],
  ["/signalmash-for-product-leaders", "/product"],
  ["/signalmash-for-customer-experience", "/customer-experience"],
  ["/fraud-prevention-with-signalmash", "/fraud-prevention"],
  ["/appointment-reminders-that-keep-your-business-on-schedule", "/appointment-reminders"],
  ["/real-time-lead-alerts-with-signalmash", "/lead-alerts"],
  ["/mass-texting-made-simple-with-signalmash", "/mass-texting"],
  ["/sms-marketing-that-gets-read-and-gets-results", "/sms-marketing"],
  ["/grow-revenue-with-signalmash-cpaas", "/cross-sell-and-upsell"],
  ["/signalmash-healthcare-solutions", "/healthcare-solutions"],
  ["/signalmash-ecommerce-solution", "/ecommerce"],
  ["/signalmash-for-hospitality", "/hospitality"],
  ["/nonprofit", "/non-profit"],
  ["/signalmash-for-nonprofit", "/nonprofit"],
  ["/retail-messaging-customer-engagement-solutions", "/retail"],
  ["/collections-as-a-service", "/payments-as-a-service"],
  ["/signalchat", "/coaas"],
  ["/signalmash-ecommerce-solutions", "/signalmash-ecommerce-solution"],
  ["/signalmash-for-nonprofits", "/signalmash-for-nonprofit"],
  ["/ccaas", "/signalcaas"],
  ["/messaging-app", "/signalchat"],
  ["/identity-services-number-intelligence", "/identity"],
  ["/number", "/numbers"],
  ["/nationwide-sms-mms", "/toll-free-messaging"],
  ["/text-messaging-api", "/text-messaging"],
  ["/sip-trunking-local-termination", "/local-termination"],
  ["/sms-marketing-that-gets-read----and-gets-results", "/sms-marketing-that-gets-read-and-gets-results"],
  ["/number-intellegence", "/number-intelligence"],
  ["/new-toll-free-numbers", "/toll-free-numbers"],
  ["/new-local-numbers", "/local-numbers"],
  ["/new-10dlc-messaging", "/10dlc-messaging"],
  ["/new-toll-free-origination", "/toll-free-origination"],
  ["/new-about-us", "/about-us"],
];

/** Resolves every chain to its final destination. Throws on a loop. */
export function flattenRedirects(
  rules: ReadonlyArray<readonly [string, string]>,
): Array<{ from: string; to: string }> {
  const next = new Map(rules);
  return rules.map(([from]) => {
    const seen = new Set([from]);
    let to = next.get(from)!;
    while (next.has(to)) {
      if (seen.has(to)) throw new Error(`Redirect loop: ${[...seen, to].join(" -> ")}`);
      seen.add(to);
      to = next.get(to)!;
    }
    return { from, to };
  });
}

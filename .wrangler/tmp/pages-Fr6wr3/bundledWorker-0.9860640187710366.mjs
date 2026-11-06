var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../.wrangler/tmp/bundle-msmDDa/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// _worker.js
var REDIRECTS = /* @__PURE__ */ new Map([["/customer-support-as-service", "/support-as-a-service"], ["/welcome-to-the-signalmash-developer-hub", "/developers"], ["/signalmash-for-marketers", "/marketing"], ["/signalmash-for-product-leaders", "/product"], ["/signalmash-for-customer-experience", "/customer-experience"], ["/fraud-prevention-with-signalmash", "/fraud-prevention"], ["/appointment-reminders-that-keep-your-business-on-schedule", "/appointment-reminders"], ["/real-time-lead-alerts-with-signalmash", "/lead-alerts"], ["/mass-texting-made-simple-with-signalmash", "/mass-texting"], ["/sms-marketing-that-gets-read-and-gets-results", "/sms-marketing"], ["/grow-revenue-with-signalmash-cpaas", "/cross-sell-and-upsell"], ["/signalmash-healthcare-solutions", "/healthcare-solutions"], ["/signalmash-ecommerce-solution", "/ecommerce"], ["/signalmash-for-hospitality", "/hospitality"], ["/nonprofit", "/non-profit"], ["/signalmash-for-nonprofit", "/nonprofit"], ["/retail-messaging-customer-engagement-solutions", "/retail"], ["/collections-as-a-service", "/payments-as-a-service"], ["/signalchat", "/coaas"], ["/signalmash-ecommerce-solutions", "/signalmash-ecommerce-solution"], ["/signalmash-for-nonprofits", "/signalmash-for-nonprofit"], ["/ccaas", "/signalcaas"], ["/messaging-app", "/signalchat"], ["/identity-services-number-intelligence", "/identity"], ["/number", "/numbers"], ["/nationwide-sms-mms", "/toll-free-messaging"], ["/text-messaging-api", "/text-messaging"], ["/sip-trunking-local-termination", "/local-termination"], ["/sms-marketing-that-gets-read----and-gets-results", "/sms-marketing-that-gets-read-and-gets-results"], ["/number-intellegence", "/number-intelligence"], ["/new-toll-free-numbers", "/toll-free-numbers"], ["/new-local-numbers", "/local-numbers"], ["/new-10dlc-messaging", "/10dlc-messaging"], ["/new-toll-free-origination", "/toll-free-origination"], ["/new-about-us", "/about-us"]]);
var PAGED = /* @__PURE__ */ new Set(["/blog?56e6ea54_page=10", "/blog?56e6ea54_page=11", "/blog?56e6ea54_page=12", "/blog?56e6ea54_page=13", "/blog?56e6ea54_page=14", "/blog?56e6ea54_page=15", "/blog?56e6ea54_page=16", "/blog?56e6ea54_page=2", "/blog?56e6ea54_page=3", "/blog?56e6ea54_page=4", "/blog?56e6ea54_page=5", "/blog?56e6ea54_page=6", "/blog?56e6ea54_page=7", "/blog?56e6ea54_page=8", "/blog?56e6ea54_page=9", "/hashtags/ai?de61df57_page=1", "/hashtags/ai?de61df57_page=2", "/hashtags/business?de61df57_page=10", "/hashtags/business?de61df57_page=2", "/hashtags/business?de61df57_page=3", "/hashtags/business?de61df57_page=4", "/hashtags/business?de61df57_page=5", "/hashtags/business?de61df57_page=6", "/hashtags/business?de61df57_page=7", "/hashtags/business?de61df57_page=8", "/hashtags/business?de61df57_page=9", "/hashtags/communications?de61df57_page=2", "/hashtags/communications?de61df57_page=3", "/hashtags/communications?de61df57_page=4", "/hashtags/communications?de61df57_page=5", "/hashtags/communications?de61df57_page=6", "/hashtags/communications?de61df57_page=7", "/hashtags/communications?de61df57_page=8", "/hashtags/contact-centers?de61df57_page=2", "/hashtags/contact-centers?de61df57_page=3", "/hashtags/customer-experience?de61df57_page=2", "/hashtags/customer-experience?de61df57_page=3", "/hashtags/customer-experience?de61df57_page=4", "/hashtags/cybersecurity?de61df57_page=1", "/hashtags/cybersecurity?de61df57_page=2", "/hashtags/marketing-growth?de61df57_page=1", "/hashtags/marketing-growth?de61df57_page=2", "/hashtags/numbers?de61df57_page=1", "/hashtags/numbers?de61df57_page=2", "/hashtags/rcs?de61df57_page=1", "/hashtags/rcs?de61df57_page=2", "/hashtags/regulation?de61df57_page=1", "/hashtags/regulation?de61df57_page=2", "/hashtags/tech-for-good?de61df57_page=1", "/hashtags/tech-for-good?de61df57_page=2", "/hashtags/technology?de61df57_page=2", "/hashtags/technology?de61df57_page=3", "/hashtags/technology?de61df57_page=4", "/hashtags/technology?de61df57_page=5", "/hashtags/technology?de61df57_page=6", "/hashtags/telecom-infrastructure?de61df57_page=2", "/hashtags/telecom-infrastructure?de61df57_page=3", "/hashtags/text-messaging?de61df57_page=2", "/hashtags/text-messaging?de61df57_page=3", "/hashtags/text-messaging?de61df57_page=4", "/hashtags/text-messaging?de61df57_page=5"]);
var PAGED_PARAM = /^([0-9a-f]+)_page$/;
function finalTarget(path) {
  let to = REDIRECTS.get(path);
  for (let hops = 0; REDIRECTS.has(to) && hops < 10; hops++)
    to = REDIRECTS.get(to);
  return to;
}
__name(finalTarget, "finalTarget");
function withHeaders(response, url) {
  const res = new Response(response.body, response);
  if (url.hostname.endsWith(".pages.dev"))
    res.headers.set("X-Robots-Tag", "noindex");
  return res;
}
__name(withHeaders, "withHeaders");
var worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path.length > 1 && path.endsWith("/")) {
      url.pathname = path.replace(/\/+$/, "") || "/";
      return Response.redirect(url.toString(), 301);
    }
    const to = finalTarget(path);
    if (to)
      return Response.redirect(new URL(to + url.search, url).toString(), 301);
    if (path.split("/").includes("~page")) {
      const missing = await env.ASSETS.fetch(new URL("/404.html", url));
      return withHeaders(new Response(missing.body, { status: 404, headers: missing.headers }), url);
    }
    for (const [name, value] of url.searchParams) {
      const listId = name.match(PAGED_PARAM)?.[1];
      if (!listId || !PAGED.has(`${path}?${name}=${value}`))
        continue;
      const stored = new URL(`${path === "/" ? "" : path}/~page/${listId}/${value}`, url);
      return withHeaders(await env.ASSETS.fetch(stored), url);
    }
    return withHeaders(await env.ASSETS.fetch(request), url);
  }
};
var worker_default = worker;

// C:/Users/Admin/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// C:/Users/Admin/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// ../.wrangler/tmp/bundle-msmDDa/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// C:/Users/Admin/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// ../.wrangler/tmp/bundle-msmDDa/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker2) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker2;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker2.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker2.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker2,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker2.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker2.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=bundledWorker-0.9860640187710366.mjs.map

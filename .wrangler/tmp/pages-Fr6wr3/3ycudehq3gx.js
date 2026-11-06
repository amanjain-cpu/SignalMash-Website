// <define:__ROUTES__>
var define_ROUTES_default = {
  version: 1,
  include: [
    "/*"
  ],
  exclude: [
    "/cdn/*",
    "/_next/*"
  ]
};

// C:/Users/Admin/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/templates/pages-dev-pipeline.ts
import worker from "G:\\Coding 2\\SignalMash\\.wrangler\\tmp\\pages-Fr6wr3\\bundledWorker-0.9860640187710366.mjs";
import { isRoutingRuleMatch } from "C:\\Users\\Admin\\AppData\\Local\\npm-cache\\_npx\\0eedb5afd4158ff3\\node_modules\\wrangler\\templates\\pages-dev-util.ts";
export * from "G:\\Coding 2\\SignalMash\\.wrangler\\tmp\\pages-Fr6wr3\\bundledWorker-0.9860640187710366.mjs";
var routes = define_ROUTES_default;
var pages_dev_pipeline_default = {
  fetch(request, env, context) {
    const { pathname } = new URL(request.url);
    for (const exclude of routes.exclude) {
      if (isRoutingRuleMatch(pathname, exclude)) {
        return env.ASSETS.fetch(request);
      }
    }
    for (const include of routes.include) {
      if (isRoutingRuleMatch(pathname, include)) {
        const workerAsHandler = worker;
        if (workerAsHandler.fetch === void 0) {
          throw new TypeError("Entry point missing `fetch` handler");
        }
        return workerAsHandler.fetch(request, env, context);
      }
    }
    return env.ASSETS.fetch(request);
  }
};
export {
  pages_dev_pipeline_default as default
};
//# sourceMappingURL=3ycudehq3gx.js.map

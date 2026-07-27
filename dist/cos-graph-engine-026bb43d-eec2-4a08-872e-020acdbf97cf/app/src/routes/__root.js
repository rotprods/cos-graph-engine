"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Route = void 0;
const react_query_1 = require("@tanstack/react-query");
const react_router_1 = require("@tanstack/react-router");
const react_1 = require("react");
const button_1 = require("@higgsfield/quanta/button");
const not_found_1 = require("@higgsfield/quanta/not-found");
const styles_css_url_1 = __importDefault(require("../styles.css?url"));
const higgsfield_error_reporting_1 = require("../lib/higgsfield-error-reporting");
// Page metadata (browser <title>/favicon + social og: tags) committed into the
// repo by the marketplace meta API and read at BUILD time — no runtime fetch.
// Editing it via the app settings UI rewrites this file and redeploys the app.
const app_meta_json_1 = __importDefault(require("../app-meta.json"));
// Built-in defaults for any field that isn't set in app-meta.json.
const DEFAULT_TITLE = "Higgsfield App";
const DEFAULT_DESCRIPTION = "Higgsfield Generated Project";
const appMeta = app_meta_json_1.default;
// Build the document head (title / description / og: / twitter: / favicon) from
// app-meta.json, falling back to the defaults above for any unset field.
// og_title/og_description double as the browser <title> and meta description;
// og_image_url (when set) also drives the twitter card + image. Built from
// inline tag literals (conditional spreads for the optional image/favicon) so
// it matches the head() shape TanStack expects.
// favicon/og images live in THIS app's own /assets, so the host is never
// inherent. app-meta.json may carry an absolute higgsfield-app URL with a STALE
// host — baked from the app this one was copied/remixed/renamed from — which would
// serve the wrong app's favicon/og. Strip any higgsfield-app host (prod
// higgsfield.app + dev higgsfield-dev.app) down to a root-relative path so it
// always resolves against whoever serves THIS page (preview / prod / custom
// domain). Genuinely external URLs (a CDN image the owner set) are left absolute.
const APP_HOST_ZONES = ["higgsfield.app", "higgsfield-dev.app"];
function toOwnAssetUrl(value) {
    if (!value)
        return null;
    if (value.startsWith("/"))
        return value; // already root-relative
    try {
        const u = new URL(value);
        const isAppHost = APP_HOST_ZONES.some((zone) => u.hostname === zone || u.hostname.endsWith(`.${zone}`));
        if (isAppHost)
            return u.pathname + u.search;
        return value; // external host (CDN, etc.) — keep absolute
    }
    catch {
        return value; // not a parseable URL — leave as-is
    }
}
function buildHead(meta) {
    const title = meta.og_title ?? DEFAULT_TITLE;
    const description = meta.og_description ?? DEFAULT_DESCRIPTION;
    const ogImage = toOwnAssetUrl(meta.og_image_url);
    const favicon = toOwnAssetUrl(meta.favicon_url);
    const ogVideo = toOwnAssetUrl(meta.og_video_url);
    return {
        meta: [
            { charSet: "utf-8" },
            { name: "viewport", content: "width=device-width, initial-scale=1" },
            { title },
            { name: "description", content: description },
            { name: "author", content: "Higgsfield" },
            { property: "og:title", content: title },
            { property: "og:description", content: description },
            { property: "og:type", content: "website" },
            { name: "twitter:card", content: ogImage ? "summary_large_image" : "summary" },
            { name: "twitter:site", content: "@Higgsfield" },
            ...(ogImage
                ? [
                    { property: "og:image", content: ogImage },
                    { name: "twitter:image", content: ogImage },
                ]
                : []),
            // Cover video (og:video) — the animated counterpart of og:image; the
            // Higgsfield feed cards also play it on hover.
            ...(ogVideo ? [{ property: "og:video", content: ogVideo }] : []),
        ],
        links: [
            { rel: "stylesheet", href: styles_css_url_1.default },
            ...(favicon ? [{ rel: "icon", href: favicon }] : []),
        ],
    };
}
function NotFoundComponent() {
    return (<div className="flex min-h-dvh items-center justify-center bg-q-background-primary px-4">
      <not_found_1.NotFound className="mx-auto max-w-md" icon={<span className="text-q-title-md-semi-bold text-q-text-primary">404</span>} title="Page not found" subtitle="The page you're looking for doesn't exist or has been moved.">
        <react_router_1.Link to="/" className={(0, button_1.button)({ variant: "primary", size: "md" }, "mt-3")}>
          Go home
        </react_router_1.Link>
      </not_found_1.NotFound>
    </div>);
}
function ErrorComponent({ error, reset }) {
    console.error(error);
    const router = (0, react_router_1.useRouter)();
    (0, react_1.useEffect)(() => {
        (0, higgsfield_error_reporting_1.reportHiggsfieldError)(error, { boundary: "tanstack_root_error_component" });
    }, [error]);
    return (<div className="flex min-h-dvh items-center justify-center bg-q-background-primary px-4">
      <div className="max-w-md text-center">
        <h1 className="text-q-title-lg-semi-bold text-q-text-primary">This page didn't load</h1>
        <p className="mt-2 text-q-body-sm-regular text-q-text-secondary">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button_1.button onClick={() => {
            router.invalidate();
            reset();
        }} className={(0, button_1.button)({ variant: "primary", size: "md" })}>
            Try again
          </button_1.button>
          <a href="/" className={(0, button_1.button)({ variant: "outline", size: "md" })}>
            Go home
          </a>
        </div>
      </div>
    </div>);
}
exports.Route = (0, react_router_1.createRootRouteWithContext)()({
    // Read the committed page metadata at build time (no runtime fetch).
    head: () => buildHead(appMeta),
    shellComponent: RootShell,
    component: RootComponent,
    notFoundComponent: NotFoundComponent,
    errorComponent: ErrorComponent,
});
function RootShell({ children }) {
    return (<html lang="en" data-theme="default-dark" style={{ colorScheme: "dark" }}>
      {/* Marketplace apps are permanently dark: data-theme is pinned on <html>
            above. Do not add quanta's bootstrapScript/ThemeController, a theme
            toggle, or a light mode. */}
      <head>
        <react_router_1.HeadContent />
      </head>
      <body className="bg-q-background-primary text-q-text-primary">
        {children}
        <react_router_1.Scripts />
      </body>
    </html>);
}
function RootComponent() {
    const { queryClient } = exports.Route.useRouteContext();
    (0, react_1.useEffect)(() => {
        if (!__HF_DESIGN_INSPECTOR__) {
            return;
        }
        void Promise.resolve().then(() => __importStar(require("../module/design-inspector/runtime"))).then(({ installHiggsfieldDesignInspector }) => {
            installHiggsfieldDesignInspector();
        })
            .catch((error) => {
            (0, higgsfield_error_reporting_1.reportHiggsfieldError)(error instanceof Error ? error : new Error("Failed to load design inspector"), {
                boundary: "higgsfield_design_inspector_import",
            });
        });
    }, []);
    return (<react_query_1.QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <react_router_1.Outlet />
    </react_query_1.QueryClientProvider>);
}
//# sourceMappingURL=__root.js.map
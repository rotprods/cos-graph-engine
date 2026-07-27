"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Route = void 0;
const react_router_1 = require("@tanstack/react-router");
exports.Route = (0, react_router_1.createFileRoute)('/robots.txt')({
    server: {
        handlers: {
            GET: async ({ request }) => {
                const origin = new URL(request.url).origin;
                const body = [
                    'User-agent: *',
                    'Allow: /',
                    '',
                    `Sitemap: ${origin}/sitemap.xml`,
                ].join('\n');
                return new Response(body, {
                    headers: {
                        'Content-Type': 'text/plain; charset=utf-8',
                        'Cache-Control': 'public, max-age=86400',
                    },
                });
            },
        },
    },
});
//# sourceMappingURL=robots%5B.%5Dtxt.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Route = void 0;
const react_router_1 = require("@tanstack/react-router");
exports.Route = (0, react_router_1.createFileRoute)('/sitemap.xml')({
    server: {
        handlers: {
            GET: async ({ request }) => {
                const origin = new URL(request.url).origin;
                const today = new Date().toISOString().split('T')[0];
                const xml = [
                    '<?xml version="1.0" encoding="UTF-8"?>',
                    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
                    '  <url>',
                    `    <loc>${origin}/</loc>`,
                    `    <lastmod>${today}</lastmod>`,
                    '    <changefreq>weekly</changefreq>',
                    '    <priority>1.0</priority>',
                    '  </url>',
                    '</urlset>',
                ].join('\n');
                return new Response(xml, {
                    headers: {
                        'Content-Type': 'application/xml; charset=utf-8',
                        'Cache-Control': 'public, max-age=3600',
                    },
                });
            },
        },
    },
});
//# sourceMappingURL=sitemap%5B.%5Dxml.js.map
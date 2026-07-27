import { Route as rootRouteImport } from './routes/__root';
import { Route as SitemapDotxmlRouteImport } from './routes/sitemap[.]xml';
import { Route as RobotsDottxtRouteImport } from './routes/robots[.]txt';
import { Route as IndexRouteImport } from './routes/index';
declare const SitemapDotxmlRoute: any;
declare const RobotsDottxtRoute: any;
declare const IndexRoute: any;
export interface FileRoutesByFullPath {
    '/': typeof IndexRoute;
    '/robots.txt': typeof RobotsDottxtRoute;
    '/sitemap.xml': typeof SitemapDotxmlRoute;
}
export interface FileRoutesByTo {
    '/': typeof IndexRoute;
    '/robots.txt': typeof RobotsDottxtRoute;
    '/sitemap.xml': typeof SitemapDotxmlRoute;
}
export interface FileRoutesById {
    __root__: typeof rootRouteImport;
    '/': typeof IndexRoute;
    '/robots.txt': typeof RobotsDottxtRoute;
    '/sitemap.xml': typeof SitemapDotxmlRoute;
}
export interface FileRouteTypes {
    fileRoutesByFullPath: FileRoutesByFullPath;
    fullPaths: '/' | '/robots.txt' | '/sitemap.xml';
    fileRoutesByTo: FileRoutesByTo;
    to: '/' | '/robots.txt' | '/sitemap.xml';
    id: '__root__' | '/' | '/robots.txt' | '/sitemap.xml';
    fileRoutesById: FileRoutesById;
}
export interface RootRouteChildren {
    IndexRoute: typeof IndexRoute;
    RobotsDottxtRoute: typeof RobotsDottxtRoute;
    SitemapDotxmlRoute: typeof SitemapDotxmlRoute;
}
declare module '@tanstack/react-router' {
    interface FileRoutesByPath {
        '/sitemap.xml': {
            id: '/sitemap.xml';
            path: '/sitemap.xml';
            fullPath: '/sitemap.xml';
            preLoaderRoute: typeof SitemapDotxmlRouteImport;
            parentRoute: typeof rootRouteImport;
        };
        '/robots.txt': {
            id: '/robots.txt';
            path: '/robots.txt';
            fullPath: '/robots.txt';
            preLoaderRoute: typeof RobotsDottxtRouteImport;
            parentRoute: typeof rootRouteImport;
        };
        '/': {
            id: '/';
            path: '/';
            fullPath: '/';
            preLoaderRoute: typeof IndexRouteImport;
            parentRoute: typeof rootRouteImport;
        };
    }
}
export declare const routeTree: any;
import type { getRouter } from './router.tsx';
import type { startInstance } from './start.ts';
declare module '@tanstack/react-start' {
    interface Register {
        ssr: true;
        router: Awaited<ReturnType<typeof getRouter>>;
        config: Awaited<ReturnType<typeof startInstance.getOptions>>;
    }
}
export {};
//# sourceMappingURL=routeTree.gen.d.ts.map
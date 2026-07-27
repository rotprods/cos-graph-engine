import type { PluginOption } from "vite";
type BabelPluginApi = {
    types: Record<string, (...args: unknown[]) => unknown>;
};
type BabelPath = {
    node: Record<string, unknown> & {
        name?: unknown;
        loc?: {
            start?: {
                line?: number;
                column?: number;
            };
        } | null;
        attributes?: unknown[];
        id?: {
            name?: string;
        };
    };
    parent?: Record<string, unknown> & {
        id?: {
            name?: string;
        };
    };
    hub?: {
        file?: {
            opts?: {
                filename?: string;
            };
        };
    };
    findParent?: (predicate: (path: BabelPath) => boolean) => BabelPath | null;
    isProgram?: () => boolean;
};
export declare function stableHiggsfieldDesignHash(input: string): string;
export declare function higgsfieldDesignSourceBabelPlugin(api: BabelPluginApi): {
    name: string;
    visitor: {
        JSXOpeningElement(path: BabelPath): void;
    };
};
export declare function higgsfieldDesignInspectorDefine(enabled: boolean): Record<string, string>;
export declare function higgsfieldDesignInspectorVitePlugin(enabled: boolean): PluginOption;
export {};
//# sourceMappingURL=vite.d.ts.map
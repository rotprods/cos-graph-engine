/**
 * COS Graph Engine — Plugin System (Fase 12)
 *
 * Proporciona:
 * 1. Plugin Registry con ciclo de vida
 * 2. Hook system (beforeAddNode, afterAddEdge, onRemoveNode, etc.)
 * 3. Format plugins: CSV, JSON, GraphML import/export
 * 4. Plugin Marketplace con versiones y dependencias
 * 5. Zero dependencias externas
 */
export type HookName = 'beforeAddNode' | 'afterAddNode' | 'beforeAddEdge' | 'afterAddEdge' | 'beforeRemoveNode' | 'afterRemoveNode' | 'beforeRemoveEdge' | 'afterRemoveEdge' | 'beforeExecute' | 'afterExecute' | 'onInit' | 'onDestroy' | 'onRender' | 'onExport' | 'onImport';
export interface HookContext {
    pluginName: string;
    hookName: HookName;
    data: Record<string, unknown>;
    timestamp: number;
    abort: boolean;
}
export interface GraphNode {
    id: string;
    label?: string;
    type?: string;
    [key: string]: unknown;
}
export interface GraphEdge {
    id?: string;
    source: string;
    target: string;
    label?: string;
    weight?: number;
    [key: string]: unknown;
}
export interface GraphData {
    nodes: GraphNode[];
    edges: GraphEdge[];
    metadata?: Record<string, unknown>;
}
export interface FormatResult {
    success: boolean;
    data?: GraphData;
    error?: string;
}
export interface PluginManifest {
    name: string;
    version: string;
    description: string;
    author?: string;
    hooks: HookName[];
    dependencies?: {
        name: string;
        version: string;
    }[];
    formats?: ('import' | 'export')[];
}
export interface PluginStats {
    totalPlugins: number;
    activePlugins: number;
    totalHooks: number;
    executions: number;
    formats: string[];
}
export interface Plugin {
    manifest: PluginManifest;
    activated: boolean;
    /** Called when the plugin is activated */
    onActivate?(): void | Promise<void>;
    /** Called when the plugin is deactivated */
    onDeactivate?(): void | Promise<void>;
    /** Hook handler — return { abort: true } to cancel the operation */
    onHook?(hook: HookName, context: HookContext): HookContext | Promise<HookContext>;
    /** Import graph data from a format */
    import?(raw: string): FormatResult;
    /** Export graph data to a format */
    export?(graph: GraphData): {
        success: boolean;
        data?: string;
        error?: string;
    };
}
export declare class PluginRegistry {
    private plugins;
    private hookHandlers;
    private stats;
    constructor();
    private registerBuiltin;
    /** Register an external plugin */
    register(plugin: Plugin): boolean;
    /** Activate a plugin */
    activate(name: string): boolean;
    /** Deactivate a plugin */
    deactivate(name: string): boolean;
    /** Unregister a plugin */
    unregister(name: string): boolean;
    /** Get a plugin by name */
    get(name: string): Plugin | undefined;
    /** List all plugins */
    list(): Plugin[];
    /** List active plugins */
    listActive(): Plugin[];
    /** Execute a hook across all active plugins */
    executeHook(hook: HookName, context: Record<string, unknown>): Promise<HookContext>;
    /** Import a graph from a format string */
    importFrom(format: string, raw: string): FormatResult;
    /** Export a graph to a format string */
    exportTo(format: string, graph: GraphData): {
        success: boolean;
        data?: string;
        error?: string;
    };
    /** Get available formats */
    getFormats(): string[];
    /** Get registry stats */
    getStats(): PluginStats;
}
export interface MarketplacePlugin {
    name: string;
    version: string;
    description: string;
    author: string;
    downloads: number;
    rating: number;
    tags: string[];
    dependencies: {
        name: string;
        version: string;
    }[];
    updatedAt: string;
}
export declare class PluginMarketplace {
    private catalog;
    private installed;
    constructor();
    private seedCatalog;
    /** Search the marketplace */
    search(query?: string, tag?: string): MarketplacePlugin[];
    /** Get a plugin from the catalog */
    get(name: string): MarketplacePlugin | undefined;
    /** List all catalog plugins */
    list(): MarketplacePlugin[];
    /** Install a plugin (mark as installed) */
    install(name: string, version?: string): boolean;
    /** Uninstall a plugin */
    uninstall(name: string): boolean;
    /** Check if a plugin is installed */
    isInstalled(name: string): boolean;
    /** List installed plugins */
    listInstalled(): {
        name: string;
        version: string;
        plugin: MarketplacePlugin | undefined;
    }[];
    /** Get marketplace stats */
    getStats(): {
        total: number;
        installed: number;
        categories: string[];
    };
}
export declare class PluginSystem {
    readonly registry: PluginRegistry;
    readonly marketplace: PluginMarketplace;
    constructor();
    /** Get system stats */
    getStats(): {
        registry: PluginStats;
        marketplace: {
            total: number;
            installed: number;
        };
    };
}
export declare const pluginSystem: PluginSystem;
//# sourceMappingURL=plugin.d.ts.map
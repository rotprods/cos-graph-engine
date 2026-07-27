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

// ============================================================
// Types
// ============================================================

export type HookName =
  | 'beforeAddNode'
  | 'afterAddNode'
  | 'beforeAddEdge'
  | 'afterAddEdge'
  | 'beforeRemoveNode'
  | 'afterRemoveNode'
  | 'beforeRemoveEdge'
  | 'afterRemoveEdge'
  | 'beforeExecute'
  | 'afterExecute'
  | 'onInit'
  | 'onDestroy'
  | 'onRender'
  | 'onExport'
  | 'onImport';

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
  dependencies?: { name: string; version: string }[];
  formats?: ('import' | 'export')[];
}

export interface PluginStats {
  totalPlugins: number;
  activePlugins: number;
  totalHooks: number;
  executions: number;
  formats: string[];
}

// ============================================================
// Plugin Interface
// ============================================================

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
  export?(graph: GraphData): { success: boolean; data?: string; error?: string };
}

// ============================================================
// Built-in Format Plugins
// ============================================================

function parseCSV(csv: string): FormatResult {
  try {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return { success: false, error: 'CSV must have header + at least 1 data row' };

    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const nodeCol = header.indexOf('id');
    const sourceCol = header.indexOf('source');
    const targetCol = header.indexOf('target');

    if (nodeCol === -1 && (sourceCol === -1 || targetCol === -1)) {
      return { success: false, error: 'CSV must have "id" column (nodes) or "source,target" columns (edges)' };
    }

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const vals = lines[i].split(',').map(v => v.trim());
      const row: Record<string, string> = {};
      header.forEach((h, idx) => { row[h] = vals[idx] || ''; });

      if (nodeCol !== -1) {
        const node: GraphNode = { id: vals[nodeCol] || `n${i}` };
        header.forEach((h, idx) => {
          if (h !== 'id') node[h] = vals[idx];
        });
        nodes.push(node);
      }
      if (sourceCol !== -1 && targetCol !== -1) {
        edges.push({
          source: vals[sourceCol],
          target: vals[targetCol],
          label: row.label || '',
        });
      }
    }
    return { success: true, data: { nodes, edges } };
  } catch (e: any) {
    return { success: false, error: `CSV parse error: ${e.message}` };
  }
}

function exportCSV(graph: GraphData): { success: boolean; data?: string; error?: string } {
  try {
    const lines: string[] = [];
    if (graph.nodes.length > 0) {
      const keys = new Set<string>();
      graph.nodes.forEach(n => Object.keys(n).forEach(k => keys.add(k)));
      const cols = Array.from(keys);
      lines.push(cols.join(','));
      for (const n of graph.nodes) {
        lines.push(cols.map(c => String(n[c] ?? '')).join(','));
      }
    }
    if (graph.edges.length > 0) {
      if (lines.length > 0) lines.push('');
      const eCols = ['source', 'target', 'label'];
      lines.push(eCols.join(','));
      for (const e of graph.edges) {
        lines.push(eCols.map(c => String(e[c] ?? '')).join(','));
      }
    }
    return { success: true, data: lines.join('\n') };
  } catch (e: any) {
    return { success: false, error: `CSV export error: ${e.message}` };
  }
}

function parseGraphML(xml: string): FormatResult {
  try {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const nodeRegex = /<node\s+id="([^"]+)"[^>]*>(?:<data\s+key="([^"]+)">([^<]*)<\/data>)?/g;
    const edgeRegex = /<edge\s+(?:id="([^"]+)")?\s*source="([^"]+)"\s*target="([^"]+)"[^>]*>(?:<data\s+key="([^"]+)">([^<]*)<\/data>)?/g;

    let m;
    while ((m = nodeRegex.exec(xml)) !== null) {
      const node: GraphNode = { id: m[1] };
      if (m[2] && m[3]) node[m[2]] = m[3];
      nodes.push(node);
    }
    while ((m = edgeRegex.exec(xml)) !== null) {
      edges.push({ id: m[1] || undefined, source: m[2], target: m[3], label: m[5] || '' });
    }
    return { success: true, data: { nodes, edges } };
  } catch (e: any) {
    return { success: false, error: `GraphML parse error: ${e.message}` };
  }
}

function exportGraphML(graph: GraphData): { success: boolean; data?: string; error?: string } {
  try {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<graphml xmlns="http://graphml.graphdrawing.org/xmlns">\n';
    xml += '  <key id="label" for="node" attr.name="label" attr.type="string"/>\n';
    xml += '  <key id="label_e" for="edge" attr.name="label" attr.type="string"/>\n';
    xml += '  <graph id="G" edgedefault="directed">\n';
    for (const n of graph.nodes) {
      xml += `    <node id="${n.id}">`;
      if (n.label) xml += `<data key="label">${escapeXml(String(n.label))}</data>`;
      xml += '</node>\n';
    }
    for (const e of graph.edges) {
      xml += `    <edge source="${e.source}" target="${e.target}">`;
      if (e.label) xml += `<data key="label_e">${escapeXml(String(e.label))}</data>`;
      xml += '</edge>\n';
    }
    xml += '  </graph>\n</graphml>';
    return { success: true, data: xml };
  } catch (e: any) {
    return { success: false, error: `GraphML export error: ${e.message}` };
  }
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============================================================
// Plugin Registry
// ============================================================

export class PluginRegistry {
  private plugins: Map<string, Plugin> = new Map();
  private hookHandlers: Map<HookName, Map<string, (ctx: HookContext) => HookContext | Promise<HookContext>>> = new Map();
  private stats: PluginStats = { totalPlugins: 0, activePlugins: 0, totalHooks: 0, executions: 0, formats: [] };

  constructor() {
    // Register built-in format plugins
    this.registerBuiltin('csv-importer', '0.1.0', 'Import graphs from CSV', ['onImport'], {
      import: (raw) => { this.stats.executions++; return parseCSV(raw); },
      export: (g) => { this.stats.executions++; return exportCSV(g); },
    });
    this.registerBuiltin('csv-exporter', '0.1.0', 'Export graphs to CSV', ['onExport'], {
      import: (raw) => { this.stats.executions++; return parseCSV(raw); },
      export: (g) => { this.stats.executions++; return exportCSV(g); },
    });
    this.registerBuiltin('graphml-importer', '0.1.0', 'Import graphs from GraphML', ['onImport'], {
      import: (raw) => { this.stats.executions++; return parseGraphML(raw); },
      export: (g) => { this.stats.executions++; return exportGraphML(g); },
    });
    this.registerBuiltin('graphml-exporter', '0.1.0', 'Export graphs to GraphML', ['onExport'], {
      import: (raw) => { this.stats.executions++; return parseGraphML(raw); },
      export: (g) => { this.stats.executions++; return exportGraphML(g); },
    });
    this.registerBuiltin('json-formatter', '0.1.0', 'Enhanced JSON import/export with schema validation', ['onImport', 'onExport'], {
      import: (raw): FormatResult => {
        this.stats.executions++;
        try {
          const data = JSON.parse(raw) as GraphData;
          if (!data.nodes || !Array.isArray(data.nodes)) {
            return { success: false, error: 'JSON must have a "nodes" array' };
          }
          return { success: true, data };
        } catch (e: any) {
          return { success: false, error: `JSON parse error: ${e.message}` };
        }
      },
      export: (g): { success: boolean; data?: string; error?: string } => {
        this.stats.executions++;
        try {
          return { success: true, data: JSON.stringify(g, null, 2) };
        } catch (e: any) {
          return { success: false, error: `JSON export error: ${e.message}` };
        }
      },
    });
  }

  private registerBuiltin(name: string, version: string, description: string, hooks: HookName[], impl: Partial<Plugin>): void {
    const plugin: Plugin = {
      manifest: { name, version, description, hooks, author: 'COS Graph Engine' },
      activated: true,
      import: impl.import,
      export: impl.export,
      onHook: async (hook, ctx) => {
        this.stats.executions++;
        return ctx;
      },
    };
    this.plugins.set(name, plugin);
    this.stats.totalPlugins++;
    this.stats.activePlugins++;
    if (!this.stats.formats.includes(name.split('-')[0] || name)) {
      this.stats.formats.push(name.split('-')[0] || name);
    }
  }

  /** Register an external plugin */
  register(plugin: Plugin): boolean {
    if (this.plugins.has(plugin.manifest.name)) {
      return false;
    }
    // Check dependencies
    if (plugin.manifest.dependencies) {
      for (const dep of plugin.manifest.dependencies) {
        if (!this.plugins.has(dep.name)) {
          return false;
        }
      }
    }
    this.plugins.set(plugin.manifest.name, plugin);
    this.stats.totalPlugins++;
    return true;
  }

  /** Activate a plugin */
  activate(name: string): boolean {
    const p = this.plugins.get(name);
    if (!p || p.activated) return false;
    p.activated = true;
    this.stats.activePlugins++;
    p.onActivate?.();
    return true;
  }

  /** Deactivate a plugin */
  deactivate(name: string): boolean {
    const p = this.plugins.get(name);
    if (!p || !p.activated) return false;
    p.activated = false;
    this.stats.activePlugins--;
    p.onDeactivate?.();
    return true;
  }

  /** Unregister a plugin */
  unregister(name: string): boolean {
    if (!this.plugins.has(name)) return false;
    this.deactivate(name);
    this.plugins.delete(name);
    this.stats.totalPlugins--;
    return true;
  }

  /** Get a plugin by name */
  get(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  /** List all plugins */
  list(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /** List active plugins */
  listActive(): Plugin[] {
    return this.list().filter(p => p.activated);
  }

  /** Execute a hook across all active plugins */
  async executeHook(hook: HookName, context: Record<string, unknown>): Promise<HookContext> {
    const ctx: HookContext = {
      pluginName: 'system',
      hookName: hook,
      data: context,
      timestamp: Date.now(),
      abort: false,
    };

    for (const plugin of this.listActive()) {
      if (plugin.manifest.hooks.includes(hook) && plugin.onHook) {
        const result = await plugin.onHook(hook, { ...ctx, pluginName: plugin.manifest.name });
        if (result.abort) {
          ctx.abort = true;
          break;
        }
        ctx.data = { ...ctx.data, ...result.data };
      }
    }
    this.stats.executions++;
    return ctx;
  }

  /** Import a graph from a format string */
  importFrom(format: string, raw: string): FormatResult {
    const name = `${format.toLowerCase()}-importer`;
    const plugin = this.plugins.get(name) || this.plugins.get(`${format.toLowerCase()}-formatter`);
    if (!plugin || !plugin.import) {
      return { success: false, error: `No importer plugin found for format: ${format}` };
    }
    if (!plugin.activated) {
      return { success: false, error: `Plugin ${name} is not activated` };
    }
    return plugin.import(raw);
  }

  /** Export a graph to a format string */
  exportTo(format: string, graph: GraphData): { success: boolean; data?: string; error?: string } {
    const name = `${format.toLowerCase()}-exporter`;
    const plugin = this.plugins.get(name) || this.plugins.get(`${format.toLowerCase()}-formatter`);
    if (!plugin || !plugin.export) {
      return { success: false, error: `No exporter plugin found for format: ${format}` };
    }
    if (!plugin.activated) {
      return { success: false, error: `Plugin ${name} is not activated` };
    }
    return plugin.export(graph);
  }

  /** Get available formats */
  getFormats(): string[] {
    const formats = new Set<string>();
    for (const p of this.list()) {
      if (p.manifest.formats) {
        p.manifest.formats.forEach(f => formats.add(f));
      }
      if (p.import) formats.add('import');
      if (p.export) formats.add('export');
    }
    return Array.from(formats);
  }

  /** Get registry stats */
  getStats(): PluginStats {
    return { ...this.stats };
  }
}

// ============================================================
// Plugin Marketplace
// ============================================================

export interface MarketplacePlugin {
  name: string;
  version: string;
  description: string;
  author: string;
  downloads: number;
  rating: number;
  tags: string[];
  dependencies: { name: string; version: string }[];
  updatedAt: string;
}

export class PluginMarketplace {
  private catalog: MarketplacePlugin[] = [];
  private installed: Map<string, string> = new Map(); // name -> version

  constructor() {
    // Seed the catalog with built-in + community plugins
    this.seedCatalog();
  }

  private seedCatalog(): void {
    const now = new Date().toISOString();
    this.catalog.push(
      { name: 'csv-importer', version: '0.1.0', description: 'Import graphs from CSV files', author: 'COS Core', downloads: 1200, rating: 4.5, tags: ['format', 'import', 'csv'], dependencies: [], updatedAt: now },
      { name: 'csv-exporter', version: '0.1.0', description: 'Export graphs to CSV files', author: 'COS Core', downloads: 1100, rating: 4.4, tags: ['format', 'export', 'csv'], dependencies: [], updatedAt: now },
      { name: 'graphml-importer', version: '0.1.0', description: 'Import graphs from GraphML format', author: 'COS Core', downloads: 800, rating: 4.3, tags: ['format', 'import', 'graphml'], dependencies: [], updatedAt: now },
      { name: 'graphml-exporter', version: '0.1.0', description: 'Export graphs to GraphML format', author: 'COS Core', downloads: 750, rating: 4.2, tags: ['format', 'export', 'graphml'], dependencies: [], updatedAt: now },
      { name: 'json-formatter', version: '0.1.0', description: 'Enhanced JSON import/export with schema validation', author: 'COS Core', downloads: 2500, rating: 4.8, tags: ['format', 'import', 'export', 'json', 'validation'], dependencies: [], updatedAt: now },
      { name: 'graph-validator', version: '0.1.0', description: 'Advanced validation rules for graph integrity', author: 'Community', downloads: 450, rating: 4.0, tags: ['validation', 'audit'], dependencies: [], updatedAt: now },
      { name: 'graph-metrics', version: '0.1.0', description: 'Extended metrics and statistics for graphs', author: 'Community', downloads: 320, rating: 3.8, tags: ['metrics', 'analytics'], dependencies: [], updatedAt: now },
      { name: 'neo4j-connector', version: '0.2.0', description: 'Import/export graphs from Neo4j databases', author: 'Community', downloads: 180, rating: 3.5, tags: ['database', 'neo4j', 'import', 'export'], dependencies: [{ name: 'json-formatter', version: '>=0.1.0' }], updatedAt: now },
      { name: 'graph-viz-styles', version: '0.1.0', description: 'Custom visual styles and themes for graph rendering', author: 'Community', downloads: 210, rating: 4.1, tags: ['visualization', 'styles', 'themes'], dependencies: [], updatedAt: now },
      { name: 'graph-diff', version: '0.1.0', description: 'Compare two graphs and show differences', author: 'Community', downloads: 95, rating: 3.9, tags: ['diff', 'compare', 'versioning'], dependencies: [{ name: 'json-formatter', version: '>=0.1.0' }], updatedAt: now },
      { name: 'graph-export-pdf', version: '0.1.0', description: 'Export graph visualizations to PDF', author: 'Community', downloads: 150, rating: 3.6, tags: ['export', 'pdf', 'visualization'], dependencies: [], updatedAt: now },
      // === Fase 12 — Community plugins (15 nuevos) ===
      { name: 'graph-export-svg', version: '0.1.0', description: 'Export graph to SVG vector format', author: 'Community', downloads: 340, rating: 4.2, tags: ['export', 'svg', 'vector', 'visualization'], dependencies: [], updatedAt: now },
      { name: 'graph-export-png', version: '0.1.0', description: 'Export graph to PNG image', author: 'Community', downloads: 280, rating: 3.9, tags: ['export', 'png', 'image', 'visualization'], dependencies: [], updatedAt: now },
      { name: 'graph-export-excel', version: '0.1.0', description: 'Export graph data to Excel (XLSX)', author: 'Community', downloads: 190, rating: 3.7, tags: ['export', 'excel', 'xlsx', 'spreadsheet'], dependencies: [{ name: 'json-formatter', version: '>=0.1.0' }], updatedAt: now },
      { name: 'graph-import-jsonld', version: '0.1.0', description: 'Import from JSON-LD (Linked Data) format', author: 'Community', downloads: 120, rating: 3.8, tags: ['import', 'jsonld', 'rdf', 'linked-data'], dependencies: [{ name: 'json-formatter', version: '>=0.1.0' }], updatedAt: now },
      { name: 'graph-import-gexf', version: '0.1.0', description: 'Import from GEXF (Gephi) format', author: 'Community', downloads: 160, rating: 4.0, tags: ['import', 'gexf', 'gephi', 'graphml'], dependencies: [], updatedAt: now },
      { name: 'graph-import-tgf', version: '0.1.0', description: 'Import from Trivial Graph Format (TGF)', author: 'Community', downloads: 85, rating: 3.5, tags: ['import', 'tgf', 'simple'], dependencies: [], updatedAt: now },
      { name: 'graph-import-cypher', version: '0.1.0', description: 'Import from Cypher query results', author: 'Community', downloads: 110, rating: 3.6, tags: ['import', 'cypher', 'neo4j', 'query'], dependencies: [{ name: 'neo4j-connector', version: '>=0.1.0' }], updatedAt: now },
      { name: 'graph-transform', version: '0.1.0', description: 'Graph transformation: merge, split, filter, map', author: 'Community', downloads: 230, rating: 4.1, tags: ['transform', 'merge', 'filter', 'map'], dependencies: [{ name: 'json-formatter', version: '>=0.1.0' }], updatedAt: now },
      { name: 'graph-layout', version: '0.1.0', description: 'Advanced layout algorithms (force, hierarchical, circular)', author: 'Community', downloads: 310, rating: 4.3, tags: ['layout', 'force', 'hierarchical', 'visualization'], dependencies: [], updatedAt: now },
      { name: 'graph-clustering', version: '0.1.0', description: 'Node clustering and community detection', author: 'Community', downloads: 175, rating: 3.9, tags: ['clustering', 'community', 'detection', 'ml'], dependencies: [], updatedAt: now },
      { name: 'graph-search', version: '0.1.0', description: 'Full-text and fuzzy search on graph nodes', author: 'Community', downloads: 200, rating: 4.0, tags: ['search', 'fuzzy', 'fulltext', 'query'], dependencies: [], updatedAt: now },
      { name: 'graph-history', version: '0.1.0', description: 'Undo/redo and version history for graph operations', author: 'Community', downloads: 145, rating: 3.8, tags: ['history', 'undo', 'redo', 'versioning'], dependencies: [], updatedAt: now },
      { name: 'graph-scheduler', version: '0.1.0', description: 'Schedule recurring graph operations and exports', author: 'Community', downloads: 95, rating: 3.5, tags: ['scheduler', 'cron', 'automation'], dependencies: [], updatedAt: now },
      { name: 'graph-alerts', version: '0.1.0', description: 'Graph event alerts, webhooks, and notifications', author: 'Community', downloads: 78, rating: 3.4, tags: ['alerts', 'webhook', 'notifications', 'events'], dependencies: [], updatedAt: now },
      { name: 'graph-ai', version: '0.1.0', description: 'AI-powered graph analysis: anomaly detection, prediction, recommendations', author: 'Community', downloads: 220, rating: 4.4, tags: ['ai', 'ml', 'anomaly', 'prediction', 'recommendations'], dependencies: [{ name: 'graph-metrics', version: '>=0.1.0' }, { name: 'graph-clustering', version: '>=0.1.0' }], updatedAt: now },
    );
  }

  /** Search the marketplace */
  search(query?: string, tag?: string): MarketplacePlugin[] {
    let results = [...this.catalog];
    if (query) {
      const q = query.toLowerCase();
      results = results.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    if (tag) {
      results = results.filter(p => p.tags.includes(tag));
    }
    return results.sort((a, b) => b.downloads - a.downloads);
  }

  /** Get a plugin from the catalog */
  get(name: string): MarketplacePlugin | undefined {
    return this.catalog.find(p => p.name === name);
  }

  /** List all catalog plugins */
  list(): MarketplacePlugin[] {
    return [...this.catalog];
  }

  /** Install a plugin (mark as installed) */
  install(name: string, version?: string): boolean {
    const plugin = this.catalog.find(p => p.name === name);
    if (!plugin) return false;
    // Check dependency resolution
    for (const dep of plugin.dependencies) {
      const depPlugin = this.catalog.find(p => p.name === dep.name);
      if (!depPlugin) return false;
      this.installed.set(dep.name, depPlugin.version);
    }
    this.installed.set(name, version || plugin.version);
    return true;
  }

  /** Uninstall a plugin */
  uninstall(name: string): boolean {
    // Check if any installed plugin depends on this one
    for (const [installedName, _] of this.installed) {
      const plugin = this.catalog.find(p => p.name === installedName);
      if (plugin && plugin.dependencies.some(d => d.name === name)) {
        return false; // Has dependents
      }
    }
    return this.installed.delete(name);
  }

  /** Check if a plugin is installed */
  isInstalled(name: string): boolean {
    return this.installed.has(name);
  }

  /** List installed plugins */
  listInstalled(): { name: string; version: string; plugin: MarketplacePlugin | undefined }[] {
    return Array.from(this.installed.entries()).map(([name, version]) => ({
      name, version, plugin: this.catalog.find(p => p.name === name),
    }));
  }

  /** Get marketplace stats */
  getStats(): { total: number; installed: number; categories: string[] } {
    const tags = new Set<string>();
    this.catalog.forEach(p => p.tags.forEach(t => tags.add(t)));
    return { total: this.catalog.length, installed: this.installed.size, categories: Array.from(tags) };
  }
}

// ============================================================
// Top-level PluginSystem
// ============================================================

export class PluginSystem {
  readonly registry: PluginRegistry;
  readonly marketplace: PluginMarketplace;

  constructor() {
    this.registry = new PluginRegistry();
    this.marketplace = new PluginMarketplace();
  }

  /** Get system stats */
  getStats(): { registry: PluginStats; marketplace: { total: number; installed: number } } {
    return {
      registry: this.registry.getStats(),
      marketplace: { total: this.marketplace.getStats().total, installed: this.marketplace.getStats().installed },
    };
  }
}

export const pluginSystem = new PluginSystem();
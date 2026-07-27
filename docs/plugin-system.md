# COS Plugin System

> **Version:** 0.1.0 — Fase 12 del roadmap COS Graph Engine
> **Estado:** COMPLETADA

## Arquitectura

El sistema de plugins consta de tres componentes principales:

```
PluginSystem
├── PluginRegistry     — Registro, ciclo de vida, hooks, formatos
├── PluginMarketplace  — Catalogo, busqueda, instalacion, dependencias
└── Plugin (interface) — Punto de extension para plugins externos
```

### PluginRegistry

Gestiona el registro y ciclo de vida de los plugins. Proporciona:

- `register(plugin)` — Registrar un plugin externo (valida dependencias)
- `unregister(name)` — Eliminar un plugin del registro
- `activate(name)` / `deactivate(name)` — Activar/desactivar un plugin
- `list()` / `listActive()` — Listar todos los plugins o solo los activos
- `get(name)` — Obtener un plugin por nombre
- `executeHook(hook, context)` — Ejecutar un hook en todos los plugins activos
- `importFrom(format, raw)` — Importar un grafo desde un formato
- `exportTo(format, graph)` — Exportar un grafo a un formato
- `getStats()` — Estadisticas del registry

### PluginMarketplace

Catalogo de plugins instalables. Proporciona:

- `search(query?, tag?)` — Buscar plugins por texto o tag
- `list()` — Listar todo el catalogo
- `get(name)` — Obtener informacion de un plugin
- `install(name, version?)` — Instalar un plugin (resuelve dependencias)
- `uninstall(name)` — Desinstalar (rechaza si tiene dependientes)
- `isInstalled(name)` — Verificar si un plugin esta instalado
- `listInstalled()` — Listar plugins instalados
- `getStats()` — Estadisticas del marketplace

## Plugin Interface

```typescript
interface Plugin {
  manifest: PluginManifest;  // name, version, description, hooks, dependencies
  activated: boolean;
  onActivate?(): void;
  onDeactivate?(): void;
  onHook?(hook: HookName, context: HookContext): HookContext;
  import?(raw: string): FormatResult;
  export?(graph: GraphData): { success, data?, error? };
}
```

### PluginManifest

```typescript
interface PluginManifest {
  name: string;           // Nombre unico del plugin
  version: string;        // SemVer
  description: string;    // Descripcion corta
  author?: string;        // Autor
  hooks: HookName[];      // Hooks que implementa
  dependencies?: { name: string; version: string }[];  // Dependencias
  formats?: ('import' | 'export')[];
}
```

## Hook System

Los hooks permiten a los plugins interceptar operaciones del grafo:

| Hook | Momento | Uso tipico |
|------|---------|------------|
| `beforeAddNode` | Antes de anadir un nodo | Validacion, filtrado |
| `afterAddNode` | Despues de anadir un nodo | Logging, metricas |
| `beforeAddEdge` | Antes de anadir una arista | Validacion de restricciones |
| `afterAddEdge` | Despues de anadir una arista | Tracking, auditoria |
| `beforeRemoveNode` | Antes de eliminar un nodo | Confirmacion, backup |
| `afterRemoveNode` | Despues de eliminar un nodo | Limpieza de cache |
| `beforeRemoveEdge` | Antes de eliminar una arista | Verificacion |
| `afterRemoveEdge` | Despues de eliminar una arista | Recalculos |
| `beforeExecute` | Antes de ejecutar un pipeline | Preparacion |
| `afterExecute` | Despues de ejecutar un pipeline | Post-procesamiento |
| `onInit` | Inicializacion del sistema | Carga de configuracion |
| `onDestroy` | Terminacion del sistema | Limpieza de recursos |
| `onRender` | Antes de renderizar | Personalizacion visual |
| `onExport` | Antes de exportar | Transformacion de datos |
| `onImport` | Despues de importar | Enriquecimiento de datos |

Los hooks pueden abortar la operacion estableciendo `ctx.abort = true`.

## Formatos Soportados

### CSV
- **Importe**: `plugin import --format csv --input data.csv`
- **Exporte**: `plugin export --format csv --output graph.csv`
- Columnas `id` para nodos o `source,target` para aristas

### JSON
- **Importe**: `plugin import --format json --input graph.json`
- **Exporte**: `plugin export --format json --output graph.json`
- Estructura: `{ nodes: [{id, label?}], edges: [{source, target, label?}] }`

### GraphML
- **Importe**: `plugin import --format graphml --input graph.graphml`
- **Exporte**: `plugin export --format graphml --output graph.graphml`
- Estandar XML de graphml.graphdrawing.org

## CLI Usage

```bash
# Listar todos los plugins instalados
cos graph plugin list

# Buscar en el marketplace
cos graph plugin search --query csv
cos graph plugin search --query neo4j

# Importar un grafo desde un archivo CSV
cos graph plugin import --format csv --input data.csv

# Exportar un grafo a GraphML
cos graph plugin export --format graphml --output graph.graphml

# Exportar a JSON (stdout)
cos graph plugin export --format json

# Instalar un plugin del marketplace
cos graph plugin install --name graph-metrics
```

## Marketplace Plugins

Actualmente hay **26 plugins** en el catalogo, incluyendo:

### Core (5 built-in)
| Plugin | Version | Descripcion |
|--------|---------|-------------|
| csv-importer | 0.1.0 | Import graphs from CSV |
| csv-exporter | 0.1.0 | Export graphs to CSV |
| graphml-importer | 0.1.0 | Import from GraphML |
| graphml-exporter | 0.1.0 | Export to GraphML |
| json-formatter | 0.1.0 | Enhanced JSON import/export |

### Community (21)
| Plugin | Version | Descripcion |
|--------|---------|-------------|
| graph-validator | 0.1.0 | Validation rules for graph integrity |
| graph-metrics | 0.1.0 | Extended metrics and statistics |
| neo4j-connector | 0.2.0 | Import/export from Neo4j |
| graph-viz-styles | 0.1.0 | Custom visual styles and themes |
| graph-diff | 0.1.0 | Compare two graphs, show differences |
| graph-export-pdf | 0.1.0 | Export graph visualizations to PDF |
| graph-export-svg | 0.1.0 | Export graph to SVG vector format |
| graph-export-png | 0.1.0 | Export graph to PNG image |
| graph-export-excel | 0.1.0 | Export graph data to Excel |
| graph-import-jsonld | 0.1.0 | Import from JSON-LD format |
| graph-import-gexf | 0.1.0 | Import from GEXF (Gephi) format |
| graph-import-tgf | 0.1.0 | Import from Trivial Graph Format |
| graph-import-cypher | 0.1.0 | Import from Cypher queries |
| graph-transform | 0.1.0 | Graph transformation and mapping |
| graph-layout | 0.1.0 | Advanced layout algorithms |
| graph-clustering | 0.1.0 | Node clustering and community detection |
| graph-search | 0.1.0 | Full-text and fuzzy search |
| graph-history | 0.1.0 | Undo/redo and version history |
| graph-scheduler | 0.1.0 | Scheduled graph operations |
| graph-alerts | 0.1.0 | Graph event alerts and notifications |
| graph-ai | 0.1.0 | AI-powered graph analysis |

## Ejemplo: Crear un Plugin Externo

```typescript
import { Plugin, PluginRegistry, HookName } from 'cos-graph';

const myPlugin: Plugin = {
  manifest: {
    name: 'my-audit-plugin',
    version: '1.0.0',
    description: 'Audita todas las operaciones del grafo',
    author: 'Me',
    hooks: ['afterAddNode', 'afterAddEdge', 'beforeRemoveNode'],
  },
  activated: false,

  onActivate() {
    console.log('Audit plugin activated');
  },

  async onHook(hook: HookName, ctx) {
    console.log(`[Audit] ${hook}:`, JSON.stringify(ctx.data));
    return ctx; // Never abort, just log
  },
};

const registry = new PluginRegistry();
registry.register(myPlugin);
registry.activate('my-audit-plugin');
```

## Tests

80 tests unitarios cubren:

- **PluginRegistry**: 5 built-in plugins, registro externo, activate/deactivate, unregister
- **Hooks**: ejecucion, abort, contexto compartido
- **CSV Import/Export**: parsing de nodos y aristas, errores
- **GraphML Import/Export**: XML parsing, serializacion
- **JSON Import/Export**: validacion de schema, errores
- **Error Handling**: formatos desconocidos, datos invalidos
- **PluginMarketplace**: catalogo, busqueda, instalacion, dependencias, proteccion de dependientes
- **PluginSystem**: top-level integration, singleton

Ejecutar: `npx tsx scripts/test-plugin.ts`
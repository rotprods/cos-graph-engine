"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Route = void 0;
const react_router_1 = require("@tanstack/react-router");
const react_1 = require("react");
exports.Route = (0, react_router_1.createFileRoute)("/")({
    component: Index,
});
const LEVELS = [
    { level: 0, name: "Visual Graph", desc: "Renderizado Mermaid, Graphviz, ASCII" },
    { level: 1, name: "Execution Graph", desc: "Ejecución secuencial y paralela" },
    { level: 2, name: "State Machine", desc: "Máquinas de estado con transiciones" },
    { level: 3, name: "Dependency Resolver", desc: "Resolución topológica" },
    { level: 4, name: "Call Graph", desc: "Análisis de llamadas" },
    { level: 5, name: "CFG", desc: "Control Flow Graph" },
    { level: 6, name: "Data Flow", desc: "Análisis de flujo de datos" },
    { level: 7, name: "Compute", desc: "MLP y redes neuronales" },
    { level: 8, name: "Knowledge Graph", desc: "Entidades y relaciones" },
    { level: 9, name: "Semantic Graph", desc: "Análisis semántico" },
    { level: 10, name: "Embedding Graph", desc: "Vectores de embedding" },
    { level: 11, name: "GraphRAG", desc: "RAG con índices de grafo" },
    { level: 12, name: "Memory Graph", desc: "Memoria multicapa" },
    { level: 13, name: "Agent Graph", desc: "Agentes autónomos" },
    { level: 14, name: "Tool Graph", desc: "Herramientas ejecutables" },
    { level: 15, name: "Workflow Graph", desc: "Workflows multi-paso" },
    { level: 16, name: "Network Graph", desc: "Redes y métricas" },
    { level: 17, name: "Social Graph", desc: "Influencia social" },
    { level: 18, name: "Biological Graph", desc: "Rutas metabólicas" },
    { level: 19, name: "Molecular Graph", desc: "Estructuras moleculares" },
];
const FEATURES = [
    { icon: "∞", title: "20 Niveles", desc: "De visualización básica a grafos moleculares. Una API unificada para 20 dominios." },
    { icon: "⚡", title: "Zero Dependencias", desc: "Sin dependencias externas. TypeScript puro, Node 18+, compilación con tsx." },
    { icon: "🧠", title: "ML Integrado", desc: "GCN, AutoML, clasificación por embeddings, neural re-ranking." },
    { icon: "🔬", title: "1068 Tests", desc: "Cobertura completa. 0 fallos en todas las suites de prueba." },
    { icon: "📡", title: "Tiempo Real", desc: "Streaming, observables, WebSocket-like API, subscriptions." },
    { icon: "🗄️", title: "Persistencia", desc: "Sharding, caché multinivel, replicación master-slave y multi-master." },
    { icon: "🔌", title: "26 Plugins", desc: "Marketplace de plugins con 15 hooks de ciclo de vida." },
    { icon: "🌐", title: "GraphQL + Cypher", desc: "API GraphQL nativa y consultas estilo Cypher sobre L8-L11." },
    { icon: "📦", title: "6 Formatos", desc: "Import/Export: GraphML, GEXF, GDF, JSON, CSV, DOT." },
    { icon: "🎮", title: "Playground REPL", desc: "REPL interactivo por nivel y 20 tutoriales guiados." },
];
const STATS = [
    { value: "20", label: "Niveles" },
    { value: "1068", label: "Tests" },
    { value: "0", label: "Fallos" },
    { value: "26", label: "Plugins" },
    { value: "6", label: "Formatos" },
    { value: "2.0", label: "Versión" },
];
function Index() {
    const [scrolled, setScrolled] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        const onScroll = () => setScrolled(window.scrollY > 40);
        window.addEventListener("scroll", onScroll);
        return () => window.removeEventListener("scroll", onScroll);
    }, []);
    return (<div className="min-h-screen bg-surface-900 text-surface-100">
      {/* Nav */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-surface-900/80 backdrop-blur-md border-b border-surface-800" : "bg-transparent"}`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <span className="text-lg font-bold tracking-tight">
            <span className="text-brand-400">cos</span>graph
          </span>
          <div className="flex items-center gap-6 text-sm text-surface-400">
            <a href="#levels" className="hover:text-surface-100 transition-colors">Niveles</a>
            <a href="#features" className="hover:text-surface-100 transition-colors">Features</a>
            <a href="#cli" className="hover:text-surface-100 transition-colors">CLI</a>
            <a href="https://github.com/rotprods/cos" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-500 transition-colors">
              GitHub →
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex min-h-[90vh] flex-col items-center justify-center px-6 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.08),transparent_60%)]"/>
        <div className="animate-fade-in relative z-10 max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-surface-700 bg-surface-800/50 px-4 py-1 text-xs text-surface-400">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400"/>
            v2.0.0 — Production Ready
          </div>
          <h1 className="mb-4 text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            COS{" "}
            <span className="gradient-text">Graph Engine</span>
          </h1>
          <p className="mx-auto mb-6 max-w-xl text-lg text-surface-400">
            Un motor de grafos de 20 niveles, zero-dependencias, con ML integrado, 
            streaming en tiempo real, persistencia escalable y CLI unificado.
          </p>
          <div className="flex items-center justify-center gap-3">
            <a href="https://github.com/rotprods/cos" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-500 transition-colors">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
              GitHub
            </a>
            <a href="#cli" className="inline-flex items-center gap-2 rounded-lg border border-surface-700 px-6 py-3 text-sm font-semibold text-surface-300 hover:border-surface-500 hover:text-surface-100 transition-colors">
              npm install @cos/graph
            </a>
          </div>
          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-surface-500">
            <span className="flex items-center gap-1"><span className="h-1 w-1 rounded-full bg-green-400"/> 1068 tests</span>
            <span className="text-surface-700">|</span>
            <span>0 dependencias externas</span>
            <span className="text-surface-700">|</span>
            <span>TypeScript</span>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-surface-800 py-8">
        <div className="mx-auto flex max-w-4xl flex-wrap justify-center gap-8 px-6">
          {STATS.map((s) => (<div key={s.label} className="text-center">
              <div className="text-2xl font-bold text-brand-400">{s.value}</div>
              <div className="text-xs text-surface-500">{s.label}</div>
            </div>))}
        </div>
      </section>

      {/* Levels */}
      <section id="levels" className="py-24 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-3xl font-bold">Arquitectura de 20 Niveles</h2>
            <p className="text-surface-400">4 dominios, 20 niveles. Una API unificada de principio a fin.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {LEVELS.map((l) => {
            const domain = l.level <= 3 ? "Base" : l.level <= 7 ? "Computacional" : l.level <= 11 ? "Cognitivo" : "Aplicado";
            const colors = ["border-blue-500/30", "border-emerald-500/30", "border-violet-500/30", "border-amber-500/30"];
            const bgColors = ["bg-blue-500/10", "bg-emerald-500/10", "bg-violet-500/10", "bg-amber-500/10"];
            const idx = l.level <= 3 ? 0 : l.level <= 7 ? 1 : l.level <= 11 ? 2 : 3;
            return (<div key={l.level} className={`level-card rounded-lg border ${colors[idx]} ${bgColors[idx]} p-4`}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-mono text-surface-500">L{l.level}</span>
                    <span className="text-[10px] uppercase tracking-wider text-surface-500">{domain}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-surface-200">{l.name}</h3>
                  <p className="mt-0.5 text-xs text-surface-500">{l.desc}</p>
                </div>);
        })}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-surface-800 py-24 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-3xl font-bold">Características</h2>
            <p className="text-surface-400">Todo lo que necesitas para construir y ejecutar grafos en producción.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (<div key={f.title} className="rounded-lg border border-surface-800 bg-surface-800/30 p-5 hover:border-surface-700 transition-colors">
                <div className="mb-2 text-2xl">{f.icon}</div>
                <h3 className="mb-1 text-sm font-semibold">{f.title}</h3>
                <p className="text-xs text-surface-500 leading-relaxed">{f.desc}</p>
              </div>))}
          </div>
        </div>
      </section>

      {/* CLI */}
      <section id="cli" className="border-t border-surface-800 py-24 px-6">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-3xl font-bold">CLI Unificado</h2>
            <p className="text-surface-400">Un solo comando para todo el ecosistema.</p>
          </div>
          <div className="rounded-lg border border-surface-800 bg-surface-900 p-6 font-mono text-sm">
            <div className="mb-4 space-y-2">
              <p className="text-green-400"># Instalación</p>
              <p className="text-surface-300">npm install -g @cos/graph</p>
            </div>
            <div className="space-y-2">
              <p className="text-green-400"># Comandos</p>
              <p className="text-surface-300">cos graph visualize graph.json          # Visualizar grafo</p>
              <p className="text-surface-300">cos graph convert input.gml output.dot  # Convertir formato</p>
              <p className="text-surface-300">cos graph query "MATCH (p:Person) RETURN p"  # Cypher query</p>
              <p className="text-surface-300">cos playground L8                       # REPL interactivo</p>
              <p className="text-surface-300">cos tutorial L17                        # Tutorial guiado</p>
              <p className="text-surface-300">cos benchmark                           # Benchmark de rendimiento</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-surface-800 py-24 px-6 text-center">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-3 text-3xl font-bold">Listo para producción</h2>
          <p className="mb-6 text-surface-400">
            1068 tests, 0 fallos. 20 niveles. 0 dependencias externas.
          </p>
          <div className="flex items-center justify-center gap-3">
            <a href="https://github.com/rotprods/cos" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-500 transition-colors">
              GitHub →
            </a>
            <a href="https://github.com/rotprods/cos/blob/main/CHANGELOG.md" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-surface-700 px-6 py-3 text-sm font-semibold text-surface-300 hover:border-surface-500 hover:text-surface-100 transition-colors">
              Changelog
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-800 py-6 px-6 text-center text-xs text-surface-600">
        COS Graph Engine v2.0.0 — MIT License — Built with TypeScript
      </footer>
    </div>);
}
//# sourceMappingURL=index.js.map
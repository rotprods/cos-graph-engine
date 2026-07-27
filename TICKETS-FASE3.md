# FASE 3 — Consolidacion: Desglose en tickets

> Proximo paso despues del adversarial refactor
> Estimacion total: ~27h

---

## Indice de tickets

| ID | Ticket | Prioridad | Estimacion | Depende de |
|----|--------|-----------|------------|------------|
| T-3.1 | Agregar npm scripts al package.json | P1 | 1h | -- |
| T-3.2 | benchmark-report dinámico (lee datos reales) | P1 | 3h | T-3.1 |
| T-3.3 | Auto-release en push a main | P2 | 4h | T-3.1 |
| T-3.4 | Cobertura de codigo con c8 | P2 | 3h | T-3.1 |
| T-3.5 | README.md actualizado | P1 | 2h | T-3.1 |
| T-3.6 | CONTRIBUTING.md | P2 | 3h | T-3.5 |
| T-3.7 | API Reference con TypeDoc | P3 | 8h | T-3.5 |
| T-3.8 | Validacion de grafos en L4-L11 | P2 | 3h | -- |

---

## T-3.1: Agregar npm scripts al package.json

**Prioridad:** P1 | **Estimacion:** 1h | **Depende de:** --

### Descripcion

El `package.json` raiz tiene scripts minimos (`start`, `test`, `build`, `cos`).
Faltan scripts para ejecutar las nuevas suites de test y benchmarks.

### Estado actual

```json
"scripts": {
  "start": "npx tsx packages/deployment/src/launch.ts",
  "test": "npx tsx scripts/run-tests.ts",
  "build": "bash scripts/build.sh",
  "cos": "npx tsx packages/deployment/src/commander.ts",
  "cos:cli": "npx tsx packages/deployment/src/cli.ts",
  "help": "npx tsx packages/deployment/src/cli.ts --help",
  "release": "npm run build && echo 'Ready for npm publish'"
}
```

### Tareas

- [ ] Agregar `test:all` — ejecuta las 7 suites en secuencia
- [ ] Agregar `test:mutation` — L1 + L3 mutation tests
- [ ] Agregar `test:l1` — L1 diamond + mutation
- [ ] Agregar `test:l3` — L3 consistency + mutation
- [ ] Agregar `test:l7` — L7 compute tests
- [ ] Agregar `test:l12-19` — Levels 12-19 tests
- [ ] Agregar `benchmark` — benchmark-perf.ts
- [ ] Agregar `benchmark:report` — benchmark + HTML report
- [ ] Agregar `ci` — mismo que test:all pero con --no-warnings

### Definition of Done

- `npm run test:all` ejecuta las 7 suites y reporta "390 tests, 0 failures"
- `npm run benchmark` genera benchmark-perf.ts output
- `npm run benchmark:report` ademas genera benchmark-report.html
- Se actualiza `"engines"` en package.json

---

## T-3.2: benchmark-report dinámico

**Prioridad:** P1 | **Estimacion:** 3h | **Depende de:** T-3.1

### Descripcion

Actualmente `generate-benchmark-report.ts` tiene los datos hardcodeados como
un array estatico. Debe leer la salida real de `benchmark-perf.ts` (o los
resultados desde un archivo JSON intermedio) para generar el HTML.

### Estado actual

```typescript
const data: BenchmarkRow[] = [
  { category: 'L1 Queue', test: 'Chain n=10', oldValue: '45', ... },
  // hardcodeado
];
```

### Objetivo

Que el reporte HTML refleje datos reales de cada ejecucion de benchmark,
no valores pre-calculados.

### Tareas

- [ ] Modificar `benchmark-perf.ts` para que ademas de imprimir a consola,
      escriba un archivo `benchmark-data.json` con los resultados estructurados
- [ ] Modificar `generate-benchmark-report.ts` para leer `benchmark-data.json`
      y generar el HTML dinamicamente
- [ ] Agregar fallback: si no existe benchmark-data.json, usar valores
      hardcodeados como respaldo
- [ ] Verificar que `npm run benchmark:report` genere un HTML correcto

### Esquema de benchmark-data.json

```json
{
  "generatedAt": "2026-07-22T12:00:00Z",
  "suites": [
    {
      "name": "L1 Queue Optimization",
      "results": [
        { "test": "Chain n=10", "oldIterations": 45, "newIterations": 9, "unit": "iterations" },
        { "test": "Chain n=100", "oldIterations": 4950, "newIterations": 99, "unit": "iterations" }
      ]
    }
  ],
  "summary": {
    "peakImprovement": "250x",
    "totalTests": 390,
    "failures": 0
  }
}
```

### Definition of Done

- `npm run benchmark:report` produce un HTML con datos de la ejecucion real
- Si benchmark-data.json no existe, el HTML se genera con valores por defecto
- El HTML incluye timestamp de generacion

---

## T-3.3: Auto-release en push a main

**Prioridad:** P2 | **Estimacion:** 4h | **Depende de:** T-3.1

### Descripcion

El workflow de CI debe hacer auto-tagging y publicar a GitHub Releases cuando
se pushea a main, tomando `RELEASE-v*.md` como body.

### Estado actual

El workflow `.github/workflows/ci.yml` tiene 8 jobs pero ninguno publica releases.

### Tareas

- [ ] Agregar job `release` al workflow que:
      1. Se ejecuta solo en push a `main`
      2. Busca archivos `RELEASE-v*.md` en el repo
      3. Extrae la version del nombre del archivo (ej: `v1.1.0`)
      4. Crea un tag git con esa version
      5. Crea una GitHub Release con el contenido del archivo como body
- [ ] Configurar `GITHUB_TOKEN` para permisos de escritura
- [ ] Agregar paso de verificacion: no hacer release si los tests fallaron
- [ ] Opcional: generar automaticamente release notes desde commits con
      conventional commits (feat/fix/breaking)

### Estructura del job

```yaml
release:
  name: Create GitHub Release
  runs-on: ubuntu-latest
  needs: [full-regression]
  if: github.ref == 'refs/heads/main' && success()
  steps:
    - uses: actions/checkout@v4
    - name: Find release notes
      run: |
        FILE=$(ls RELEASE-v*.md 2>/dev/null | head -1)
        echo "RELEASE_FILE=$FILE" >> $GITHUB_ENV
        echo "RELEASE_VERSION=${FILE#RELEASE-}" >> $GITHUB_ENV
        echo "RELEASE_VERSION=${RELEASE_VERSION%.md}" >> $GITHUB_ENV
    - name: Create Release
      if: env.RELEASE_FILE != ''
      uses: softprops/action-gh-release@v2
      with:
        tag_name: ${{ env.RELEASE_VERSION }}
        body_path: ${{ env.RELEASE_FILE }}
        files: benchmark-report.html
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Definition of Done

- Push a main con RELEASE-v1.1.0-adversarial.md presente crea:
  - Tag `v1.1.0-adversarial`
  - GitHub Release con el contenido del archivo
  - benchmark-report.html adjunto como artifact
- Push sin archivos RELEASE no crea release
- Push con tests fallidos no crea release

---

## T-3.4: Cobertura de codigo con c8

**Prioridad:** P2 | **Estimacion:** 3h | **Depende de:** T-3.1

### Descripcion

Agregar cobertura de codigo (code coverage) usando c8 (la alternativa moderna
a nyc/istanbul). El reporte debe generarse en CI y publicarse como artifact.

### Tareas

- [ ] Instalar `c8` como devDependency: `npm install -D c8`
- [ ] Agregar script `test:coverage` que ejecute las 7 suites bajo c8
- [ ] Configurar .c8rc.json con:
  - `all: true` (incluir archivos no importados)
  - `reporter: ['text', 'lcov', 'html']`
  - `include: ['packages/graph/src/**']`
  - `exclude: ['**/*.test.*', '**/node_modules/**']`
- [ ] Agregar job `coverage` al CI workflow que:
  - Ejecuta `npm run test:coverage`
  - Sube reporte lcov a Codecov o similar (opcional)
  - Sube reporte HTML como artifact
- [ ] Agregar badge de cobertura al README (si se configura Codecov)

### Configuracion .c8rc.json

```json
{
  "all": true,
  "reporter": ["text", "lcov", "html"],
  "include": ["packages/graph/src/**"],
  "exclude": [
    "**/*.test.*",
    "**/node_modules/**",
    "packages/graph/src/index.ts"
  ],
  "watermarks": {
    "lines": [80, 95],
    "functions": [80, 95],
    "branches": [75, 90],
    "statements": [80, 95]
  }
}
```

### Definition of Done

- `npm run test:coverage` produce reporte de cobertura en terminal + HTML + lcov
- Cobertura actual documentada (objetivo: ~70%+)
- CI job coverage sube HTML como artifact
- (Opcional) Badge de cobertura en README

---

## T-3.5: README.md actualizado

**Prioridad:** P1 | **Estimacion:** 2h | **Depende de:** T-3.1

### Descripcion

El README actual describe la arquitectura de COS pero no refleja los cambios
del adversarial refactor. Debe actualizarse para incluir:

### Tareas

- [ ] Seccion "Graph Engine (20 niveles)" con tabla resumen
- [ ] Badges: CI status, tests, coverage, version
- [ ] Tabla de test suites actualizada (390 tests, 10 archivos)
- [ ] Seccion "Recent Changes" o "Changelog" con link a CHANGELOG.md
- [ ] Scripts actualizados en la seccion "Quick Start"
- [ ] Link a PLAN-MAESTRO.md, RELEASE-v1.1.0.md, benchmark-report.html

### Formato de badges sugerido

```markdown
[![CI](https://github.com/your-org/cos/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/cos/actions)
[![Tests](https://img.shields.io/badge/tests-390-green)]()
[![Coverage](https://img.shields.io/badge/coverage-70%25-yellowgreen)]()
[![Version](https://img.shields.io/badge/version-0.1.0-blue)]()
```

### Definition of Done

- README.md refleja el estado actual del proyecto
- Todos los badges funcionan (o son placeholders si no hay CI publico)
- Enlaces a nuevos documentos funcionan

---

## T-3.6: CONTRIBUTING.md

**Prioridad:** P2 | **Estimacion:** 3h | **Depende de:** T-3.5

### Descripcion

Guia de contribucion para desarrolladores que quieran agregar fixes, tests,
o nuevos niveles al grafo.

### Tareas

- [ ] Escribir CONTRIBUTING.md con:

#### Secciones requeridas

1. **Bienvenida** — que es COS, como contribuir
2. **Setup del entorno**:
   - Node 18.20.4 (no nvm)
   - Next 14 + Tailwind v3 (no v4/v15)
   - Zero-dep rule: ORM, cache, queue, auth, LLM, crawler, storage,
     infra DEBEN ser in-house
   - Solo aceptables: Stripe, SendGrid, LangChain, Algolia
3. **Branch strategy**:
   - `main` — estable, solo via PR
   - `develop` — integracion
   - `feature/*` — ramas de trabajo
4. **Estandar de codigo**:
   - TypeScript estricto
   - JSDoc en todos los metodos publicos
   - Convencion de edges documentada (source→target = source depende de target)
   - Sin dependencias externas (zero-dep rule)
5. **Tests**:
   - Toda nueva funcionalidad DEBE tener tests
   - Tests deben pasar antes de abrir PR
   - `npm run test:all` = 390 tests, 0 failures
6. **CI/CD**:
   - Push a feature branch → CI runs tests
   - Push a develop → CI runs tests + benchmarks
   - Push a main → CI runs tests + benchmarks + release
7. **Code review checklist**:
   - Tests agregados?
   - Documentacion actualizada?
   - CHANGELOG actualizado?
   - Zero-dep rule respetada?
   - Performance considerada (O(n+m) vs O(n*m))?

### Definition of Done

- CONTRIBUTING.md existe con las 7 secciones completas
- Es consistente con PLAN-MAESTRO.md (mismas reglas, mismo tono)

---

## T-3.7: API Reference con TypeDoc

**Prioridad:** P3 | **Estimacion:** 8h | **Depende de:** T-3.5

### Descripcion

Generar documentacion de API desde los JSDoc usando TypeDoc. Esto produce
un sitio HTML navegable con todas las clases, metodos, interfaces, y tipos.

### Tareas

- [ ] Instalar TypeDoc: `npm install -D typedoc`
- [ ] Crear `typedoc.json` con configuracion basica
- [ ] Agregar script `docs:generate` que ejecute TypeDoc
- [ ] Agregar script `docs:serve` que sirva la documentacion localmente
- [ ] (Opcional) Agregar job `docs` al CI que publique a GitHub Pages

### Configuracion typedoc.json

```json
{
  "entryPoints": ["packages/graph/src/index.ts"],
  "out": "docs/api",
  "includeVersion": true,
  "hideGenerator": true,
  "categorizeByGroup": true,
  "categoryOrder": ["Graph Engine", "L0 Visual", "L1 Execution", "L2 State",
    "L3 Dependency", "L4 Call", "L5 CFG", "L6 DataFlow", "L7 Compute",
    "L8 Knowledge", "L9 Semantic", "L10 Embedding", "L11 GraphRAG",
    "L12 Memory", "L13 Agent", "L14 Tool", "L15 Workflow",
    "L16 Network", "L17 Social", "L18 Biological", "L19 Molecular"],
  "sort": ["source-order"],
  "excludePrivate": true,
  "excludeProtected": false,
  "validation": {
    "invalidLink": true,
    "notDocumented": true
  }
}
```

### Definition of Done

- `npm run docs:generate` produce `docs/api/index.html`
- La documentacion incluye todos los niveles (L0-L19)
- Los enlaces entre tipos funcionan
- (Opcional) GitHub Pages publica automaticamente

---

## T-3.8: Validacion de grafos en L4-L11

**Prioridad:** P2 | **Estimacion:** 3h | **Depende de:** --

### Descripcion

Los niveles L4-L11 no tienen validacion de grafos. Si alguien crea un grafo
con nodos duplicados o edges colgantes, no hay proteccion. Este ticket
agrega validacion consistente en todos los niveles.

### Estado actual de validacion

| Nivel | Validacion IDs duplicados | Validacion edges colgantes |
|-------|--------------------------|---------------------------|
| L0 Visual | ❌ No | ❌ No |
| L1 Execution | ✅ Si (Fix 3) | ✅ Si (Fix 2) |
| L2 State | ✅ Si (estados) | ✅ Si (transiciones) |
| L3 Dependency | ✅ Si (Fix 8) | ✅ Si (Fix 8) |
| L4 Call | ❌ No | ❌ No |
| L5 CFG | ❌ No | ❌ No |
| L6 DataFlow | ❌ No | ❌ No |
| L7 Compute | ❌ Parcial | ✅ Si |
| L8 Knowledge | ❌ No | ❌ No |
| L9 Semantic | ❌ No | ❌ No |
| L10 Embedding | ❌ No | ❌ No |
| L11 GraphRAG | ❌ No | ❌ No |

### Tareas

- [ ] L4 CallGraphBuilder: validar IDs unicos en `createGraph`
- [ ] L4 CallGraphBuilder: validar source/target existen en `enterCall`
- [ ] L5 CFGBuilder: validar IDs de bloques unicos
- [ ] L5 CFGBuilder: validar source/target existen en `addEdge`
- [ ] L6 DataFlowGraph: agregar `validate()` method
- [ ] L8 KnowledgeGraphEngine: validar IDs de entidades unicos
- [ ] L9 SemanticGraph: validar IDs de nodos unicos
- [ ] L10 EmbeddingGraph: validar IDs de nodos unicos
- [ ] L11 GraphRAGEngine: validar IDs de chunks unicos
- [ ] Agregar tests de validacion para cada nivel

### Patron a seguir (consistente con L1 y L3)

```typescript
// PATRON: validacion en createGraph / addNode / addEdge
addNode(data: NodeData): string {
  if (this.nodes.some(n => n.id === data.id))
    throw new Error(`Duplicate node ID: ${data.id}`);
  // ... resto
}

addEdge(source: string, target: string): string {
  if (!this.nodes.some(n => n.id === source))
    throw new Error(`Source node ${source} not found`);
  if (!this.nodes.some(n => n.id === target))
    throw new Error(`Target node ${target} not found`);
  // ... resto
}
```

### Definition of Done

- L4-L11 todos lanzan error en IDs duplicados
- L4-L11 todos lanzan error en edges colgantes
- Tests de validacion para cada nivel (minimo 3 tests por nivel)

---

## Resumen de la fase

```
T-3.1 (1h)  npm scripts                    ← Sin dependencias
T-3.2 (3h)  benchmark-report dinámico      ← Espera T-3.1
T-3.3 (4h)  Auto-release                   ← Espera T-3.1
T-3.4 (3h)  Cobertura c8                   ← Espera T-3.1
T-3.5 (2h)  README actualizado             ← Espera T-3.1
T-3.6 (3h)  CONTRIBUTING.md                ← Espera T-3.5
T-3.7 (8h)  TypeDoc API Reference           ← Espera T-3.5
T-3.8 (3h)  Validacion L4-L11              ← Sin dependencias
           ─────
Total:      ~27h

Dependencias:
            T-3.1 ─┬─→ T-3.2
                    ├─→ T-3.3
                    ├─→ T-3.4
                    └─→ T-3.5 ──→ T-3.6
                              └─→ T-3.7

Paralelizable:
   Track A: T-3.1 → T-3.2 → T-3.3  (CI/CD tooling)
   Track B: T-3.1 → T-3.4           (coverage)
   Track C: T-3.1 → T-3.5 → T-3.6 → T-3.7  (documentation)
   Track D: T-3.8                    (validation, sin deps)
```

### Orden recomendado de ejecucion

```
Paso 1: T-3.1 (npm scripts) — base de todo
Paso 2: T-3.8 (validacion L4-L11) — paralelo con los tracks
Paso 3: T-3.2 + T-3.4 (benchmark + coverage) — paralelo entre si
Paso 4: T-3.5 (README) — despues de tener scripts funcionales
Paso 5: T-3.3 (auto-release) — despues de tener CI funcionando
Paso 6: T-3.6 (CONTRIBUTING) — despues de README
Paso 7: T-3.7 (TypeDoc) — opcional, al final
```

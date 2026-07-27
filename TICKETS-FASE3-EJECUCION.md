# FASE 3 — Consolidacion: Tickets de Ejecucion

> Listos para correr. Sigue el /LOOP en cada ticket.
> 8 tickets · ~27h · 4 tracks paralelos

---

## Resumen

```
TRACK A (CI/CD):  T-3.1 → T-3.2 → T-3.3     (✅ T-3.1 completado)
TRACK B (calidad): T-3.1 → T-3.4              (✅ T-3.1 completado)
TRACK C (docs):    T-3.1 → T-3.5 → T-3.6 → T-3.7  (✅ T-3.1 completado)
TRACK D (codigo):  T-3.8                       (✅ T-3.8 completado)
```

**Estado actual:** T-3.1 y T-3.8 completados. Arrancar T-3.2, T-3.4, y T-3.5 en paralelo.

---

## T-3.1: npm scripts en package.json ✅ COMPLETADO

**Track:** A, B, C | **Prioridad:** P1 | **Estimacion:** 1h

Agregados 8 scripts: test:all, test:l1, test:l3, test:l7, test:mutation, benchmark, benchmark:report, ci.

---

## T-3.2: benchmark-report dinamico

**Track:** A | **Prioridad:** P1 | **Estimacion:** 3h | **Dependencias:** T-3.1

### /LOOP

```
DISENIAR  → Leer scripts/generate-benchmark-report.ts y scripts/benchmark-perf.ts.
             Entender la estructura HTML actual y que datos grafica.
PLANIFICAR → 1. Parsear output de benchmark-perf.ts 2. Generar HTML con Chart.js
             3. Tabla comparativa de resultados 4. Seccion de historico
EJECUTAR  → Mejorar generate-benchmark-report.ts con:
             - Chart.js CDN para graficos de barras
             - Tabla de resultados por nivel (L1, L3, L7)
             - Fecha de ejecucion y metadatos
             - Seccion de comparacion con ejecuciones anteriores
VALIDAR   → El HTML se abre en navegador? Los graficos se renderizan?
             Los datos son correctos vs la ejecucion manual?
TESTEAR   → npm run benchmark:report → benchmark-report.html generado
REFACTOR  → Separar en funciones: generateChart(), generateTable(), generateHeader()
COMMIT    → git add -A && git commit -m "feat(benchmark): dynamic HTML report with charts"
```

### Codigo a modificar en `scripts/generate-benchmark-report.ts`

```typescript
// Mejorar para incluir:
// 1. Chart.js para graficos de barras comparativos
// 2. Tabla de resultados con: nivel, operacion, tiempo, factor-mejora
// 3. Metadata de ejecucion (fecha, commit, nodo)
// 4. Seccion de historico (lectura de reportes anteriores en benchmark-reports/)
// 5. Diseño responsive con CSS inline

interface BenchmarkResult {
  level: string;
  operation: string;
  antes: number;   // ms
  despues: number;  // ms
  factor: number;   // mejora (antes/despues)
  n: number;        // tamano del grafo
}

function generateHTML(results: BenchmarkResult[], historical: BenchmarkResult[][]): string {
  // Generar HTML completo con Chart.js, tablas, historico
}
```

### Tests

```bash
npm run benchmark:report
# Verifica que benchmark-report.html existe y contiene datos
test -f benchmark-report.html && echo "✅ Report generated"
grep -c "chart" benchmark-report.html && echo "✅ Charts included"
```

### Definition of Done

- [ ] `npm run benchmark:report` genera HTML con graficos Chart.js
- [ ] Tabla comparativa muestra resultados de L1, L3, L7
- [ ] Fecha de ejecucion y metadatos visibles
- [ ] Seccion de historico (lectura de reportes previos)
- [ ] HTML se abre correctamente en navegador

---

## T-3.3: Auto-release en push a main

**Track:** A | **Prioridad:** P2 | **Estimacion:** 4h | **Dependencias:** T-3.2

### /LOOP

```
DISENIAR  → Leer .github/workflows/ci.yml existente. Investigar semantic-release
             o GitHub Actions para auto-release.
PLANIFICAR → 1. Workflow de release on push a main 2. Version bump automatico
             3. Generar CHANGELOG 4. Crear GitHub Release
EJECUTAR  → Crear .github/workflows/release.yml que:
             - Se activa en push a main
             - Corre tests (reusa el job de ci.yml)
             - Hace version bump (patch/minor/major segun conventional commits)
             - Genera CHANGELOG entry
             - Crea GitHub Release con tag
             - Publica a npm (futuro, cuando exista el paquete)
VALIDAR   → Simular un push a main. El workflow se activa? El release se crea?
TESTEAR   → No se puede testear localmente (depende de GitHub Actions).
             Verificar sintaxis del YAML con actionlint.
REFACTOR  → Separar jobs: test → version → release → notify
COMMIT    → git add -A && git commit -m "feat(ci): auto-release on push to main"
```

### Workflow: `.github/workflows/release.yml`

```yaml
name: Release
on:
  push:
    branches: [main]
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - run: npm ci
      - run: npm run test:all
      - name: Generate Release
        id: release
        run: |
          VERSION=$(node -p "require('./package.json').version")
          PATCH=$(echo $VERSION | cut -d. -f3)
          NEW_PATCH=$((PATCH + 1))
          NEW_VERSION="$(echo $VERSION | cut -d. -f1-2).$NEW_PATCH"
          node -e "const p=require('./package.json'); p.version='$NEW_VERSION'; require('fs').writeFileSync('package.json', JSON.stringify(p, null, 2)+'\n')"
          echo "new_version=$NEW_VERSION" >> $GITHUB_OUTPUT
      - name: Commit Version Bump
        run: |
          git config user.name "COS Bot"
          git config user.email "bot@cos.dev"
          git add package.json
          git commit -m "chore(release): v${{ steps.release.outputs.new_version }}"
          git push
      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          tag_name: v${{ steps.release.outputs.new_version }}
          name: v${{ steps.release.outputs.new_version }}
          body_path: CHANGELOG.md
          generate_release_notes: true
```

### Definition of Done

- [ ] Workflow release.yml creado en `.github/workflows/`
- [ ] Push a main → tests → version bump → release
- [ ] GitHub Release creado con tag y release notes
- [ ] package.json version actualizada automaticamente

---

## T-3.4: Cobertura de codigo con c8

**Track:** B | **Prioridad:** P2 | **Estimacion:** 3h | **Dependencias:** T-3.1

### /LOOP

```
DISENIAR  → Investigar c8 (herramienta de cobertura para Node/TS).
             Entender como se integra con tsx y mocha.
PLANIFICAR → 1. Instalar c8 como devDependency 2. Crear script npm run coverage
             3. Configurar thresholds 4. Agregar a CI
EJECUTAR  → npm install --save-dev c8
             Agregar script: "coverage": "c8 npx tsx scripts/run-tests.ts"
             Crear .c8rc.json con thresholds:
             - all: true (incluye archivos no testeados)
             - branches: 70
             - functions: 75
             - lines: 75
             - statements: 75
             Agregar job de coverage en .github/workflows/ci.yml
VALIDAR   → npm run coverage genera reporte? Los thresholds se cumplen?
             El reporte HTML se genera en coverage/?
TESTEAR   → npm run coverage → 70%+ cobertura
             Verificar que archivos sin tests (L0, L2) aparecen con 0%
REFACTOR  → Ajustar thresholds si es necesario (70% es realista para el estado actual)
COMMIT    → git add -A && git commit -m "feat(ci): add c8 code coverage with thresholds"
```

### Configuracion: `.c8rc.json`

```json
{
  "all": true,
  "include": ["packages/**"],
  "exclude": ["node_modules", "scripts", "**/*.test.ts", "**/*.spec.ts"],
  "reporter": ["text", "html", "lcov"],
  "check-coverage": true,
  "branches": 70,
  "functions": 75,
  "lines": 75,
  "statements": 75
}
```

### CI job

```yaml
coverage:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: 18 }
    - run: npm ci
    - run: npm run coverage
    - name: Upload Coverage
      uses: actions/upload-artifact@v4
      with:
        name: coverage-report
        path: coverage/
```

### Definition of Done

- [ ] `npm run coverage` ejecuta tests con c8
- [ ] Reporte HTML generado en `coverage/`
- [ ] Thresholds configurados (70% branches, 75% lines/functions/statements)
- [ ] Job de coverage en CI
- [ ] Archivos sin tests aparecen en el reporte

---

## T-3.5: README actualizado

**Track:** C | **Prioridad:** P1 | **Estimacion:** 2h | **Dependencias:** T-3.1

### /LOOP

```
DISENIAR  → Leer README.md actual. Identificar que falta.
PLANIFICAR → 1. Que es COS? 2. Arquitectura 20 niveles 3. Instalacion
             4. Uso rapido (5 ejemplos) 5. Scripts disponibles 6. Roadmap
             7. Enlaces a documentacion
EJECUTAR  → Reescribir README.md completo con:
             - Badges (CI, tests, coverage, license, zero-dep)
             - Tabla de los 20 niveles con estado de tests
             - Comparativa COS vs soluciones tradicionales
             - Ejemplos de uso en 5 niveles (L0, L2, L7, L13, L19)
             - Scripts disponibles
             - Roadmap resumido
             - Enlaces a docs/20-USECASES.md, docs/API-REFERENCE.md, etc.
VALIDAR   → Se entiende el proyecto en 30 segundos de lectura?
             Los ejemplos de codigo funcionan?
TESTEAR   → npx tsx evalua los ejemplos sin errores?
REFACTOR  → Mantener README conciso (< 100 lineas de contenido real)
COMMIT    → git add -A && git commit -m "docs(readme): comprehensive project README"
```

### Definition of Done

- [ ] README.md reescrito con tabla de 20 niveles
- [ ] 5 ejemplos de uso funcionando
- [ ] Badges de CI, tests, coverage
- [ ] Enlaces a docs/20-USECASES.md, docs/API-REFERENCE.md, docs/ROADMAP-COMPLETO.md
- [ ] README aprobado por el equipo

---

## T-3.6: CONTRIBUTING.md

**Track:** C | **Prioridad:** P2 | **Estimacion:** 3h | **Dependencias:** T-3.5

### /LOOP

```
DISENIAR  → Investigar buenas practicas de CONTRIBUTING.md en proyectos open source.
PLANIFICAR → 1. Setup local 2. Estructura del proyecto 3. /LOOP workflow
             4. Estandares de codigo 5. Pull Request template 6. Issue templates
EJECUTAR  → Crear CONTRIBUTING.md con:
             - Como clonar y configurar el entorno
             - Estructura de directorios (packages/graph/src/, scripts/, docs/)
             - El ciclo /LOOP: 7 pasos por ticket
             - Estandares: TypeScript, zero-dep, JSDoc, tests primero
             - Convencion de commits (conventional commits)
             - Como crear un Pull Request
             - Templates de Issues (bug, feature, refactor)
             - Code of Conduct
VALIDAR   → Un nuevo desarrollador puede empezar a contribuir sin ayuda?
             Faltan pasos en el setup?
TESTEAR   → Seguir las instrucciones desde cero en un entorno limpio
REFACTOR  → Agregar seccion de troubleshooting con errores comunes
COMMIT    → git add -A && git commit -m "docs(contributing): add CONTRIBUTING.md"
```

### Definition of Done

- [ ] CONTRIBUTING.md creado con setup, estructura, /LOOP, estandares
- [ ] Templates de Issues (bug, feature, refactor)
- [ ] Pull Request template
- [ ] Code of Conduct

---

## T-3.7: API Reference con TypeDoc

**Track:** C | **Prioridad:** P3 | **Estimacion:** 8h | **Dependencias:** T-3.5

### /LOOP

```
DISENIAR  → Evaluar TypeDoc vs JSDoc vs docs/API-REFERENCE.md existente.
             TypeDoc genera HTML desde JSDoc/comentarios TSDoc.
PLANIFICAR → 1. Agregar TSDoc a todas las clases y metodos (20 niveles)
             2. Configurar TypeDoc 3. Generar HTML 4. Agregar a CI
EJECUTAR  → npm install --save-dev typedoc
             tsconfig.json: agregar "declaration": true, "declarationMap": true
             typedoc.json: configurar entrada (packages/graph/src/*.ts), salida (docs/api/)
             Agregar comentarios TSDoc a metodos clave que aun no tienen:
             - L0: VisualGraphEngine, MermaidRenderer
             - L2: StateMachine, StateMachineRegistry
             - L4: CallGraphBuilder
             - L5: CFGBuilder
             - L6: DataFlowGraph
             - L8-L11: KnowledgeGraphEngine, SemanticGraph, EmbeddingGraph, GraphRAGEngine
             - L12-L19: ya tienen JSDoc basico, expandir
             Script: "docs:api": "typedoc"
VALIDAR   → npx typedoc genera HTML sin errores?
             Todas las clases aparecen documentadas?
TESTEAR   → Abrir docs/api/index.html en navegador
             Verificar que cada nivel tiene su pagina
REFACTOR  ->

 Si hay warnings de documentacion faltante, agregar TSDoc
COMMIT    → git add -A && git commit -m "docs(api): generate API reference with TypeDoc"
```

### Configuracion: `typedoc.json`

```json
{
  "entryPoints": ["packages/graph/src/*.ts"],
  "out": "docs/api",
  "includeVersion": true,
  "excludePrivate": true,
  "excludeProtected": true,
  "theme": "default",
  "name": "COS Graph Engine API",
  "readme": "none",
  "sort": ["source-order"]
}
```

### Script en package.json

```json
"docs:api": "typedoc",
"docs:serve": "npx serve docs/api"
```

### Definition of Done

- [ ] TypeDoc configurado y genera HTML
- [ ] Comentarios TSDoc en todos los metodos publicos
- [ ] `npm run docs:api` genera docs/api/
- [ ] CI opcional: upload docs/api/ como artifact

---

## T-3.8: Validacion de grafos L4-L11 ✅ COMPLETADO

**Track:** D | **Prioridad:** P2 | **Estimacion:** 3h

Validacion de IDs duplicados y edges colgantes en L4, L5, L6, L8, L9, L10, L11.

---

## Cronograma Semanal

### Semana 1: Arranque en Paralelo

```
Lunes     │ T-3.2 (inicio)  │ T-3.4 (inicio)  │ T-3.5 (inicio)
          │ benchmark-report│ c8 coverage      │ README
          │ 3h              │ 3h               │ 2h
          │                 │                  │
Martes    │ T-3.2 (fin)     │ T-3.4 (fin)      │ T-3.5 (fin)
          │ T-3.3 (inicio)  │                  │ T-3.6 (inicio)
          │ auto-release    │                  │ CONTRIBUTING.md
          │ 4h              │                  │ 3h
          │                 │                  │
Miercoles │ T-3.3 (fin)     │                  │ T-3.6 (fin)
          │                 │                  │ T-3.7 (inicio)
          │                 │                  │ TypeDoc API ref
          │                 │                  │ 8h
          │                 │                  │
Jueves    │                 │                  │ T-3.7 (continuacion)
          │                 │                  │
Viernes   │                 │                  │ T-3.7 (fin)
```

### Total Semana 1: ~23h efectivas

- Track A: T-3.2 (3h) + T-3.3 (4h) = 7h
- Track B: T-3.4 (3h) = 3h
- Track C: T-3.5 (2h) + T-3.6 (3h) + T-3.7 (8h) = 13h

**3 tracks en paralelo → ~1 semana calendario**

---

## Dependencias Entre Tickets

```
T-3.1 ──┬── T-3.2 ── T-3.3
         ├── T-3.4
         └── T-3.5 ──┬── T-3.6 ── T-3.7
T-3.8 (independiente)
```

**Paralelizacion maxima:** T-3.2, T-3.4, T-3.5 pueden comenzar simultaneamente.

---

## Definition of Done Global (Fase 3)

- [ ] 450+ tests, 0 failures
- [ ] `npm run benchmark:report` genera HTML con graficos
- [ ] CI ejecuta tests y coverage
- [ ] Auto-release en push a main
- [ ] README.md completo con ejemplos y roadmap
- [ ] CONTRIBUTING.md con guia de contribucion
- [ ] API Reference generada con TypeDoc
- [ ] Validacion L4-L11 en produccion
- [ ] Cobertura minima: 70% branches, 75% lines
# Contributing — COS Graph Engine

> Guia para contribuir al proyecto. Sigue el /LOOP framework en cada ticket.

---

## Setup Local

```bash
git clone https://github.com/cos/graph-engine.git
cd cos
npm install
```

**Requisitos:** Node 18.20.4, npm 10+

---

## Estructura del Proyecto

```
cos/
├── packages/graph/src/     # 20 niveles (level0-visual.ts ... level19-molecular.ts)
├── scripts/                # Tests, benchmarks, tooling
│   ├── test-level*.ts      # Suites de test
│   ├── benchmark-perf.ts   # Benchmarks
│   ├── generate-benchmark-report.ts  # HTML report
│   └── loop.ts             # /LOOP framework
├── docs/                   # Documentacion
│   ├── API-REFERENCE.md    # Referencia de API
│   ├── 20-USECASES.md      # Casos de uso
│   ├── ROADMAP-COMPLETO.md # Roadmap
│   └── PLAN-REFACTOR-20-FASES.md  # Plan de refactor
├── .github/workflows/      # CI/CD
├── KANBAN.html             # Tablero Kanban
└── package.json
```

---

## El Ciclo /LOOP

Cada ticket sigue exactamente 7 pasos:

```
1. DISENIAR   → Entender el problema, leer el codigo existente
2. PLANIFICAR → Descomponer en pasos concretos
3. EJECUTAR   → Escribir el codigo
4. VALIDAR    → Verificar que el codigo es correcto
5. TESTEAR    → npm run test:all → 390+ tests, 0 failures
6. REFACTORIZAR → Mejorar sin romper tests
7. DEBUGGEAR  → Si tests fallan, arreglar antes de avanzar
```

**Regla de oro:** Si tests fallan → DEBUGGEAR. No avanzar al siguiente ticket.

---

## Estandares de Codigo

### TypeScript

- Tipos explicitos en todas las funciones publicas
- `EntityId` como tipo base para IDs de grafos
- JSDoc en todas las clases y metodos publicos
- Sin `any` — usar `unknown` y type guards

### Arquitectura

Cada nivel debe seguir el patron comun:

```typescript
class XxxGraphEngine {
  // Mutation API
  addNode(data): EntityId
  removeNode(id): void
  addEdge(source, target, ...): EntityId
  getNode(id): Node | undefined

  // Serializacion
  toJSON(): object
  static fromJSON(data): XxxGraphEngine

  // Performance
  private adj: Map<EntityId, EntityId[]>

  // Domain
  buildDemo(): void
  validate(): string[]
  metrics(): object
  toMermaid(): string
}
```

### Zero Dependency Rule

**No agregar dependencias externas.** Solo se permiten:
- Stripe (payment gateway)
- SendGrid (email)
- LangChain (agents)
- Algolia (search)

Todo lo demas debe ser implementado in-house.

### Tests

- 40+ tests por nivel
- Cobertura minima: 55% branches, 63% lines
- Usar `describe`/`it` de `node:test`
- Tests de: creacion, mutacion, validacion, serializacion, casos borde

---

## Commits

Usar [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(l5): add dominator computation
fix(l7): correct cross_entropy sumExps
docs(readme): add quickstart examples
refactor(l3): replace edge filtering with adjacency map
test(l1): add 22 mutation tests
chore(ci): add c8 coverage job
```

---

## Pull Requests

1. Crea un branch desde `main`: `git checkout -b feat/my-feature`
2. Sigue el /LOOP en tu ticket
3. `npm run test:all` pasa (390+ tests, 0 failures)
4. `npm run coverage` pasa (cobertura minima)
5. Abre el PR con descripcion del cambio

### PR Template

```markdown
## Que cambia?

[Descripcion del cambio]

## /LOOP

- [ ] DISENIAR
- [ ] PLANIFICAR
- [ ] EJECUTAR
- [ ] VALIDAR
- [ ] TESTEAR (390 tests, 0 failures)
- [ ] REFACTORIZAR
- [ ] DEBUGGEAR

## Tests

- Tests existentes: [N] pasan
- Tests nuevos: [N] agregados
- Cobertura: [N]%
```

---

## Issues

### Bug Report

```markdown
**Descripcion:** [que pasa]
**Esperado:** [que deberia pasar]
**Nivel:** L[N]
**Codigo:** [reproducir minimo]
**Tests:** [el test que falla]
```

### Feature Request

```markdown
**Nivel:** L[N]
**Que:** [nueva funcionalidad]
**Por que:** [caso de uso]
**API propuesta:** [firma de ejemplo]
```

### Refactor

```markdown
**Nivel:** L[N]
**Que mejorar:** [clase/metodo]
**Problema:** [complejidad, duplicacion, performance]
**Solucion propuesta:** [que cambiar]
```

---

## Code of Conduct

- Se respetuoso y constructivo
- Las criticas son sobre el codigo, no sobre la persona
- Pregunta antes de asumir
- Ayuda a otros contribuyentes

---

## Recursos

- [Plan Maestro](PLAN-MAESTRO.md) — Arquitectura completa
- [API Reference](docs/API-REFERENCE.md) — Documentacion de API
- [Roadmap](docs/ROADMAP-COMPLETO.md) — 8 fases para v2.0.0
- [Kanban](KANBAN.html) — Estado visual del proyecto
- [LOOP Maestro](LOOP-MAESTRO.md) — Framework completo del ciclo
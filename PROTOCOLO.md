# PROTOCOLO.md — Protocolo Operativo

## Stack actual
- **Runtime**: Node.js 20+, TypeScript
- **Framework**: React 19 + TanStack Start (SSR)
- **Testing**: Vitest (601 tests total — 578 pass, 23 fail across 30 files)
- **Linting**: ESLint (flat config pending — PR #45 OPEN)
- **CI**: GitHub Actions
- **Database**: SQLite (local) / D1 (Cloudflare)
- **Deployment**: Cloudflare Workers

## Estado actual (2026-07-30)
- **53 tareas planificadas**: ~47 completadas (~89%)
- **PRs pendientes**: #45 (eslint-flat, OPEN), #46 (session-docs, OPEN)
- **Tests**: 578/601 pass (96.2%), 23 failures en 30 test files
- **ESLint**: 90 archivos con errores

## Flujo de trabajo
1. `main` es la rama estable
2. Feature branches se crean desde `main`
3. PRs se revisan y mergean a `main`
4. CI corre tests + lint en cada PR

## Comandos clave
| Comando | Descripción |
|---------|-------------|
| `npx vitest run` | Ejecutar tests |
| `npx eslint src/` | Lint source |
| `git checkout -b feat/<name>` | Nueva feature branch |
| `gh pr create` | Crear PR |

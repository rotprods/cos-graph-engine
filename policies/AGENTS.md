# AGENTS.md — PROTOCOLO MAESTRO DE HARDNESS

## Repositorio Central

**https://github.com/rotprods/higgsfield-hardness**

Este repositorio contiene las reglas, scripts y policies que todos los agentes
del ecosistema Higgsfield deben seguir para garantizar que nunca se pierda
trabajo.

## Regla de Oro

**Cada implementación, commit. Sin excepción.**
El sandbox de Higgsfield es **EFÍMERO** — se borra al cerrar la sesión.
Si no está en GitHub, no existe.

## Arquitectura del Sandbox

```
CHAT (sesión efímera)
  │
  ├── /home/user/proyecto/     ← Se BORRA al cerrar sesión
  │     ├── src/               ← Código fuente
  │     ├── tools/             ← Scripts de recuperación
  │     └── .githooks/         ← Pre-commit hook
  │
  ├── GitHub (permanente)      ← Única fuente de verdad
  │     └── github.com/rotprods/
  │           ├── higgsfield-hardness   ← Reglas centrales
  │           └── proyecto-x            ← Código del proyecto
  │
  └── Higgsfield CDN (deploy)  ← Puede borrarse
        └── solid-aspen-244.higgsfield.gg
```

## Protocolo de 4 Fases

### Fase 0: Setup (cada sesión nueva)
```bash
bash tools/recover.sh [--verbose]
  # 9 pasos automáticos:
  # 0. Verificar 9 dependencias (git, node, npm, make, g++, curl, gh, python3, ffmpeg)
  # 1. Clonar repo desde GitHub
  # 2. npm install
  # 3. Configurar git (identidad, hooks, token)
  # 4. Verificar 20 archivos críticos
  # 5. Compilar C++ mapgen + JSONs
  # 6. npm run build
  # 7. QA (245 checks)
  # 8. Resumen con tiempos
```

### Fase 1: Desarrollo
```bash
git checkout -b feat/nombre
# Cada 15-20 min: commit atómico
git add -A && git commit -m "[TIPO] descripción"
  # Tipos: FEAT, FIX, REFAC, QA, DOC, DEPLOY, HOOK
  # Pre-commit hook verifica: syntax + build + QA
  # Si falla: arreglar, git add, git commit otra vez
```

### Fase 2: PR + Merge
```bash
git push -u origin feat/nombre
gh pr create --title "[TIPO] descripción"
  # GitHub Actions: 5 checks obligatorios
  # Branch protection: NO push directo a main
  # Merge solo si todos los checks pasan
gh pr merge --squash
```

### Fase 3: Deploy
```bash
git checkout main && git pull
npm run build
node tools/qa-100percent.mjs --quick
deploy_game(game_id="...", client="dist/index.html", assets_dir="dist")
```

## Tests Disponibles

| Test | Archivo | Checks | Propósito |
|------|---------|--------|-----------|
| E2E | `tools/e2e-test.mjs` | 186 | Functional test completo |
| Assembly | `tools/test-assembly.mjs` | 65 | Unit tests de Assembly |
| CoverTactics | `tools/test-cover-tactics.mjs` | 61 | 100% branch coverage |
| Recovery | `tools/test-recover.sh` | 11 | Tests del recovery script |
| Resiliencia | `tools/test-resilience.sh` | 8 | Simulación de desastres |
| QA 100% | `tools/qa-100percent.mjs` | 245 | Cobertura total del proyecto |

## CI/CD Centralizado

Workflow en `higgsfield-hardness/.github/workflows/hooks-monitor.yml`:
- **Schedule:** Diario 06:00 UTC
- **14 repos** monitoreados en paralelo
- **4 canales de notificación:** GitHub Issue, Email, Slack, Webhook
- **Captura de errores:** nombre del repo + output del hook

## Historial de Pérdidas

| Commit | Incidente | Lección |
|--------|-----------|---------|
| a9423ae | Import corruption: expresión en import | No poner lógica en imports |
| 4c04dcb | 355 líneas borradas en rewrite | Nunca reescribir archivos enteros (usar patch) |
| dd653c2 | BOOT FAILURE: model.id undefined | Verificar constructor properties |

**0 archivos perdidos permanentemente.** 52 commits, 287 archivos creados, 1 eliminado.

## Reglas de Oro

1. **Commit cada 15-20 min** — atómico, no esperar a que la feature esté completa
2. **Push inmediato** después de cada commit
3. **`git pull`** antes de empezar a trabajar
4. **Nunca reescribir archivos completos** — usar `patch`
5. **Verificar constructor** inicializa todas las propiedades
6. **No poner expresiones en imports**
7. **Pre-commit hook es obligatorio** — no saltarlo con `--no-verify`
8. **Ejecutar `bash tools/recover.sh`** al empezar cada sesión
9. **Ejecutar `node tools/e2e-test.mjs`** antes de cada deploy
10. **Si el sandbox se borra: panic no, `git clone` sí**
# AGENTS.md — COMMIT DISCIPLINE STRICT

## Regla de Oro

**Cada implementación, commit. Sin excepción.**

El workspace de Higgsfield es **EPHEMERAL** — se borra entre sesiones.
Si no está en GitHub, no existe.

---

## Orden Estricto (por fase)

### Fase 1: Antes de empezar a codificar
```
1. git status                    # Verificar que no hay cambios sueltos
2. git pull                      # Traer último estado del remoto
3. Leer AGENTS.md                # Recordar las reglas
```

### Fase 2: Durante la implementación
```
4. Cada 15-20 minutos de trabajo → git add -A && git commit -m "mensaje"
   No esperar a que la feature esté completa.
   Commits atómicos: un cambio lógico por commit.
```

### Fase 3: Al terminar una feature
```
5. npm run build                 # Verificar que compila
6. node tools/qa-100percent.mjs  # Verificar que no se rompió nada
7. git add -A                    # Todo lo nuevo
8. git commit -m "descriptivo"   # Mensaje en español o inglés, claro
9. git push                      # SUBIR AL REMOTO
10. deploy_game()                # Solo después de pushear
```

### Fase 4: Al final de la sesión
```
11. git status                   # Working tree MUST be clean
12. git log --oneline -3         # Verificar últimos commits
13. git push                     # Doble verificación
```

---

## Formatos de Mensajes de Commit

```
[TIPO] Descripción corta (máx 72 chars)

Tipos:
  [FEAT]  — Nueva funcionalidad
  [FIX]   — Bug fix
  [REFAC] — Refactor sin cambio funcional
  [QA]    — Tests, tooling
  [DOC]   — Documentación
  [DEPLOY]— Deploy a Higgsfield Games
  [HOOK]  — Infraestructura, scripts, hooks, recover

Ejemplos:
  [FEAT] Team Deathmatch mode with BLUE/RED teams
  [FIX] Assembly.id missing causing BOOT FAILURE
  [QA] Regression tests for viewmodel.addWeapon bug
  [DEPLOY] Deploy v1.0.3 to Higgsfield Games
  [HOOK] Pre-commit verification hook + recovery script
```

---

## ¿Qué Pasa si el Repo de Higgsfield se Auto-Borra?

El workspace de Higgsfield **se borra al cerrar la sesión**. Pero:

| Recurso | Persistencia | Confiable |
|---------|-------------|-----------|
| **GitHub** (`rotprods/spain-cityscapes-fps`) | Permanente | ✅ Fuente de verdad |
| **Higgsfield deploy** (`solid-aspen-244.higgsfield.gg`) | Indefinida (no hay TTL documentado) | ⚠️ Puede desaparecer |
| **Local workspace** (`/home/user/spain-repo`) | Se borra al cerrar sesión | ❌ No confiar |

**Conclusión:** GitHub es la única fuente de verdad. Si Higgsfield elimina el deploy, se redepliega desde GitHub con `deploy_game()`.

---

## Checklist de Supervivencia

- [ ] `git push` ejecutado después de CADA implementación
- [ ] `git status` muestra `nothing to commit, working tree clean`
- [ ] `git log --oneline origin/main` muestra el último commit en el remoto
- [ ] El deploy en Higgsfield está actualizado con el último commit
- [ ] El game_id (`4bce41a8-ffde-45eb-a585-c5a5c323dd7c`) está documentado

---

## Pre-Commit Hook (Automático)

El hook en `.githooks/pre-commit` se ejecuta AUTOMÁTICAMENTE antes de cada `git commit`.

**Qué verifica:**
1. **Syntax check** — cada archivo `.js` staged se valida con `node --check`
2. **Build** — `npm run build` debe pasar
3. **QA** — `node tools/qa-100percent.mjs --quick` debe dar 0 fallos

**Si el hook falla:**
```bash
# El commit se CANCELA. Arregla el error, haz git add otra vez, y recommitea.
git add -A
git commit -m "[FIX] ..."
```

**Para saltar el hook (solo emergencia):**
```bash
git commit --no-verify -m "[FIX] ..."
```

---

## Script de Recuperación

`tools/recover.sh` — recupera todo el proyecto desde cero:

```bash
bash tools/recover.sh
```

**Qué hace (8 pasos):**
1. Clona el repo desde GitHub
2. Instala `npm install`
3. Verifica 16 archivos críticos (syntax check)
4. Compila el C++ mapgen
5. Genera los JSONs de mapas C++
6. `npm run build`
7. Ejecuta QA
8. Muestra instrucciones para deploy

---

## Si el Workspace se Borra (recuperación)

```bash
git clone https://github.com/rotprods/spain-cityscapes-fps.git
cd spain-cityscapes-fps
npm install
npm run build
deploy_game(game_id="4bce41a8-ffde-45eb-a585-c5a5c323dd7c", ...)
```

---

## Estado Real del Render Pipeline

⚠️ **CORRECCIÓN:** El juego NO es un graybox. Ya tiene un pipeline AAA completo:

| Feature | Archivo | Líneas | Estado |
|---------|---------|--------|--------|
| **PBR Shading** (MeshStandardMaterial + ORM) | `src/materials/` | 4,432 | ✅ |
| **Bloom** (Karis pyramid) | `src/render/bloom.js` | ~200 | ✅ |
| **GTAO** (SSAO equivalente) | `src/render/gtao.js` | ~300 | ✅ |
| **CSM** (Cascaded Shadow Maps) | `src/render/csm.js` | ~400 | ✅ |
| **TAA** (Temporal Anti-Aliasing) | `src/render/taa.js` | ~300 | ✅ |
| **SSR** (Screen Space Reflections) | `src/render/ssr.js` | ~300 | ✅ |
| **Motion Blur** | `src/render/motionblur.js` | ~200 | ✅ |
| **Depth of Field** (ADS only) | `src/render/dof.js` | ~200 | ✅ |
| **Auto Exposure** (GPU metering) | `src/render/exposure.js` | ~200 | ✅ |
| **Color Grading** (AgX + LUT) | `src/render/lut.js`, `composite.js` | ~400 | ✅ |
| **Volumetrics** | `src/render/` | ~200 | ✅ |
| **Contact Shadows** | `src/render/contact.js` | ~200 | ✅ |
| **Total render pipeline** | `src/render/` (18 archivos) | 5,827 | ✅ |

**Presets de calidad:** low → medium → high → ultra (config.js)
**Por defecto:** ultra (4096 CSM, TAA, GTAO, SSR, bloom, motion blur, volumétricas TODO activado).

---

## CI/CD Pipeline (GitHub Actions)

El repo tiene 3 workflows automáticos:

### 1. Build & Test (.github/workflows/build.yml)
En cada push a main y cada PR: build-js, build-cpp, lint, test-qa, test-cpp.

### 2. AI Code Review (.github/workflows/review.yml)
En cada PR a main: syntax check, build, QA, AGENTS.md compliance, PR comment.

### 3. Publish (.github/workflows/publish.yml)
En push a main o manual: build, QA, verify artifacts, upload dist, deploy instructions.

**Deploy manual:**
```bash
deploy_game(game_id="4bce41a8-ffde-45eb-a585-c5a5c323dd7c", client="dist/index.html", assets_dir="dist")
```

---

## ¿Dónde está el código?

| Destino | Qué se sube | Persistencia |
|---------|------------|--------------|
| **GitHub** (`rotprods/spain-cityscapes-fps`) | Código fuente completo | ✅ Permanente |
| **Higgsfield Games** | `dist/` (build) | ⚠️ Puede borrarse |
| **Sandbox** (`/home/user/spain-repo`) | Workspace temporal | ❌ Se borra al cerrar sesión |

**No se sube a dos repos.** El código fuente solo está en GitHub.
El deploy a Higgsfield Games es el BUILD (dist/), no el código fuente.

## ¿Se ha perdido trabajo históricamente?

**Sí, 3 incidentes documentados en git:**

1. **Commit `a9423ae`** — Corrupción de import en `dressing.js`:
   `import { STREET, (_layout?.ALLEYS\|\|ALLEYS), ... }` — JS inválido.
   Fix: 1 línea.

2. **Commit `4c04dcb`** — 355 líneas eliminadas de `world/index.js` y `main.js`:
   Se reescribieron archivos completos perdiendo comentarios de arquitectura.
   El código funcional sobrevivió, la documentación inline se perdió para siempre.

3. **Commit `dd653c2`** — BOOT FAILURE: `Assembly.id` era `undefined`.
   `viewmodel.addWeapon()` usaba `model.id` que no existía.
   Fix: `this.id = name` en el constructor. 1 línea.

**Además:** El workspace se ha borrado múltiples veces entre sesiones.
Siempre recuperado desde GitHub via `git clone`.

**0 archivos perdidos permanentemente.** Todo el código funcional está en git.
Lo único irrecuperable son comentarios de documentación inline eliminados en rewrites.

## Branch Protection (main)

La rama `main` está protegida vía GitHub API:

| Regla | Valor |
|-------|-------|
| **Required status checks** | Build JS, Build C++, AI Code Review, QA, Test C++ |
| **Strict** | Sí — debe estar actualizada con la rama base |
| **Enforce admins** | Sí |
| **Force pushes** | Bloqueados |
| **Deletions** | Bloqueadas |
| **Dismiss stale reviews** | Sí |

### Flujo de trabajo

```
1. Crear feature branch: git checkout -b feat/nombre
2. Implementar + commitear
3. Hacer PR a main → GitHub Actions ejecuta build + review + QA
4. Merge solo si todos los checks pasan
5. Push a main → CI/CD build + deploy automático
```
# Skills importadas de otros agentes

Inventario traído a este repo el 2026-09-22 para que los Cloud Agents de `cos-graph-engine` las carguen desde `.cursor/skills/<nombre>/SKILL.md`.

Cada skill conserva el texto del repositorio de origen. `source_repo` y `source_path` en el frontmatter apuntan al original.

## Clever-Agent (`rotprods/Clever-Agent`)

| Skill | Origen |
|---|---|
| `empezarproyecto` | `.claude/skills/empezarproyecto/SKILL.md` + protocolo `commands/EMPEZARPROYECTO.md` |
| `context` | `commands/CONTEXT.md` |
| `graphify` | `commands/GRAPHIFY.md` |
| `cos-graph-engine-v2` | `commands/COS-GRAPH-ENGINE-V2.md` |

El README de comandos nombra también `/wave`, `/checkpoint`, `/gauntlet`, `/reconcile`, `/handoff` y `/closewave`. Esos protocolos no tienen archivo propio en el repo; viven en `AGENTS.md` y `PROTOCOLS.md` de Clever-Agent, así que no se copiaron como skill.

## macOS Sentinel Arsenal (`rotprods/macos-sentinel-arsenal`)

| Skill | Origen |
|---|---|
| `macforensics` | `advanced/skills/macforensics/SKILL.md` |
| `macaudit` | `advanced/skills/macosaudit/SKILL.md` |
| `merge-train-safe` | `advanced/skills/merge-train-safe/SKILL.md` |

Referenciadas y no publicadas como `SKILL.md`: `threethunter`, `auditlake`, `trap-branch-detector`, `ci-verify`, `goal`, `fabrica-ingest`, `actadeconsciencia`.

## Carruseles (`rotprods/viral-carrousels-`)

| Skill | Origen |
|---|---|
| `visual-brand-system` | `skills/visual-brand-system/SKILL.md` |

## Social Growth Engine (`rotprods/linkedin-x-automator`)

| Skill | Origen |
|---|---|
| `avatar-talking-head-shorts` | `skills/avatar-talking-head-shorts.md` |
| `higgsfield-avatar-video` | `skills/higgsfield-avatar-video.md` |
| `linkedin-post-quality-checklist` | `skills/linkedin-post-quality-checklist.md` |
| `linkedin-prepublish-qa` | `skills/linkedin-prepublish-qa.md` |
| `native-spanish-short-production` | `skills/native-spanish-short-production.md` |
| `sge-publish-one-post` | `skills/sge-publish-one-post.md` |
| `shorts-production-qa` | `skills/shorts-production-qa.md` |
| `social-growth-engine` | `skills/social-growth-engine.md` |
| `social-growth-engine-cycle` | `skills/social-growth-engine-cycle.md` |
| `social-short-pipeline` | `skills/social-short-pipeline.md` |

## Lo que no está en GitHub

Este entorno solo ve los Cloud Agents del environment de `cos-graph-engine` (2 runs). No hay acceso a skills locales de Cursor en tu Mac (`~/.cursor/skills`) ni a repos privados. Si falta alguna skill, está en la máquina local o en un repo privado.

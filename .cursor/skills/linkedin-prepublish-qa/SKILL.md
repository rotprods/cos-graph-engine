---
name: linkedin-prepublish-qa
description: Final gate before publishing a LinkedIn post: completeness, media, format, typos, language, and kill-switch. Use immediately before publish.
source_repo: rotprods/linkedin-x-automator
source_path: skills/linkedin-prepublish-qa.md
---

# Skill: linkedin-prepublish-qa

QA final antes de publicar cualquier post en LinkedIn.

## Cuándo se aplica
Obligatorio justo antes de la publicación (tras el quality-checklist).

## Verificaciones finales
1. **Contenido completo** — el post no está truncado ni a medias.
2. **Media obligatoria** — tiene su imagen/video 16:9 adjunto.
3. **Formato correcto** — cumple los estándares v4 (párrafos, pregunta, enlace al final).
4. **Sin errores** — sin typos, sin URL rota, sin placeholders sin rellenar.
5. **Idioma y tono** — `{IDIOMA_LI}`, tono `{TONO}`.
6. **Kill-switch** — respeta `auto_publish` (si false, solo encola).

## Gate
- Si cualquier verificación falla → **BLOQUEAR publicación** y reportar qué falta.
- Solo publica si todas pasan.

> Personalízalo con tu perfil y estándares de LinkedIn.

---
name: linkedin-post-quality-checklist
description: Score a LinkedIn post before it is shown to the user: hook, narrative, clarity, closing question, format, and CTA. Use on every LinkedIn draft.
source_repo: rotprods/linkedin-x-automator
source_path: skills/linkedin-post-quality-checklist.md
---

# Skill: linkedin-post-quality-checklist

Gate de calidad para cada post de LinkedIn producido por el motor.

## Cuándo se aplica
Obligatorio en todo post de LinkedIn antes de presentarlo al usuario.

## Qué evalúa (score 0-10 por sección)
1. **Hook / apertura** — primeras 2 líneas que enganchan (0-10).
2. **Narrativa** — historia o dato concreto, no relleno (0-10).
3. **Claridad** — una idea clara, sin ambigüedad (0-10).
4. **Pregunta final** — cierra con una pregunta que invita al debate (0-10).
5. **Formato** — párrafos cortos, negritas, estructura legible (0-10).
6. **Enlace/CTA** — enlace al final del body, imagen 16:9, sin AI-slop (0-10).

## Umbral de aprobación
- Score medio ≥ 7.5 → aprobar.
- Score medio < 7.5 → reescribir antes de presentar.

## Cómo trabajar
- Idioma: `{IDIOMA_LI}` · Tono: `{TONO}` · Máx `{MAX_CHARS_LI}` caracteres.
- Aplica la matriz de severidad: fallos de hook o claridad son bloqueantes.

> Personalízalo con tu tono, sectores y estándares de calidad.

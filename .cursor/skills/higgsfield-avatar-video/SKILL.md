---
name: higgsfield-avatar-video
description: Generate longer avatar talking-head videos with lip-sync on Higgsfield from canonical photos plus cloned voice. Use for YouTube or Shorts talking-head pieces.
source_repo: rotprods/linkedin-x-automator
source_path: skills/higgsfield-avatar-video.md
---

# Skill: higgsfield-avatar-video

Pipeline para generar videos largos del avatar (talking-head) con lip-sync en Higgsfield, desde fotos del avatar + voz clonada.

## Cuándo se aplica
Al crear un video de YouTube/Shorts con tu avatar hablando (talking-head con lip-sync).

## Flujo
1. **Fotos canónicas** del avatar (referencia de identidad).
2. **Voz clonada** (`{VOICE_ID}`) — el audio que dirá.
3. **Clips talking-head** — image-to-video con lip-sync, clip a clip (los modelos de video hacen ~4-15s máx).
4. **Montaje** — encadenar clips (cortes secos) + B-roll + subtítulos.
5. **QA** — identidad, labios, audio, formato.

## Nota de coste
- Video talking-head: `{CREDITOS_CLIP}/clip` (modelo barato, sin sonido) + voz + montaje.
- Los videos largos se montan encadenando clips; un solo clip no supera ~15s.

## Regla de coste
- Cotiza al usuario el coste total ANTES de generar (regla #1).

> Personalízalo con tu avatar, voz y presupuesto.

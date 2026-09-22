---
name: shorts-production-qa
description: Produce vertical 9:16 shorts with audio, on-screen hook, burned subtitles, and QA gates before publish.
source_repo: rotprods/linkedin-x-automator
source_path: skills/shorts-production-qa.md
---

# Skill: shorts-production-qa

Produce shorts verticales (9:16) de calidad con audio, título-hook en pantalla y subtítulos quemados, con gates de QA antes de publicar.

## Cuándo se aplica
Al producir cualquier short para YouTube/TikTok/X/LinkedIn.

## Flujo
1. **Fuente** — clip largo o material del canal (recortes coherentes, no trozos arbitrarios).
2. **Formato** — 9:16 vertical, ~20-25s (o duración del bloque).
3. **Audio** — voz en off o música; volumen equilibrado (sin clipping).
4. **Título-hook en pantalla** — texto grande y legible, dentro del frame (sin cortarse).
5. **Subtítulos** — quemados, sincronizados por STT, zona segura inferior.
6. **QA** — ver cada clip antes de dar por bueno.

## Gates de QA (no se brincan)
1. **G1 Visual** — identidad del avatar/persona consistente, sin morfing.
2. **G2 Audio** — voz clara, sin saturación, idioma correcto.
3. **G3 Subtítulos** — sincronizados, sin palabras perdidas.
4. **G4 Formato** — 9:16, duración correcta, audio llega al final.
5. **G5 Limpieza** — título no cortado, sin artefactos.

## Modelos permitidos (baratos)
- Avatar: `heygen_avatar` / `soul_id` · Voz: `voiceover`/`change_voice` · Imágenes: `soul_cast`/`nano_banana_2` · Ensamblaje: montaje/ffmpeg.
- Coste máx por short: `{MAX_CREDITOS_SHORT}` créditos.

> Personalízalo con tu cuenta, estilo y límite de coste.

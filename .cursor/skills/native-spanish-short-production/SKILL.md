---
name: native-spanish-short-production
description: Produce a Short or Reel with native Spanish narration using a cloned voice or ElevenLabs. Use when the voice must sound native.
source_repo: rotprods/linkedin-x-automator
source_path: skills/native-spanish-short-production.md
---

# Skill: native-spanish-short-production

Produce un Short/Reel con **narración en español nativo** usando tu voz clonada (o ElevenLabs).

## Cuándo se aplica
Al producir cualquier video del canal (faceless o con presentador) donde la voz deba sonar nativa en español.

## Flujo
1. **Idea/hook** — del trend-scout o del guion.
2. **Guion corto** — hooks, ritmo, CTA.
3. **Voz en off** — usa tu voz clonada (`{VOICE_ID}`) o TTS ElevenLabs; **español nativo, nunca guiri**.
4. **Vídeo** — 9:16 vertical con avatar o material.
5. **Subtítulos + QA** — quemados, sincronizados.
6. **Publicar o encolar.**

## Reglas de idioma
- Español nativo de España/canal, sin acento extranjero.
- Verificar la calidad de la voz antes de publicar (escuchar muestra).

## Motor de voz
- Clon local del dueño (`{VOICE_ID}`) o `text2speech_v2` con engine `{ENGINE}` (ElevenLabs/MiniMax/Seed Speech).

> Personalízalo con tu voz, estilo y formato.

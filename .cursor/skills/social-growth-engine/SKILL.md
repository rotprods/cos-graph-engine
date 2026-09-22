---
name: social-growth-engine
description: Operate the Social Growth Engine: research, score, write, publish, measure, and learn on X and LinkedIn.
source_repo: rotprods/linkedin-x-automator
source_path: skills/social-growth-engine.md
---

# Skill: social-growth-engine

Runbook del Social Growth Engine: investigar, elegir, escribir, publicar, medir y aprender en X y LinkedIn.

## Responsabilidades
- Investigar señales frescas cada ciclo (web search + timeline/menciones del conector X).
- Puntuar señales por potencial viral (0-100) y elegir las 2-3 top.
- Generar copy por plataforma:
  - **X** (`{idioma_X}`): ≤280 caracteres, sin URL en el body (la fuente en el primer reply).
  - **LinkedIn** (`{idioma_LI}`): narrativo, con pregunta final, enlace al final del body.
- Generar una imagen 16:9 por post (modelo: `nano_banana_pro`).
- Publicar respetando el kill-switch (`auto_publish`) y los best-hours.
- Medir impresiones/likes/replies tras publicar y volcarlas a la BD.
- Aprender: re-ponderar temas según el engagement real (learning loop).

## Reglas de calidad (QA obligatorio)
- Imagen 16:9 por post, sin AI-slop, fuente real, dedupe a 7 días.
- X: copy ≤280 caracteres, URL en el primer reply.
- LinkedIn: narrativo, pregunta final, enlace al final.

## Configuración
- `config/platforms.yaml`, `config/cadence.yaml`, `config/topics.yaml`, `state/queue.json`.
- Git es la verdad: clona tu repo y commitea todo.

> Personalízalo: plataformas, idiomas, horarios, temas, tono y objetivo con los tuyos.

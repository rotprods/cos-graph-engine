---
name: social-growth-engine-cycle
description: Run one Social Growth Engine research cycle and the hourly publish tick.
source_repo: rotprods/linkedin-x-automator
source_path: skills/social-growth-engine-cycle.md
---

# Skill: social-growth-engine-cycle

Ejecuta un ciclo completo del motor y el tick horario que publica la cola.

## Flujo del ciclo (research)
1. Web search + conectores X → señales (3-6 reales con URL y fuente).
2. Puntuar 0-100 y elegir las 2-3 top.
3. Generar copy X/LinkedIn + imagen 16:9.
4. Encolar en `state/queue.json`.

## Tick horario (publish)
- Tomar el post de mayor prioridad de la cola.
- Validar best-hours (no publicar fuera de la ventana).
- Publicar vía conector OAuth y registrar `external_id`.
- Commit + push; avisar por Slack/Telegram.

## Reglas
- Git es la verdad: clona tu repo y commitea.
- Respeta el kill-switch y la configuración.

> Personalízalo: cadencia, horarios y plataformas.

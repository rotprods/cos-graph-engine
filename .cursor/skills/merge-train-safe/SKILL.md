---
name: merge-train-safe
description: >
  Merge train seguro: verifica billing GH Actions, detecta trap branches,
  establece el orden seguro de merge, verifica CI de cada PR antes de
  mergear, y ejecuta el merge secuencial con halt automatizado ante CI rojo
  o billing agotado. Encadena trap-branch-detector, ci-verify x N y merge
  secuencial con gate G-ROBERTO obligatorio antes de arrancar el tren.
  Activa con /merge-train-safe, "mergea los PRs en orden seguro", "lanza el
  merge train", "merge the PRs safely", "safe merge train", "mergea sin
  romper nada", o antes de cualquier lote de 3 o mas PRs en el monorepo.
metadata:
  type: skill
  status: active
  createdAt: 2026-06-19
  emitted_by: enjambre-w2-2
  related: [trap-branch-detector, ci-verify, goal, fabrica-ingest, actadeconsciencia]
  blast_radius: high
  gate_required: true
source_repo: rotprods/macos-sentinel-arsenal
source_path: advanced/skills/merge-train-safe/SKILL.md

---

# /merge-train-safe — merge train con deteccion de traps y gate de billing

> Bridge P0. El merge train sin trap detection ya causo scope leaks documentados.
> Cadena completa operativa: trap-branch-detector (v1.1) + billing-check + ci-verify.
> El gate G-ROBERTO es obligatorio antes del bucle de merge.

## Cuando activarse

- `/merge-train-safe` — activa sobre el repo en cwd.
- "mergea los PRs en orden seguro" / "lanza el merge train".
- "merge the PRs safely" / "safe merge train".
- Antes de mergear lote de 3+ PRs en un monorepo.
- Cuando `goal` ha completado su fase BUILD y tiene PRs pendientes de validar.
- Cuando `fabrica-ingest` emite tasks con `MERGE_READY` status.

## Cuándo NO activarse

- Solo hay 1-2 PRs aislados: el overhead de `trap-branch-detector` no vale la pena. Usa `ci-verify` + `gh pr merge` directo.
- Billing GH Actions no esta activo: el tren fallara en el primer CI check. Resolver billing primero (gate 👑).
- Hay una sesion Claude activa editando el mismo worktree: riesgo de colision.

---

## Protocolo (5 pasos)

### Paso 1 — BILLING CHECK

**Antes de cualquier otra cosa**, verifica billing GH Actions.
Si falla o devuelve 0 minutos disponibles: **HALT. Reportar a Roberto** 👑.

```bash
gh api /repos/<owner>/<repo>/actions/cache/usage 2>&1 | head -5
```

Lecciones aplicadas:
- CI rojo en 1-10s = billing, no codigo.
- 10+ checks failing en 1-3s simultaneo = billing agotado.

> 👑 GATE BILLING: si el check falla o indica 0 minutos, HALT completo. Informar
> a Roberto con el output exacto del comando. No continuar hasta OK explicito.

### Paso 2 — DETECT TRAPS

Invoca `trap-branch-detector` en modo lectura sobre el repo.

Invoca `/trap-branch-detector` (protocolo v1.1, READ-ONLY): inventaria branches
activas, detecta scope leak y colisiones en archivos criticos, calcula age_days y
risk score, y emite la tabla de recomendaciones (MERGE / EXCLUIR / SELLAR+BORRAR).
No borra nada — su output es propuesta, no autorizacion.

Resultado esperado: lista de PRs clasificados. PRs con score >=50 se excluyen del
tren. PRs OK forman la base para el paso 3. Si corrio hace <30 min sobre el mismo
HEAD, reusa su output (seria identico).

### Paso 3 — ORDER

Del output de `trap-branch-detector` (o del analisis manual del paso 2), extrae el
orden seguro de merge como lista ordenada de `PR#`.

Si hay pares con conflicto orden-dependiente, propone el orden y espera confirmacion
de Roberto antes de continuar.

Imprime la tabla del tren propuesto:

| Posicion | PR# | Titulo | Base | Trap score | Accion |
|---|---|---|---|---|---|
| 1 | #NNN | ... | main | 0 | MERGE |
| ... | | | | | |
| X | #NNN | ... | main | 55 | EXCLUIR |

> 👑 GATE ORDEN: muestra la tabla completa del tren + numero de PRs. Roberto
> confirma con frase exacta ("confirmo el tren") antes de arrancar el bucle.
> Este gate es obligatorio independientemente de --auto.

### Paso 4 — VERIFY + MERGE LOOP

Para cada PR en el orden seguro (DESPUES del gate del paso 3):

```bash
for PR in $MERGE_ORDER; do
  ci-verify $PR
  EXIT=$?
  if [ $EXIT -eq 0 ]; then
    gh pr merge $PR --squash --delete-branch
  elif [ $EXIT -eq 3 ]; then
    echo "Billing suspended. HALT merge train en PR $PR."
    echo "Reportar a Roberto 👑. PRs posteriores NO tocados."
    break
  else
    echo "CI rojo real en PR $PR. HALT."
    echo "PRs posteriores NO mergeados. Diagnosticar antes de continuar."
    break
  fi
done
```

Comportamiento ante cada exit code de `ci-verify`:
- Exit 0: CI verde, merge y continua.
- Exit 2: CI rojo real. HALT. No continuar el tren. PRs no mergeados quedan intactos.
- Exit 3: Billing agotado. HALT. Reportar a Roberto 👑.

### Paso 5 — REPORT + SEAL

Al terminar (exito o fallo parcial), invoca `actadeconsciencia` con el estado del tren:

- PRs mergeados: lista con SHA de cada merge commit.
- PRs pendientes: razon de fallo (CI rojo / billing / excluido por trap).

Si hay PRs pendientes por CI rojo o billing, invocar `fabrica-ingest` con esos PRs
como tasks bloqueadas para que queden en el backlog.

---

## Anti-patrones

| Patron a evitar | Por que falla | Alternativa |
|---|---|---|
| Omitir billing check | 10 PRs que fallan en 1-3s simultaneo = billing agotado, no codigo roto. Sin el check el diagnostico es incorrecto y se pierde tiempo. | Paso 1 siempre primero, sin excepcion. |
| Mergear trap branches | Un branch con score >=50 puede revertir trabajo de otra rama. La deteccion no es opcional aunque sea manual. | Excluir del tren y abrir issue separado. |
| Continuar el tren ante CI rojo real | Cada PR mergea sobre el anterior. Un rojo real propaga deuda estructural hacia abajo del tren. | HALT en el PR rojo, diagnosticar, volver a lanzar el tren parcial desde ese punto. |
| Usar para <3 PRs | El overhead de deteccion de traps no vale la pena. | `ci-verify` + `gh pr merge` directos. |
| No confirmar el orden con Roberto | El orden puede tener implicaciones de producto (que feature llega primero a main). Gate obligatorio. | Paso 3 espera confirmacion siempre. |
| Tratar el output de trap-branch-detector como autorizacion para borrar | El detector es READ-ONLY y emite recomendaciones; borrar branches es protocolo de 2 pasos con confirmacion de Roberto. | Sellar primero, Roberto ejecuta el borrado explicito. |

---

## Relacion con otras skills

- [[trap-branch-detector]] — detecta branches peligrosas y establece el orden seguro (paso 2). Operativo (v1.1, 2026-06-19).
- [[ci-verify]] — verifica CI de cada PR antes de mergear (paso 4). Dependencia directa operativa.
- [[goal]] — el contexto habitual desde el que se invoca este bridge (fase BUILD completada con PRs listos).
- [[fabrica-ingest]] — recibe los PRs bloqueados como tasks para el backlog (paso 5).
- [[actadeconsciencia]] — sella el resultado del tren como acta de conciencia (paso 5).

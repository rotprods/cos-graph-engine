---
name: macaudit
description: >
  Ejecuta una auditoría de postura de seguridad en macOS usando el macOS Sentinel Arsenal.
  Revisa FileVault, firewall, Gatekeeper, SIP, SSH remote login, usuarios admin, puertos wildcard,
  permisos de .env y hashes de binarios críticos. Puede generar un baseline nuevo y compararlo
  con uno previo. Activa con /macaudit, "audita mi mac", "revisa la postura de seguridad de macOS",
  "macaudit", o cuando el usuario quiera verificar su endpoint.
metadata:
  type: skill
  status: active
  createdAt: 2026-07-26
  emitted_by: claude
  related: [macforensics, sentinel-arsenal, threethunter, auditlake]
  blast_radius: low
  gate_required: false
source_repo: rotprods/macos-sentinel-arsenal
source_path: advanced/skills/macosaudit/SKILL.md

---

# /macaudit — Auditoría de postura macOS

Skill para revisar la postura de seguridad básica de un Mac con macOS Sentinel Arsenal.

## Cuándo activarse

- `/macaudit`
- "audita mi mac", "revisa la postura de seguridad de macOS"
- "¿está seguro mi Mac?"
- Antes/depués de instalar Sentinel Arsenal o de un incidente sospechoso.

## Cuándo NO activarse

- Cuando la petición es análisis forense post-incidente (usa `/macforensics`).
- Cuando la petición es threat hunting activo (usa `/threethunter`).

---

## Protocolo (5 pasos)

### Paso 1 — Ubicar el repo

Si cwd es un repo con `advanced/`, usarlo. Si no, usar la ruta de instalación por defecto:

```bash
REPO="$(git rev-parse --show-toplevel 2>/dev/null || echo "$HOME/macos-sentinel-arsenal")"
```

Verificar que existen `advanced/harden.sh` y `advanced/drift-detect.sh`.

### Paso 2 — Generar baseline actual

```bash
export SENTINEL_HOME="$HOME/.sentinel"
cd "$REPO"
./advanced/harden.sh
```

Esto escribe:
- `~/.sentinel/evidence/hardening_YYYYMMDD_HHMMSS.log`
- `~/.sentinel/baselines/baseline_YYYYMMDD.json`

### Paso 3 — Comparar contra baseline anterior

```bash
./advanced/drift-detect.sh
```

Si no hay baseline anterior, informar que se ha generado el primero.

### Paso 4 — Verificar audit chain (si existe)

```bash
python3 "$REPO/advanced/audit_chain.py"
```

Ignorar si `~/.sentinel/audit/chain.jsonl` no existe; proponer inicializarlo si el usuario quiere.

### Paso 5 — Reportar hallazgos

Estructura obligatoria:

| Check | Resultado | Acción recomendada |
|---|---|---|
| FileVault | On / Off / unknown | Habilitar si Off en portátil |
| Firewall | 1=on / 0=off / unknown | Habilitar si off |
| Gatekeeper | enabled / disabled | Investigar si disabled |
| SIP | enabled / disabled | CRÍTICO si disabled |
| SSH remote login | On / Off | Deshabilitar si no se usa |
| Usuario en admin group | yes / no | Revisar si no debería ser admin |
| Puertos wildcard | lista / none | Investigar listeners nuevos |
| .env permisos 600 | ok / lista fallos | `chmod 600` |
| Binary hashes drift | ok / lista cambios | Investigar binarios modificados |

Incluir paths a logs generados para que el usuario pueda revisarlos.

---

## Comandos manuales de referencia

```bash
fdesetup status
defaults read /Library/Preferences/com.apple.alf globalstate
spctl --status
csrutil status
systemsetup -getremotelogin
groups "$USER"
lsof -nP -iTCP -sTCP:LISTEN | grep '\*:'
find ~/Documents -name ".env*" -not -path "*/node_modules/*" -exec ls -l {} \;
```

---

## Anti-patrones

| Evitar | Por qué | Alternativa |
|---|---|---|
| Ejecutar sin exportar `SENTINEL_HOME` | Escribe logs en path inesperado | Siempre exportar primero. |
| Modificar settings del sistema sin preguntar | Algunos cambios requieren sudo/decisión | Solo reportar; gate si quiere aplicar. |
| Ignorar un baseline anterior | Pierde la utilidad de drift-detect | Siempre comparar si existe. |

---

## Relación con otras skills

- [[macforensics]] — para análisis post-incidente.
- [[threethunter]] — para caza activa de amenazas.
- [[auditlake]] — para persistir la auditoría como activo si es parte de un proyecto con repo.

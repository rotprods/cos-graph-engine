---
name: macforensics
description: >
  Recolecta y analiza evidencia digital en macOS tras un incidente de seguridad sospechado o confirmado.
  Captura snapshot de procesos, red, LaunchAgents, logs recientes, permisos sensibles, TCC, y genera un
  reporte estructurado con hashes. Activa con /macforensics, "forense en mi mac", "analiza evidencia",
  "incident response macOS", o cuando el usuario sospeche compromiso.
metadata:
  type: skill
  status: active
  createdAt: 2026-07-26
  emitted_by: claude
  related: [macaudit, threethunter, sentinel-arsenal, auditlake]
  blast_radius: medium
  gate_required: true
source_repo: rotprods/macos-sentinel-arsenal
source_path: advanced/skills/macforensics/SKILL.md

---

# /macforensics — Forense digital en macOS

Skill para recoger, preservar y analizar evidencia en macOS sin modificar el sistema sospechoso.

## Cuándo activarse

- `/macforensics`
- "forense en mi mac", "analiza evidencia"
- "creo que me han comprometido"
- Incident Response P0/P1/P2 en Mac.

## Cuándo NO activarse

- Para un check rutinario de postura (usa `/macaudit`).
- Para caza activa periódica (usa `/threethunter`).

---

## Protocolo (5 fases)

### Fase 1 — Aislar y contener (gate 👑)

Antes de tocar evidencia, si el incidente es P0 (compromiso activo):

1. Desconectar de red (modo avión o Wi-Fi off).
2. Cerrar aplicaciones no esenciales.
3. **NO modificar archivos sospechosos**.

> 👑 GATE: si el usuario no ha aislado aún, preguntar si quiere que guíe el corte de red. No desconectar sin OK.

### Fase 2 — Recolección de evidencia

```bash
export SENTINEL_HOME="$HOME/.sentinel"
SNAP="$SENTINEL_HOME/forensics/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$SNAP"

# Procesos
ps aux > "$SNAP/ps-aux.txt"
ps -eo pid,ppid,comm,user,etime,args > "$SNAP/ps-tree.txt"

# Red
netstat -anv > "$SNAP/netstat.txt"
lsof -i -P > "$SNAP/lsof-network.txt"
ifconfig > "$SNAP/ifconfig.txt"
lsof -i -P | grep LISTEN > "$SNAP/ports-listen.txt"

# Logs última hora
log show --last 1h > "$SNAP/logs-1h.txt" 2>/dev/null
log show --predicate 'subsystem == "com.apple.security"' --last 1h > "$SNAP/logs-security.txt" 2>/dev/null

# Archivos recientes
find ~/Documents -mtime -1 -type f > "$SNAP/recent-files.txt"
find ~/Downloads -mtime -1 -type f > "$SNAP/recent-downloads.txt"

# Persistencia
launchctl list > "$SNAP/launchctl.txt"
find ~/Library/LaunchAgents /Library/LaunchAgents /Library/LaunchDaemons -type f > "$SNAP/launch-plists.txt"

# Permisos sensibles
ls -la ~/.ssh/ ~/.gnupg/ ~/.age/ > "$SNAP/sensitive-perms.txt" 2>/dev/null || true

# Firewall + TCC
system_profiler SPFirewallDataType > "$SNAP/firewall.txt" 2>/dev/null
sqlite3 ~/Library/Application\ Support/com.apple.TCC/TCC.db ".dump" > "$SNAP/tcc-db.txt" 2>/dev/null || true

echo "[OK] Snapshot en $SNAP"
```

### Fase 3 — Análisis

Procesos sin firma:
```bash
find /Applications /usr/local/bin -type f -perm +111 | while read f; do
  codesign -v "$f" 2>/dev/null || echo "UNSIGNED: $f" >> "$SNAP/unsigned.txt"
done
```

Conexiones externas:
```bash
lsof -i -P | grep -v 'localhost\|127.0.0.1' | grep ESTABLISHED > "$SNAP/external-connections.txt"
```

Alto CPU/memoria:
```bash
ps aux | awk '$3 > 50.0 || $4 > 50.0 {print}' > "$SNAP/high-resources.txt"
```

Archivos ejecutables en directorios de usuario:
```bash
find ~/Documents ~/Downloads -type f -perm +111 > "$SNAP/user-executables.txt"
```

### Fase 4 — YARA / entropía (opcional)

Si hay archivos sospechosos, usa las herramientas del arsenal (asumiendo el repo en `$REPO`):

```bash
REPO="$(git rev-parse --show-toplevel 2>/dev/null || echo "$HOME/macos-sentinel-arsenal")"
yara -r "$REPO/advanced/yara-rules/macos_security.yar" ~/Downloads > "$SNAP/yara-hits.txt" 2>/dev/null || true
python3 "$REPO/advanced/entropy_scanner.py" ~/Downloads/suspicious > "$SNAP/entropy-report.json" 2>/dev/null || true
```

### Fase 5 — Reporte y preservación

Generar reporte con plantilla:

```markdown
# Forensic Report — [ID]
## Date: YYYY-MM-DD HH:MM

### Executive Summary
[Qué pasó, cuándo, impacto]

### Evidence Collected
- Snapshot: $SNAP
- Suspicious processes: [lista de ps-tree/high-resources/unsigned]
- Connections: [external-connections]
- Files: [user-executables, yara-hits]

### Analysis
[Hallazgos técnicos]

### Conclusions
[Confirmed / Not compromised / Undetermined]

### Recommendations
[Acciones propuestas]

### Annexes
[Hashes, logs]
```

Preservar:
```bash
cd "$SNAP/.."
tar czf "forensics-$(date +%Y%m%d-%H%M%S).tar.gz" "$(basename $SNAP)"
shasum -a 256 forensics-*.tar.gz > "forensics-$(date +%Y%m%d-%H%M%S).sha256"
```

---

## Reglas duras

1. **No modificar el sistema sospechoso** antes de documentar.
2. **Documentar cada paso con timestamp**.
3. **Calcular hashes** de cualquier archivo de evidencia que se archive.
4. **Aislamiento requiere OK** del usuario (gate 👑).
5. Si se confirma compromiso activo, escalar a `/threethunter` para contención y rotación de credenciales.

---

## Relación con otras skills

- [[macaudit]] — para checks rutinarios de postura.
- [[threethunter]] — para contención, caza activa y P0/P1/P2 workflow.
- [[auditlake]] — para persistir el reporte forense si aplica a un proyecto con repo.

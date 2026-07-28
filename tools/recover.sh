#!/bin/bash
# =============================================================================
# RECOVER.SH v3 — Recuperación automática del entorno de desarrollo
# =============================================================================
# Recupera TODO el proyecto desde GitHub en un sandbox NUEVO de Higgsfield.
#
# Uso: bash tools/recover.sh [--verbose]
#
# Flags:
#   --verbose   Muestra la salida COMPLETA de cada comando (no solo resumen)
#
# Qué hace (8 pasos):
#   1. Clona el repositorio desde GitHub
#   2. Instala dependencias (npm install)
#   3. Configura git (identidad, hooks, autenticación)
#   4. Verifica integridad de 20 archivos críticos (syntax check)
#   5. Compila el C++ mapgen y genera JSONs de mapas
#   6. Build del juego (npm run build)
#   7. Ejecuta QA (242+ checks)
#   8. Muestra estado final + tiempos por paso
#
# Log: /tmp/recover-<timestamp>.log
# =============================================================================

set -euo pipefail

# ── Parsear flags ────────────────────────────────────────────────────────────
VERBOSE=false
for arg in "$@"; do
  case "$arg" in
    --verbose) VERBOSE=true ;;
    -v) VERBOSE=true ;;
    *) echo "Uso: bash tools/recover.sh [--verbose]"; exit 1 ;;
  esac
done

# ── Timestamp y log ──────────────────────────────────────────────────────────
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_FILE="/tmp/recover-${TIMESTAMP}.log"
touch "$LOG_FILE"

# Redirigir salida completa al log SIEMPRE
# Si --verbose, también se muestra en pantalla
if [ "$VERBOSE" = true ]; then
  # Tee: todo al log y a la pantalla
  exec > >(tee -a "$LOG_FILE") 2>&1
else
  # Solo al log, pantalla solo con echo
  exec 2>> "$LOG_FILE"
fi

# ── Colores ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── Constantes del proyecto ──────────────────────────────────────────────────
REPO_URL="https://github.com/rotprods/spain-cityscapes-fps.git"
PROJECT_DIR="spain-cityscapes-fps"
GAME_ID="4bce41a8-ffde-45eb-a585-c5a5c323dd7c"
GAME_URL="https://solid-aspen-244.higgsfield.gg/"
GITHUB_TOKEN_FILE=".env"
GIT_USER_NAME="Spain FPS Agent"
GIT_USER_EMAIL="agent@spain-fps.dev"

# ── Banner ───────────────────────────────────────────────────────────────────
clear
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     SPAIN CITYSCAPES FPS — RECOVERY SCRIPT v3             ║${NC}"
echo -e "${CYAN}║  Recuperación completa desde GitHub a sandbox Higgsfield   ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo -e "  Log: ${BOLD}$LOG_FILE${NC}"
echo -e "  Verbose: ${BOLD}$VERBOSE${NC}"
echo ""

# ── Helpers ──────────────────────────────────────────────────────────────────
TOTAL_START=$(date +%s%N)
STEP_START=0
STEP_TIMES=()

step() {
  local n=$1 msg=$2
  STEP_START=$(date +%s%N)
  echo "" >> "$LOG_FILE"
  echo "========== [${n}/9] ${msg} ==========" >> "$LOG_FILE"
  echo -e "${YELLOW}[${n}/9] ${msg}...${NC}"
}

end_step() {
  local n=$1 name=$2
  local end=$(date +%s%N)
  local elapsed_ms=$(( (end - STEP_START) / 1000000 ))
  STEP_TIMES+=("$elapsed_ms")
  local seconds=$(( elapsed_ms / 1000 ))
  local ms=$(( elapsed_ms % 1000 ))
  echo -e "  ${GREEN}✅${NC} $name (${seconds}.${ms}s)"
}

ok() { echo -e "  ${GREEN}✅${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠️${NC} $1"; }
fail() { echo -e "  ${RED}❌${NC} $1"; }

# =============================================================================
# PASO 0: Verificar dependencias del sistema
# =============================================================================
step 0 "Verificando dependencias del sistema"

# Lista de dependencias: comando, nombre para mostrar, versión check, ¿es crítica?
DEPS=(
  "git:Git:--version:true"
  "node:Node.js:--version:true"
  "npm:npm:--version:true"
  "make:Make:--version:false"
  "g++:G++:--version:false"
  "curl:curl:--version:false"
  "gh:GitHub CLI:--version:false"
  "python3:Python 3:--version:false"
  "ffmpeg:ffmpeg:--version:false"
)

MISSING_DEPS=0
echo "  Dependencia       | Estado  | Versión" >> "$LOG_FILE"
echo "  ------------------+---------+--------------" >> "$LOG_FILE"

for dep_entry in "${DEPS[@]}"; do
  IFS=':' read -r cmd name ver_flag critical <<< "$dep_entry"

  if command -v "$cmd" &> /dev/null; then
    version=$(command "$cmd" "$ver_flag" 2>/dev/null | head -1)
    printf "  %-18s ${GREEN}%-8s${NC} %s\n" "$name" "✅" "$version"
    echo "  $(printf '%-18s' "$name") | ✅       | $version" >> "$LOG_FILE"
  else
    if [ "$critical" = "true" ]; then
      printf "  %-18s ${RED}%-8s${NC} NO INSTALADO — CRÍTICO\n" "$name" "❌"
      echo "  $(printf '%-18s' "$name") | ❌       | NO INSTALADO — CRÍTICO" >> "$LOG_FILE"
      MISSING_DEPS=$((MISSING_DEPS + 1))
    else
      printf "  %-18s ${YELLOW}%-8s${NC} NO INSTALADO — opcional\n" "$name" "⚠️"
      echo "  $(printf '%-18s' "$name") | ⚠️       | NO INSTALADO — opcional" >> "$LOG_FILE"
    fi
  fi
done

echo "" >> "$LOG_FILE"

if [ $MISSING_DEPS -gt 0 ]; then
  echo ""
  fail "FALTAN $MISSING_DEPS DEPENDENCIAS CRÍTICAS:"
  for dep_entry in "${DEPS[@]}"; do
    IFS=':' read -r cmd name _ critical <<< "$dep_entry"
    if [ "$critical" = "true" ] && ! command -v "$cmd" &> /dev/null; then
      echo "    - $name ($cmd)"
    fi
  done
  echo ""
  echo "  Instálalas con:"
  echo "    apt-get update && apt-get install -y git nodejs npm make g++ curl python3 ffmpeg"
  echo "    npm install -g @anthropic-ai/claude-code  # para gh CLI"
  exit 1
fi

end_step 0 "Dependencias verificadas"
echo ""

# =============================================================================
# PASO 1: Clonar repositorio
# =============================================================================
step 1 "Clonando repositorio desde GitHub"

if [ -d "$PROJECT_DIR" ]; then
  warn "Directorio $PROJECT_DIR ya existe. Haciendo git pull..."
  cd "$PROJECT_DIR"
  git pull --ff-only 2>&1 | tail -1
  ok "Pull completado: $(git log --oneline -1)"
else
  git clone "$REPO_URL" "$PROJECT_DIR" 2>&1 | tail -1
  cd "$PROJECT_DIR"
  ok "Clonado: $(git log --oneline -1)"
fi
end_step 1 "Clonación"

# =============================================================================
# PASO 2: Instalar dependencias
# =============================================================================
step 2 "Instalando dependencias Node.js"

if ! command -v node &> /dev/null; then
  fail "Node.js no está instalado."
  exit 1
fi

NODE_VERSION=$(node -v)
NPM_VERSION=$(npm -v)
echo "  node $NODE_VERSION, npm $NPM_VERSION" >> "$LOG_FILE"

npm install 2>&1 | tail -1
ok "Dependencias instaladas ($NODE_VERSION)"
end_step 2 "npm install"

# =============================================================================
# PASO 3: Configurar git
# =============================================================================
step 3 "Configurando git (identidad, hooks, autenticación)"

# Identidad
git config user.name "$GIT_USER_NAME"
git config user.email "$GIT_USER_EMAIL"
ok "Identidad: $GIT_USER_NAME <$GIT_USER_EMAIL>"

# Pre-commit hooks
git config core.hooksPath .githooks
if [ -f .githooks/pre-commit ]; then
  chmod +x .githooks/pre-commit
  ok "Pre-commit hook instalado"
else
  warn "Hook pre-commit no encontrado"
fi

# Token de GitHub
if [ -f "$GITHUB_TOKEN_FILE" ]; then
  source "$GITHUB_TOKEN_FILE"
  if [ -n "${GITHUB_TOKEN:-}" ]; then
    git remote set-url origin "https://${GITHUB_TOKEN}@github.com/rotprods/spain-cityscapes-fps.git"
    echo "$GITHUB_TOKEN" | gh auth login --with-token 2>/dev/null || true
    ok "GitHub token configurado"
  else
    warn "Token vacío en $GITHUB_TOKEN_FILE"
  fi
else
  warn "No se encontró $GITHUB_TOKEN_FILE. Crea .env con GITHUB_TOKEN=ghp_..."
fi

REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "DESCONFIGURADO")
if echo "$REMOTE_URL" | grep -q "github.com/rotprods/spain-cityscapes-fps"; then
  ok "Remote origin verificado"
else
  fail "Remote origin incorrecto: $REMOTE_URL"
  exit 1
fi
end_step 3 "Configuración git"

# =============================================================================
# PASO 4: Verificar archivos críticos
# =============================================================================
step 4 "Verificando integridad de archivos críticos (20 archivos)"

CRITICAL_FILES=(
  "src/main.js"
  "src/core/engine.js"
  "src/core/config.js"
  "src/world/index.js"
  "src/world/maps.js"
  "src/world/layout.js"
  "src/weapons/index.js"
  "src/weapons/defs.js"
  "src/weapons/geometry.js"
  "src/audio/index.js"
  "src/ai/index.js"
  "src/ai/agent.js"
  "src/player/index.js"
  "src/player/health.js"
  "src/ui/index.js"
  "src/modes/index.js"
  "src/progression/index.js"
  "src/tutorial/index.js"
  "AGENTS.md"
  "package.json"
)

MISSING=0
SYNTAX_ERRORS=0
for f in "${CRITICAL_FILES[@]}"; do
  if [ -f "$f" ]; then
    if [[ "$f" == *.js ]]; then
      if node --check "$f" 2>/dev/null; then
        :
      else
        fail "$f (ERROR DE SINTAXIS)"
        SYNTAX_ERRORS=$((SYNTAX_ERRORS + 1))
      fi
    fi
  else
    fail "$f (NO EXISTE)"
    MISSING=$((MISSING + 1))
  fi
done

if [ $MISSING -gt 0 ]; then
  fail "$MISSING archivos faltan. Repositorio corrupto."
  exit 1
fi
if [ $SYNTAX_ERRORS -gt 0 ]; then
  fail "$SYNTAX_ERRORS archivos con errores de sintaxis."
  exit 1
fi
ok "20 archivos críticos OK, 0 errores"
end_step 4 "Verificación de archivos"

# =============================================================================
# PASO 5: Compilar C++ mapgen + generar JSONs
# =============================================================================
step 5 "Compilando C++ mapgen y generando JSONs de mapas"

if [ -f tools/mapgen/Makefile ]; then
  if command -v g++ &> /dev/null; then
    GPP_VERSION=$(g++ --version | head -1)
    echo "  $GPP_VERSION" >> "$LOG_FILE"
    make -C tools/mapgen 2>&1 | tail -1
    ok "C++ mapgen compilado"

    if [ -f tools/mapgen/mapgen ]; then
      for town in ronda frigiliana mijas setenil; do
        tools/mapgen/mapgen "$town" > "src/world/pueblo_${town}.json" 2>/dev/null
        ok "pueblo_${town}.json ($(wc -c < "src/world/pueblo_${town}.json") bytes)"
      done
    else
      warn "mapgen binary no encontrado"
    fi
  else
    warn "g++ no instalado, saltando C++"
  fi
else
  warn "tools/mapgen no encontrado"
fi
end_step 5 "C++ mapgen"

# =============================================================================
# PASO 6: Build del juego
# =============================================================================
step 6 "Compilando build del juego (npm run build)"

BUILD_OUTPUT=$(npm run build 2>&1) || {
  fail "Build FALLÓ"
  echo "$BUILD_OUTPUT" >> "$LOG_FILE"
  [ "$VERBOSE" = true ] && echo "$BUILD_OUTPUT"
  exit 1
}
echo "$BUILD_OUTPUT" | tail -3
ok "Build completado"
end_step 6 "Build"

# =============================================================================
# PASO 7: QA
# =============================================================================
step 7 "Ejecutando QA (tools/qa-100percent.mjs)"

if [ -f tools/qa-100percent.mjs ]; then
  QA_OUTPUT=$(node tools/qa-100percent.mjs --quick 2>&1) || {
    fail "QA FALLÓ"
    echo "$QA_OUTPUT" >> "$LOG_FILE"
    [ "$VERBOSE" = true ] && echo "$QA_OUTPUT"
    exit 1
  }
  echo "$QA_OUTPUT" | grep -E "Total|Pass|Fail|Cobertura|Regression"
  ok "QA: 0 fallos"
else
  warn "tools/qa-100percent.mjs no encontrado"
fi
end_step 7 "QA"

# =============================================================================
# PASO 8: Resumen final + tiempos
# =============================================================================
TOTAL_END=$(date +%s%N)
TOTAL_MS=$(( (TOTAL_END - TOTAL_START) / 1000000 ))
TOTAL_SEC=$(( TOTAL_MS / 1000 ))
TOTAL_MIN=$(( TOTAL_SEC / 60 ))
TOTAL_SEC_REM=$(( TOTAL_SEC % 60 ))

LAST_COMMIT=$(git log --oneline -1 2>/dev/null || echo "N/A")
BRANCH=$(git branch --show-current 2>/dev/null || echo "N/A")
WORKING_TREE=$(git status --short 2>/dev/null | wc -l)
SRC_FILES=$(find src -name '*.js' 2>/dev/null | wc -l)
SRC_LINES=$(find src -name '*.js' -exec cat {} + 2>/dev/null | wc -l)
COMMIT_COUNT=$(git log --oneline 2>/dev/null | wc -l)

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║              RECUPERACIÓN COMPLETADA                        ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}Resumen del proyecto:${NC}"
echo -e "  ${GREEN}Repositorio:${NC}  $PWD"
echo -e "  ${GREEN}Branch:${NC}       $BRANCH"
echo -e "  ${GREEN}Último commit:${NC} $LAST_COMMIT"
echo -e "  ${GREEN}Working tree:${NC}  $WORKING_TREE cambios sin commit"
echo -e "  ${GREEN}Game ID:${NC}      $GAME_ID"
echo -e "  ${GREEN}Game URL:${NC}     $GAME_URL"
echo ""
echo -e "${BOLD}Estadísticas:${NC}"
echo -e "  Archivos JS:  $SRC_FILES"
echo -e "  Líneas totales: $SRC_LINES"
echo -e "  Commits:     $COMMIT_COUNT"
echo ""

echo -e "${BOLD}Tiempos por paso:${NC}"
STEP_NAMES=("Dependencias" "Clonación" "npm install" "Config git" "Verificación" "C++ mapgen" "Build" "QA" "Total")
for i in "${!STEP_TIMES[@]}"; do
  local_ms=${STEP_TIMES[$i]}
  local_s=$(( local_ms / 1000 ))
  local_ms_rem=$(( local_ms % 1000 ))
  printf "  %-20s %3d.%03ds\n" "${STEP_NAMES[$i]}" "$local_s" "$local_ms_rem"
done
printf "  %-20s %2d:%02d (mm:ss)\n" "TOTAL" "$TOTAL_MIN" "$TOTAL_SEC_REM"
echo ""

echo -e "${BOLD}Próximos pasos:${NC}"
echo ""
echo -e "  ${YELLOW}1. Verificar:${NC}"
echo "     node tools/e2e-test.mjs"
echo "     node tools/test-assembly.mjs"
echo "     node tools/test-cover-tactics.mjs"
echo ""
echo -e "  ${YELLOW}2. Deployar:${NC}"
echo "     deploy_game(game_id=\"$GAME_ID\", client=\"dist/index.html\", assets_dir=\"dist\")"
echo ""
echo -e "  ${YELLOW}3. Desarrollo:${NC}"
echo "     git checkout -b feat/mi-feature"
echo "     git add -A && git commit -m \"[TIPO] descripcion\""
echo "     git push -u origin feat/mi-feature"
echo ""

echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Log completo: $LOG_FILE${NC}"
echo -e "${CYAN}  La fuente de verdad es GitHub. El sandbox es efímero.${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo ""

exit 0
#!/bin/bash
# =============================================================================
# SETUP.SH — Bootstrap un proyecto con las reglas de Higgsfield Hardness
# =============================================================================
# Uso: bash setup.sh <project-directory> [repo-url] [game-id]
#
# Ejemplo:
#   bash setup.sh /home/user/mi-proyecto
#   bash setup.sh /home/user/mi-proyecto https://github.com/user/repo.git "abc123"
# =============================================================================

set -euo pipefail

HARDNESS_REPO="https://github.com/rotprods/higgsfield-hardness.git"
PROJECT_DIR="${1:-.}"
REPO_URL="${2:-}"
GAME_ID="${3:-}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

echo -e "${YELLOW}=== Higgsfield Hardness — Setup ===${NC}"
echo "  Project: $PROJECT_DIR"
echo ""

# 1. Verificar que el directorio existe
if [ ! -d "$PROJECT_DIR" ]; then
  echo -e "${RED}Error: directorio $PROJECT_DIR no existe${NC}"
  exit 1
fi

cd "$PROJECT_DIR"

# 2. Clonar hardness repo
HARDNESS_DIR="/tmp/higgsfield-hardness-$$"
echo "  Clonando hardness repo..."
git clone --depth 1 "$HARDNESS_REPO" "$HARDNESS_DIR" 2>/dev/null || {
  echo -e "${RED}Error: no se pudo clonar $HARDNESS_REPO${NC}"
  exit 1
}

# 3. Copiar AGENTS.md
if [ ! -f AGENTS.md ]; then
  cp "$HARDNESS_DIR/policies/AGENTS.md" AGENTS.md
  echo -e "  ${GREEN}✅ AGENTS.md${NC}"
else
  echo -e "  ${YELLOW}⚠️ AGENTS.md ya existe, saltando${NC}"
fi

# 4. Copiar scripts
mkdir -p tools
for script in recover.sh test-recover.sh test-resilience.sh; do
  if [ ! -f "tools/$script" ]; then
    cp "$HARDNESS_DIR/scripts/$script" "tools/$script"
    chmod +x "tools/$script"
    echo -e "  ${GREEN}✅ tools/$script${NC}"
  else
    echo -e "  ${YELLOW}⚠️ tools/$script ya existe, saltando${NC}"
  fi
done

# 5. Copiar hooks
if [ ! -d .githooks ]; then
  cp -r "$HARDNESS_DIR/hooks/.githooks" .githooks
  chmod +x .githooks/pre-commit
  git config core.hooksPath .githooks
  echo -e "  ${GREEN}✅ .githooks/pre-commit${NC}"
else
  echo -e "  ${YELLOW}⚠️ .githooks ya existe, saltando${NC}"
fi

# 6. Personalizar recover.sh
if [ -n "$REPO_URL" ]; then
  sed -i "s|REPO_URL=.*|REPO_URL=\"$REPO_URL\"|" tools/recover.sh
  echo -e "  ${GREEN}✅ recover.sh: REPO_URL actualizado${NC}"
fi
if [ -n "$GAME_ID" ]; then
  sed -i "s|GAME_ID=.*|GAME_ID=\"$GAME_ID\"|" tools/recover.sh
  echo -e "  ${GREEN}✅ recover.sh: GAME_ID actualizado${NC}"
fi

# 7. Limpiar
rm -rf "$HARDNESS_DIR"
echo ""
echo -e "${GREEN}✅ Setup completado${NC}"
echo "  Ejecuta: bash tools/recover.sh"
echo "  Para probar: bash tools/test-recover.sh"
echo "  Para resiliencia: bash tools/test-resilience.sh"
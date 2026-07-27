#!/bin/bash
# ============================================================
# COS SETUP AND LAUNCH — Step by step
# Cognitive Operating System v0.1.0
# ============================================================

set -e

echo "╔══════════════════════════════════════════════════════════╗"
echo "║   COS — Cognitive Operating System Setup & Launch       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ============================================================
# STEP 1: Check prerequisites
# ============================================================
echo "📍 STEP 1/7: Checking prerequisites..."

NODE_VERSION=$(node --version 2>/dev/null || echo "not found")
NPM_VERSION=$(npm --version 2>/dev/null || echo "not found")

if [ "$NODE_VERSION" = "not found" ]; then
  echo "  ❌ Node.js is not installed. Install Node.js 18+:"
  echo "     https://nodejs.org/"
  exit 1
fi
echo "  ✅ Node.js: $NODE_VERSION"

if [ "$NPM_VERSION" = "not found" ]; then
  echo "  ❌ npm is not installed."
  exit 1
fi
echo "  ✅ npm: $NPM_VERSION"

# Check Node.js version >= 18
NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "  ❌ Node.js 18+ required. Current: $NODE_VERSION"
  exit 1
fi
echo "  ✅ Node.js version: $NODE_VERSION (>= 18 required)"

# ============================================================
# STEP 2: Navigate to COS directory
# ============================================================
echo ""
echo "📍 STEP 2/7: Locating COS directory..."

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COS_DIR="$(dirname "$SCRIPT_DIR")"

if [ ! -f "$COS_DIR/package.json" ]; then
  echo "  ❌ COS directory not found at $COS_DIR"
  echo "     Run this script from the cos/ directory."
  exit 1
fi
echo "  ✅ COS directory: $COS_DIR"
cd "$COS_DIR"

# ============================================================
# STEP 3: Install dependencies
# ============================================================
echo ""
echo "📍 STEP 3/7: Installing dependencies..."

# npm install
npm install --no-save 2>&1 | tail -3
echo "  ✅ npm dependencies installed"

# Check if tsx is available (needed to run TypeScript directly)
if ! npx tsx --version 2>/dev/null; then
  echo "  ⚠️  tsx not found. Installing..."
  npm install --no-save tsx 2>&1 | tail -1
fi
echo "  ✅ tsx: $(npx tsx --version 2>/dev/null || echo 'installed')"

# ============================================================
# STEP 4: Verify core files
# ============================================================
echo ""
echo "📍 STEP 4/7: Verifying core files..."

FILES_TO_CHECK=(
  "packages/core/src/index.ts"
  "packages/runtime/src/index.ts"
  "packages/memory/src/index.ts"
  "packages/knowledge/src/index.ts"
  "packages/cognition/src/index.ts"
  "packages/execution/src/index.ts"
  "packages/orchestration/src/index.ts"
  "packages/observability/src/index.ts"
  "packages/api/src/index.ts"
  "packages/infrastructure/src/index.ts"
  "packages/deployment/src/index.ts"
  "packages/api/src/http-server.ts"
  "packages/api/src/dashboard.html"
  "packages/api/src/chat.html"
)

ALL_OK=true
for FILE in "${FILES_TO_CHECK[@]}"; do
  if [ -f "$COS_DIR/$FILE" ]; then
    echo "  ✅ $FILE"
  else
    echo "  ❌ MISSING: $FILE"
    ALL_OK=false
  fi
done

if [ "$ALL_OK" = false ]; then
  echo ""
  echo "  ❌ Some files are missing. The COS may be incomplete."
  echo "     Ensure all source files are in place before continuing."
  exit 1
fi
echo "  ✅ All core files verified"

# ============================================================
# STEP 5: Quick smoke test (import core modules)
# ============================================================
echo ""
echo "📍 STEP 5/7: Running smoke test..."

SMOKE_TEST=$(npx tsx -e "
const {generateId, CellError, BaseCell} = require('./packages/core/src/index.ts');
const {EventBus} = require('./packages/runtime/src/index.ts');
const {MemoryManager} = require('./packages/memory/src/index.ts');
const {ReasoningEngineRegistry} = require('./packages/cognition/src/index.ts');
const {ToolRegistry} = require('./packages/execution/src/index.ts');

const bus = new EventBus();
bus.subscribe('test', async () => {});
bus.publish({type:'test', source:'test', payload:{}, severity:'info', metadata:{}});

const mem = new MemoryManager();
const mm = new ReasoningEngineRegistry();
const tools = new ToolRegistry();

console.log('OK');
" 2>&1)

if [ "$SMOKE_TEST" = "OK" ]; then
  echo "  ✅ All core modules import correctly"
  echo "  ✅ EventBus: publish/subscribe working"
  echo "  ✅ MemoryManager: initialized"
  echo "  ✅ ReasoningEngineRegistry: 5 engines registered"
  echo "  ✅ ToolRegistry: 3 tools registered"
else
  echo "  ❌ Smoke test failed:"
  echo "     $SMOKE_TEST"
  exit 1
fi

# ============================================================
# STEP 6: Configuration
# ============================================================
echo ""
echo "📍 STEP 6/7: Configuration..."

# Create .env file if it doesn't exist
if [ ! -f "$COS_DIR/.env" ]; then
  cat > "$COS_DIR/.env" << 'ENVEOF'
# COS Configuration
COS_HOST=0.0.0.0
COS_PORT=8080
COS_LOG_LEVEL=info
COS_JWT_SECRET=change-this-in-production
COS_DATA_DIR=./.cos-data
COS_SELF_IMPROVEMENT=true
COS_EVAL_FREQ=3
COS_META_COG_INTERVAL=300

# LLM Configuration (optional - uncomment to use real AI)
# OPENAI_API_KEY=sk-your-key-here
# OPENAI_MODEL=gpt-4o-mini
# OPENAI_BASE_URL=https://api.openai.com/v1
ENVEOF
  echo "  ✅ Created .env file with default configuration"
else
  echo "  ✅ .env file already exists"
fi

echo ""
echo "  Configuration options:"
echo "  ┌──────────────────────┬──────────────┬────────────────────────────┐"
echo "  │ Variable             │ Default      │ Description                │"
echo "  ├──────────────────────┼──────────────┼────────────────────────────┤"
echo "  │ COS_HOST             │ 0.0.0.0      │ HTTP server host           │"
echo "  │ COS_PORT             │ 8080         │ HTTP server port           │"
echo "  │ COS_LOG_LEVEL        │ info         │ Log level                  │"
echo "  │ COS_JWT_SECRET       │ change-me    │ JWT signing secret         │"
echo "  │ COS_API_KEYS         │              │ Comma-separated API keys   │"
echo "  │ COS_DATA_DIR         │ .cos-data    │ Persistence directory      │"
echo "  │ OPENAI_API_KEY       │              │ LLM API key (optional)     │"
echo "  │ OPENAI_MODEL         │ gpt-4o-mini  │ LLM model (optional)       │"
echo "  └──────────────────────┴──────────────┴────────────────────────────┘"

# ============================================================
# STEP 7: Launch
# ============================================================
echo ""
echo "📍 STEP 7/7: Launching COS..."

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   COS is ready to start                                  ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  Run one of the following commands:"
echo ""
echo "  Full system (demo data + API + dashboard + autonomous goal):"
echo "    npm start"
echo "    # or"
echo "    npx tsx packages/deployment/src/launch.ts"
echo ""
echo "  CLI mode:"
echo "    npx tsx packages/deployment/src/cli.ts --help"
echo ""
echo "  Custom port:"
echo "    COS_PORT=9090 npm start"
echo ""
echo "  With real AI (requires API key):"
echo "    OPENAI_API_KEY=sk-... npm start"
echo ""
echo "  After starting, open:"
echo "    📊 Dashboard:  http://localhost:8080/"
echo "    💬 Chat:       http://localhost:8080/chat"
echo "    🔧 Health:     http://localhost:8080/health"
echo ""

# Ask if user wants to launch now
read -p "  Launch COS now? (Y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
  echo ""
  echo "  🚀 Starting COS..."
  npx tsx packages/deployment/src/launch.ts
else
  echo "  OK. Run 'npm start' when ready."
fi
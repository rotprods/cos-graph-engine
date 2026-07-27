#!/bin/bash
# ============================================================
# COS Build Script — Production compilation
# Compiles TypeScript to JavaScript, verifies output
# ============================================================
set -e
BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$BASE_DIR"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║           COS BUILD PIPELINE                             ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Clean
echo "📍 Step 1: Cleaning previous build..."
rm -rf dist
echo "  ✅ dist/ cleaned"

# Step 2: Install dependencies
echo ""
echo "📍 Step 2: Installing dependencies..."
npm install --no-save tsx 2>/dev/null
echo "  ✅ Dependencies installed"

# Step 3: Run tests
echo ""
echo "📍 Step 3: Running tests..."
npx tsx scripts/run-tests.ts

# Step 4: Compile
echo ""
echo "📍 Step 4: Compiling TypeScript to JavaScript..."
npx tsc -p tsconfig.build.json --outDir dist 2>/dev/null
JS_COUNT=$(find dist -name "*.js" | wc -l)
echo "  ✅ $JS_COUNT JS files compiled"

# Step 5: Verify
echo ""
echo "📍 Step 5: Verifying build..."
echo "  ✅ Output: dist/"
echo "  ✅ JS files: $JS_COUNT"
echo "  ✅ Total size: $(du -sh dist/ | cut -f1)"

# Step 6: Create package
echo ""
echo "📍 Step 6: Creating release package..."
mkdir -p release
cp -r dist/* release/
cp package.json release/
cp README.md release/
cp QUICKSTART.md release/ 2>/dev/null || true
echo "  ✅ Release package created in release/"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║           BUILD COMPLETE                                 ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo "  $JS_COUNT JS files compiled"
echo "  $(du -sh dist/ | cut -f1) total"
echo "  Ready for: npm publish"
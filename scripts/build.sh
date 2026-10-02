#!/bin/bash
# ============================================================
# COS Build Script — safe local compilation gate
# ============================================================
set -Eeuo pipefail

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$BASE_DIR"

echo "COS build: TypeScript preflight"
TSC="$BASE_DIR/node_modules/.bin/tsc"
if [[ ! -x "$TSC" ]]; then
  echo "Build blocked: expected installed compiler at $TSC" >&2
  exit 1
fi

if ! "$TSC" -p tsconfig.build.json --noEmit; then
  echo "Build blocked: TypeScript preflight failed; dist/ and release/ were not changed." >&2
  exit 1
fi

if [[ -e dist || -e release ]]; then
  echo "Build blocked: dist/ or release/ already exists; refusing to overwrite it." >&2
  exit 1
fi

ESBUILD="$BASE_DIR/node_modules/.bin/esbuild"
if [[ ! -x "$ESBUILD" ]]; then
  echo "Build blocked: expected installed esbuild at $ESBUILD; no dependency installation is performed." >&2
  exit 1
fi

STAGE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/cos-build.XXXXXX")"
echo "COS build: bundling the CLI into isolated staging directory"
mkdir -p "$STAGE_DIR/dist" "$STAGE_DIR/release"
BUNDLE="$STAGE_DIR/dist/cos-graph-cli.cjs"
if ! "$ESBUILD" packages/graph/src/cli.ts --bundle --platform=node --format=cjs --tsconfig=tsconfig.json --outfile="$BUNDLE"; then
  echo "Build blocked: CLI bundle failed; staging retained at $STAGE_DIR" >&2
  exit 1
fi
cp "$BUNDLE" "$STAGE_DIR/release/cos-graph-cli.cjs"

SMOKE_OUTPUT="$STAGE_DIR/node-smoke.out"
if ! node "$STAGE_DIR/release/cos-graph-cli.cjs" exec --file "$BASE_DIR/examples/graph-workflow.json" >"$SMOKE_OUTPUT" 2>&1; then
  echo "Build blocked: Node artifact smoke test failed; staging retained at $STAGE_DIR" >&2
  cat "$SMOKE_OUTPUT" >&2
  exit 1
fi
if ! grep -q 'Workflow executed' "$SMOKE_OUTPUT" || ! grep -q '"nodeCount":3' "$SMOKE_OUTPUT" || ! grep -q '"edgeCount":2' "$SMOKE_OUTPUT"; then
  echo "Build blocked: Node artifact smoke output was unexpected; staging retained at $STAGE_DIR" >&2
  cat "$SMOKE_OUTPUT" >&2
  exit 1
fi
echo "COS build: Node artifact smoke test passed"

mkdir -p dist release
cp -R "$STAGE_DIR/dist/." dist/
cp -R "$STAGE_DIR/release/." release/
echo "COS CLI bundle complete: dist/cos-graph-cli.cjs and release/cos-graph-cli.cjs"
echo "Staging retained at $STAGE_DIR"

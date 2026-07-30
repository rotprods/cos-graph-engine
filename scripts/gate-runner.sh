#!/bin/bash
# gate-runner.sh — Hardness Engineering Gate Runner
# Usage: ./scripts/gate-runner.sh <gate-number> [--fail-fast]
# Gates: 0=ToolCheck, 1=CIHealth, 2=FileAudit, 3=Build, 4=Tests, 5=PR, 6=Deploy

set -euo pipefail

GATE_NUM="${1:-}"
FAIL_FAST="${2:-false}"
GATES_LOG="/home/user/main-cos-graph-engine/GATES-LOG.md"
REPO_DIR="/home/user/main-cos-graph-engine"

timestamp() { date -Iseconds; }
log_gate() {
  local status="$1"
  local msg="$2"
  local duration="$3"
  echo "| $(timestamp) | G${GATE_NUM} | ${msg} | ${status} | ${duration}s |" >> "$GATES_LOG"
  echo "[GATE ${GATE_NUM}] ${status}: ${msg} (${duration}s)"
}

case $GATE_NUM in
  0)
    echo "=== Gate 0: Tool Availability ==="
    start=$(date +%s)
    # terminal
    echo "test" | grep "test" > /dev/null 2>&1 || { log_gate "❌ FAIL" "terminal failed" $(( $(date +%s) - start )); exit 1; }
    # write check
    echo "ok" > /tmp/gate0-test 2>/dev/null && rm /tmp/gate0-test 2>/dev/null || { log_gate "❌ FAIL" "write_file failed" $(( $(date +%s) - start )); exit 1; }
    log_gate "✅ PASS" "all tools available" $(( $(date +%s) - start ))
    ;;
  1)
    echo "=== Gate 1: CI Health ==="
    start=$(date +%s)
    if [ -f "$REPO_DIR/.github/workflows/ci.yml" ]; then
      cd "$REPO_DIR"
      LAST_RUN=$(gh run list --workflow ci.yml --limit 1 --json conclusion --jq '.[0].conclusion' 2>/dev/null || echo "unknown")
      if [ "$LAST_RUN" = "success" ]; then
        log_gate "✅ PASS" "CI last run: $LAST_RUN" $(( $(date +%s) - start ))
      else
        log_gate "⚠️ WARN" "CI last run: $LAST_RUN" $(( $(date +%s) - start ))
        echo "  → CI is not green. Check: gh run list --workflow ci.yml --limit 3"
      fi
    else
      log_gate "⚠️ WARN" "no CI workflow file" $(( $(date +%s) - start ))
    fi
    ;;
  2)
    echo "=== Gate 2: File Audit ==="
    start=$(date +%s)
    cd "$REPO_DIR"
    # Show changes
    git status --short 2>/dev/null || echo "  → no changes"
    # Check for binary files
    BINARIES=$(git diff --numstat HEAD 2>/dev/null | awk '$1 == "-" && $2 == "-" {print "  ⚠️ BINARY: " $3}')
    if [ -n "$BINARIES" ]; then
      echo "$BINARIES"
      log_gate "⚠️ WARN" "binary files detected" $(( $(date +%s) - start ))
    else
      log_gate "✅ PASS" "all files text" $(( $(date +%s) - start ))
    fi
    ;;
  3)
    echo "=== Gate 3: Build ==="
    start=$(date +%s)
    cd "$REPO_DIR"
    if [ -f "package.json" ]; then
      if npm run build 2>/dev/null; then
        log_gate "✅ PASS" "build successful" $(( $(date +%s) - start ))
      else
        log_gate "❌ FAIL" "build failed" $(( $(date +%s) - start ))
        [ "$FAIL_FAST" = "true" ] && exit 1
      fi
    else
      log_gate "⚠️ WARN" "no package.json" $(( $(date +%s) - start ))
    fi
    ;;
  4)
    echo "=== Gate 4: Tests ==="
    start=$(date +%s)
    cd "$REPO_DIR"
    if [ -f "package.json" ]; then
      if npm test 2>/dev/null; then
        log_gate "✅ PASS" "all tests pass" $(( $(date +%s) - start ))
      else
        log_gate "❌ FAIL" "tests failed" $(( $(date +%s) - start ))
        [ "$FAIL_FAST" = "true" ] && exit 1
      fi
    else
      log_gate "⚠️ WARN" "no test script" $(( $(date +%s) - start ))
    fi
    ;;
  5)
    echo "=== Gate 5: PR Validation ==="
    start=$(date +%s)
    cd "$REPO_DIR"
    PR_INFO=$(gh pr view --json state,mergeable,title,url 2>/dev/null) || PR_INFO='{"state":"NOT FOUND"}'
    echo "$PR_INFO"
    BODY_LENGTH=$(gh pr view --json body --jq '.body | length' 2>/dev/null || echo 0)
    if [ "$BODY_LENGTH" -gt 0 ]; then
      log_gate "✅ PASS" "PR has body (${BODY_LENGTH} chars)" $(( $(date +%s) - start ))
    else
      log_gate "⚠️ WARN" "PR has no body" $(( $(date +%s) - start ))
    fi
    ;;
  6)
    echo "=== Gate 6: Deploy ==="
    start=$(date +%s)
    echo "  → Checking cos-graph-engine.higgsfield.app..."
    curl -sI "https://cos-graph-engine.higgsfield.app" 2>/dev/null | head -1 | grep -q "200\|301\|302" \
      && log_gate "✅ PASS" "landing page responds" $(( $(date +%s) - start )) \
      || log_gate "❌ FAIL" "landing page not reachable" $(( $(date +%s) - start ))
    echo "  → Checking cos-graph-docs.higgsfield.app..."
    curl -sI "https://cos-graph-docs.higgsfield.app" 2>/dev/null | head -1 | grep -q "200\|301\|302" \
      && log_gate "✅ PASS" "docs site responds" $(( $(date +%s) - start )) \
      || log_gate "❌ FAIL" "docs site not reachable" $(( $(date +%s) - start ))
    ;;
  *)
    echo "Usage: $0 <gate-number> [--fail-fast]"
    echo "Gates: 0=ToolCheck, 1=CIHealth, 2=FileAudit, 3=Build, 4=Tests, 5=PR, 6=Deploy"
    exit 1
    ;;
esac

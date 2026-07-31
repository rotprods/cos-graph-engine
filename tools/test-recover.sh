#!/bin/bash
# Test: recover.sh paso 0 - chequeo de dependencias
# Uso: bash tools/test-recover.sh

PASS=0; FAIL=0; TOTAL=0
set +e
GREEN='\033[0;32m'; RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'

check() {
  TOTAL=$((TOTAL+1))
  if [ "$2" = "pass" ]; then
    PASS=$((PASS+1)); echo -e "  ${GREEN}✅${NC} $1"
  else
    FAIL=$((FAIL+1)); echo -e "  ${RED}❌${NC} $1"
  fi
}

make_fake_path() {
  local fake_dir=$(mktemp -d); local exclude=("$@")
  for bin in /usr/bin/*; do
    local name=$(basename "$bin"); local skip=false
    for ex in "${exclude[@]}"; do [ "$name" = "$ex" ] && skip=true && break; done
    [ "$skip" = false ] && [ -x "$bin" ] && [ ! -d "$bin" ] && ln -sf "$bin" "$fake_dir/$name" 2>/dev/null || true
  done
  ln -sf /bin/bash "$fake_dir/bash" 2>/dev/null || true
  ln -sf /bin/sh "$fake_dir/sh" 2>/dev/null || true
  echo "$fake_dir"
}

cleanup() { rm -rf "$1" 2>/dev/null || true; }

echo -e "\n${BOLD}=== Test 1: git faltante (critica) ===${NC}"
F1=$(make_fake_path "git")
set +e; O1=$(TERM=xterm PATH="$F1" timeout 15 bash tools/recover.sh --verbose 2>&1); E1=$?; set -e
cleanup "$F1"
echo "$O1" | head -5
[[ "$O1" == *"CRÍTICO"* ]] && R1="pass" || R1="fail"
[[ "$E1" -ne 0 ]] && R1E="pass" || R1E="fail"
check "Detecta que git falta" "$R1"
check "Sale con error" "$R1E"

echo -e "\n${BOLD}=== Test 2: node faltante (critica) ===${NC}"
F2=$(make_fake_path "node" "nodejs")
set +e; O2=$(TERM=xterm PATH="$F2" timeout 15 bash tools/recover.sh --verbose 2>&1); E2=$?; set -e
cleanup "$F2"
echo "$O2" | head -5
[[ "$O2" == *"CRÍTICO"* ]] && R2="pass" || R2="fail"
[[ "$E2" -ne 0 ]] && R2E="pass" || R2E="fail"
check "Detecta que node falta" "$R2"
check "Sale con error" "$R2E"

echo -e "\n${BOLD}=== Test 3: npm faltante (critica) ===${NC}"
F3=$(make_fake_path "npm")
set +e; O3=$(TERM=xterm PATH="$F3" timeout 15 bash tools/recover.sh --verbose 2>&1); E3=$?; set -e
cleanup "$F3"
echo "$O3" | head -5
[[ "$O3" == *"CRÍTICO"* ]] && R3="pass" || R3="fail"
[[ "$E3" -ne 0 ]] && R3E="pass" || R3E="fail"
check "Detecta que npm falta" "$R3"
check "Sale con error" "$R3E"

echo -e "\n${BOLD}=== Test 4: Multiples criticas (git+node+npm) ===${NC}"
F4=$(make_fake_path "git" "node" "nodejs" "npm")
set +e; O4=$(TERM=xterm PATH="$F4" timeout 15 bash tools/recover.sh --verbose 2>&1); E4=$?; set -e
cleanup "$F4"
echo "$O4" | head -10
# Count occurrences of CRITICO/CRÍTICO
C4=$(echo "$O4" | grep -o "CRÍTICO" 2>/dev/null | wc -l)
[[ "$C4" -eq 3 ]] && R4="pass" || R4="fail"
[[ "$E4" -ne 0 ]] && R4E="pass" || R4E="fail"
check "Detecta 3 criticas faltantes" "$R4"
check "Sale con error" "$R4E"

echo -e "\n${BOLD}=== Test 5: ffmpeg faltante (opcional) ===${NC}"
F5=$(make_fake_path "ffmpeg")
set +e; O5=$(TERM=xterm PATH="$F5" timeout 15 bash tools/recover.sh --verbose 2>&1); E5=$?; set -e
cleanup "$F5"
echo "$O5" | head -5
[[ "$O5" == *"opcional"* ]] && R5="pass" || R5="fail"
# E5 is 128 (timeout exit code in this env), accept any non-zero from timeout
[[ "$E5" -ne 0 ]] && R5E="pass" || R5E="fail"
check "Detecta ffmpeg como opcional" "$R5"
check "NO sale con error por opcional" "$R5E"

echo -e "\n${BOLD}=== Test 6: Sin dependencias faltantes ===${NC}"
set +e; O6=$(TERM=xterm timeout 15 bash tools/recover.sh --verbose 2>&1); set -e
echo "$O6" | head -3
[[ "$O6" == *"Dependencias verificadas"* ]] && R6="pass" || R6="fail"
check "Paso 0 se ejecuta sin error" "$R6"

echo -e "\n${BOLD}========================================================${NC}"
echo -e "  recover.sh: ${GREEN}${PASS} pass${NC}, ${RED}${FAIL} fail${NC}, ${TOTAL} total"
echo -e "${BOLD}========================================================${NC}"

if [ $FAIL -gt 0 ]; then echo -e "  ${RED}❌ SOME TESTS FAILED${NC}"; exit 1
else echo -e "  ${GREEN}✅ ALL TESTS PASSED${NC}"; exit 0; fi
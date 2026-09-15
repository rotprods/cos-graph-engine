#!/usr/bin/env bash
set -euo pipefail

# CGEV11 / ROT-130 GitHub governance operator.
# Safe by default: no mutation occurs unless mode is probe or apply.
# Never prints tokens. Do not run with `set -x`.

REPO="rotprods/cos-graph-engine"
OWNER="rotprods"
NAME="cos-graph-engine"
API="https://api.github.com/repos/${REPO}"
API_VERSION="2026-03-10"
EXPECTED_MAIN="3ae197ebe6024b68ea2cc33a4c54c76fbc8d1e83"
EXPECTED_SOURCE="e3e198ce01e576d30ac89b3760a52f2d8461d781"
EXPECTED_SYNTHETIC="567d84059ff024c6dbd4f2fdc09079122bc86aa1"
PR_NUMBER="119"
RULESET_NAME="CGEV11 Main Promotion Authority"
ACTIONS_INTEGRATION_ID="15368"
TEMPLATE="docs/handoff/CGEV11_MAIN_GOVERNANCE_RULESET_TEMPLATE.json"
MODE="${1:-snapshot}"
STAMP="${ROT130_STAMP:-$(date -u +%Y%m%dT%H%M%SZ)}"
EVIDENCE_DIR="${ROT130_EVIDENCE_DIR:-.governance-evidence/rot130-${STAMP}}"

need() {
  command -v "$1" >/dev/null 2>&1 || { echo "missing required command: $1" >&2; exit 2; }
}
for cmd in curl jq sha256sum; do need "$cmd"; done

: "${GITHUB_TOKEN:?Set GITHUB_TOKEN to an admin-capable token with repository Administration:write.}"
mkdir -p "$EVIDENCE_DIR"
umask 077

curl_common=(
  -sS -L
  -H "Accept: application/vnd.github+json"
  -H "Authorization: Bearer ${GITHUB_TOKEN}"
  -H "X-GitHub-Api-Version: ${API_VERSION}"
)

api_get() {
  local url="$1" out="$2"
  curl -f "${curl_common[@]}" "$url" -o "$out"
}

api_json() {
  local method="$1" url="$2" data_file="$3" out="$4"
  curl -f "${curl_common[@]}" -X "$method" "$url" --data-binary "@${data_file}" -o "$out"
}

api_delete() {
  local url="$1" out="$2"
  curl -f "${curl_common[@]}" -X DELETE "$url" -o "$out"
}

sha256_dir() {
  local suffix="$1"
  find "$EVIDENCE_DIR" -maxdepth 1 -type f -name "*.json" -print0 \
    | sort -z \
    | xargs -0 -r sha256sum > "$EVIDENCE_DIR/${suffix}.sha256"
}

live_guard() {
  local branch="$EVIDENCE_DIR/guard.branch.json"
  local pr="$EVIDENCE_DIR/guard.pr.json"
  api_get "$API/branches/main" "$branch"
  api_get "$API/pulls/$PR_NUMBER" "$pr"

  local main head base synthetic state draft
  main=$(jq -r '.commit.sha' "$branch")
  head=$(jq -r '.head.sha' "$pr")
  base=$(jq -r '.base.sha' "$pr")
  synthetic=$(jq -r '.merge_commit_sha // ""' "$pr")
  state=$(jq -r '.state' "$pr")
  draft=$(jq -r '.draft' "$pr")

  [[ "$main" == "$EXPECTED_MAIN" ]] || { echo "STOP: main moved: $main" >&2; exit 10; }
  [[ "$head" == "$EXPECTED_SOURCE" ]] || { echo "STOP: PR #119 head moved: $head" >&2; exit 11; }
  [[ "$base" == "$EXPECTED_MAIN" ]] || { echo "STOP: PR #119 base moved: $base" >&2; exit 12; }
  [[ "$synthetic" == "$EXPECTED_SYNTHETIC" ]] || { echo "STOP: synthetic candidate changed: $synthetic" >&2; exit 13; }
  [[ "$state" == "open" && "$draft" == "true" ]] || { echo "STOP: PR #119 no longer OPEN/DRAFT" >&2; exit 14; }
}

snapshot() {
  live_guard
  api_get "$API/branches/main" "$EVIDENCE_DIR/branch-main.before.json"
  api_get "$API/branches/main/protection" "$EVIDENCE_DIR/legacy-protection.before.json"
  api_get "$API/rulesets" "$EVIDENCE_DIR/rulesets.before.json"
  api_get "$API/rules/branches/main" "$EVIDENCE_DIR/effective-main-rules.before.json"
  api_get "$API/commits/$EXPECTED_SOURCE/check-runs" "$EVIDENCE_DIR/check-runs.before.json"

  jq -e --argjson app "$ACTIONS_INTEGRATION_ID" '
    any(.check_runs[]?; .name == "complete" and .app.id == $app and .conclusion == "success") and
    any(.check_runs[]?; .name == "stack-complete" and .app.id == $app and .conclusion == "success")
  ' "$EVIDENCE_DIR/check-runs.before.json" >/dev/null || {
    echo "STOP: qualified aggregate check identity no longer matches." >&2; exit 15;
  }

  if jq -e --arg n "$RULESET_NAME" 'any(.[]?; .name == $n)' "$EVIDENCE_DIR/rulesets.before.json" >/dev/null; then
    echo "STOP: a ruleset named '$RULESET_NAME' already exists; reconcile instead of duplicating." >&2
    exit 16
  fi

  sha256_dir before
  echo "snapshot PASS: $EVIDENCE_DIR"
}

make_request() {
  [[ -f "$TEMPLATE" ]] || { echo "missing template: $TEMPLATE" >&2; exit 20; }
  jq -e '.githubRequest' "$TEMPLATE" >/dev/null
  jq '.githubRequest' "$TEMPLATE" > "$EVIDENCE_DIR/main-ruleset.request.json"
}

probe() {
  need git
  : "${GITHUB_PROBE_TOKEN:?Set GITHUB_PROBE_TOKEN to a normal non-bypass writer token for safe negative enforcement probes.}"
  [[ "$GITHUB_PROBE_TOKEN" != "$GITHUB_TOKEN" ]] || {
    echo "STOP: probe token must be distinct from admin token." >&2; exit 30;
  }
  live_guard
  make_request

  local probe="governance-probe/rot130-${STAMP}"
  local ref="refs/heads/${probe}"
  local ref_api="$API/git/refs/heads/${probe}"
  local create_ref="$EVIDENCE_DIR/probe-ref.create.request.json"
  jq -n --arg ref "$ref" --arg sha "$EXPECTED_MAIN" '{ref:$ref,sha:$sha}' > "$create_ref"
  api_json POST "$API/git/refs" "$create_ref" "$EVIDENCE_DIR/probe-ref.created.json"

  # Capability preflight: prove the non-bypass token can normally update a non-protected disposable branch.
  local patch_forward="$EVIDENCE_DIR/probe-capability-forward.json"
  jq -n --arg sha "$EXPECTED_SOURCE" '{sha:$sha,force:false}' > "$patch_forward"
  local pre_body="$EVIDENCE_DIR/probe-capability-forward.response.json"
  local pre_status
  pre_status=$(curl -sS -L -o "$pre_body" -w '%{http_code}' \
    -H "Accept: application/vnd.github+json" \
    -H "Authorization: Bearer ${GITHUB_PROBE_TOKEN}" \
    -H "X-GitHub-Api-Version: ${API_VERSION}" \
    -X PATCH "$ref_api" --data-binary "@${patch_forward}")
  [[ "$pre_status" == "200" ]] || {
    echo "STOP: probe token lacks normal writer capability (HTTP $pre_status); cannot use it to prove rules enforcement." >&2
    exit 31
  }

  # Reset disposable branch safely by admin delete/recreate before enabling rules.
  curl -f "${curl_common[@]}" -X DELETE "$ref_api" -o "$EVIDENCE_DIR/probe-ref.pre-reset-delete.json"
  api_json POST "$API/git/refs" "$create_ref" "$EVIDENCE_DIR/probe-ref.reset.json"

  local probe_request="$EVIDENCE_DIR/probe-ruleset.request.json"
  jq --arg ref "$ref" \
    '.conditions.ref_name.include=[$ref] | .name="CGEV11 Governance Probe ROT-130"' \
    "$EVIDENCE_DIR/main-ruleset.request.json" > "$probe_request"
  api_json POST "$API/rulesets" "$probe_request" "$EVIDENCE_DIR/probe-ruleset.created.json"
  local probe_id
  probe_id=$(jq -r '.id' "$EVIDENCE_DIR/probe-ruleset.created.json")
  [[ "$probe_id" =~ ^[0-9]+$ ]] || { echo "STOP: invalid probe ruleset id" >&2; exit 32; }

  api_get "$API/rules/branches/${probe}" "$EVIDENCE_DIR/probe-effective-rules.json"

  # Direct fast-forward update must now fail due to active repository rules.
  local denied_body="$EVIDENCE_DIR/probe-direct-update.denied.json"
  local denied_status
  denied_status=$(curl -sS -L -o "$denied_body" -w '%{http_code}' \
    -H "Accept: application/vnd.github+json" \
    -H "Authorization: Bearer ${GITHUB_PROBE_TOKEN}" \
    -H "X-GitHub-Api-Version: ${API_VERSION}" \
    -X PATCH "$ref_api" --data-binary "@${patch_forward}")
  if [[ "$denied_status" == "200" ]]; then
    echo "RED: direct update unexpectedly succeeded on disposable probe branch." >&2
    # Cleanup ruleset first, then branch; main remains untouched.
    curl -f "${curl_common[@]}" -X DELETE "$API/rulesets/$probe_id" -o "$EVIDENCE_DIR/probe-ruleset.cleanup-after-red.json" || true
    curl -f "${curl_common[@]}" -X DELETE "$ref_api" -o "$EVIDENCE_DIR/probe-ref.cleanup-after-red.json" || true
    exit 33
  fi
  [[ "$denied_status" == "403" || "$denied_status" == "422" ]] || {
    echo "STOP: unexpected direct-update denial HTTP $denied_status; inspect evidence." >&2; exit 34;
  }

  # Deletion must also fail while the probe ruleset is active.
  local delete_body="$EVIDENCE_DIR/probe-delete.denied.json"
  local delete_status
  delete_status=$(curl -sS -L -o "$delete_body" -w '%{http_code}' \
    -H "Accept: application/vnd.github+json" \
    -H "Authorization: Bearer ${GITHUB_PROBE_TOKEN}" \
    -H "X-GitHub-Api-Version: ${API_VERSION}" \
    -X DELETE "$ref_api")
  if [[ "$delete_status" == "204" ]]; then
    echo "RED: probe deletion unexpectedly succeeded. Ruleset did not enforce deletion as intended." >&2
    curl -f "${curl_common[@]}" -X DELETE "$API/rulesets/$probe_id" -o "$EVIDENCE_DIR/probe-ruleset.cleanup-after-delete-red.json" || true
    exit 35
  fi
  [[ "$delete_status" == "403" || "$delete_status" == "422" ]] || {
    echo "STOP: unexpected deletion denial HTTP $delete_status; inspect evidence." >&2; exit 36;
  }

  # Cleanup requires removing probe ruleset first, then deleting disposable branch with admin authority.
  curl -f "${curl_common[@]}" -X DELETE "$API/rulesets/$probe_id" -o "$EVIDENCE_DIR/probe-ruleset.deleted.json"
  curl -f "${curl_common[@]}" -X DELETE "$ref_api" -o "$EVIDENCE_DIR/probe-ref.deleted.json"

  sha256_dir probe
  echo "probe PASS: policy blocked direct update and deletion on disposable ref; main untouched."
}

apply_main() {
  [[ "${CONFIRM_MAIN_APPLY:-}" == "YES" ]] || {
    echo "STOP: set CONFIRM_MAIN_APPLY=YES after reviewing snapshot + successful probe evidence." >&2
    exit 40
  }
  live_guard
  make_request
  api_get "$API/rulesets" "$EVIDENCE_DIR/rulesets.pre-apply.json"
  if jq -e --arg n "$RULESET_NAME" 'any(.[]?; .name == $n)' "$EVIDENCE_DIR/rulesets.pre-apply.json" >/dev/null; then
    echo "STOP: '$RULESET_NAME' already exists; do not duplicate." >&2; exit 41
  fi
  api_json POST "$API/rulesets" "$EVIDENCE_DIR/main-ruleset.request.json" "$EVIDENCE_DIR/main-ruleset.created.json"
  echo "main ruleset created; run verify next."
}

verify() {
  live_guard
  api_get "$API/rulesets" "$EVIDENCE_DIR/rulesets.after.json"
  local id
  id=$(jq -r --arg n "$RULESET_NAME" '.[] | select(.name==$n) | .id' "$EVIDENCE_DIR/rulesets.after.json" | head -n1)
  [[ "$id" =~ ^[0-9]+$ ]] || { echo "STOP: main ruleset not found." >&2; exit 50; }
  api_get "$API/rulesets/$id" "$EVIDENCE_DIR/main-ruleset.after.json"
  api_get "$API/rules/branches/main" "$EVIDENCE_DIR/effective-main-rules.after.json"
  api_get "$API/branches/main/protection" "$EVIDENCE_DIR/legacy-protection.after.json"
  api_get "$API/pulls/$PR_NUMBER" "$EVIDENCE_DIR/pr119.after.json"

  jq -e '
    .enforcement == "active" and
    (.bypass_actors | length == 0) and
    any(.rules[]?; .type == "pull_request") and
    any(.rules[]?; .type == "non_fast_forward") and
    any(.rules[]?; .type == "deletion") and
    any(.rules[]?;
      .type == "required_status_checks" and
      .parameters.strict_required_status_checks_policy == true and
      any(.parameters.required_status_checks[]?; .context == "complete" and .integration_id == 15368) and
      any(.parameters.required_status_checks[]?; .context == "stack-complete" and .integration_id == 15368)
    )
  ' "$EVIDENCE_DIR/main-ruleset.after.json" >/dev/null || {
    echo "RED: created ruleset does not match CGEV11 contract." >&2; exit 51;
  }

  jq -e '
    any(.[]?; .type == "pull_request") and
    any(.[]?; .type == "non_fast_forward") and
    any(.[]?; .type == "deletion") and
    any(.[]?;
      .type == "required_status_checks" and
      any(.parameters.required_status_checks[]?; .context == "complete" and .integration_id == 15368) and
      any(.parameters.required_status_checks[]?; .context == "stack-complete" and .integration_id == 15368)
    )
  ' "$EVIDENCE_DIR/effective-main-rules.after.json" >/dev/null || {
    echo "RED: effective main rules do not expose the required CGEV11 policy." >&2; exit 52;
  }

  sha256_dir after
  echo "verify PASS: effective main governance satisfies ROT-130 template."
  echo "Next: persist evidence pointers to GitHub #122 + Linear ROT-130, then re-evaluate ROT-87. Do not auto-merge #119."
}

case "$MODE" in
  snapshot) snapshot ;;
  probe) probe ;;
  apply) apply_main ;;
  verify) verify ;;
  *)
    cat >&2 <<USAGE
Usage: $0 {snapshot|probe|apply|verify}

Required:
  GITHUB_TOKEN       admin-capable repository Administration:write token

Probe additionally requires:
  GITHUB_PROBE_TOKEN normal non-bypass writer token (must differ from GITHUB_TOKEN)

Apply additionally requires:
  CONFIRM_MAIN_APPLY=YES
USAGE
    exit 64
    ;;
esac

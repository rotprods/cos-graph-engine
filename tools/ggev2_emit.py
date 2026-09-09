#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone

ALLOWED = {"BOOT", "CLAIM", "HEARTBEAT", "EVIDENCE", "PREFLIGHT", "HANDOFF"}


def main() -> int:
    p = argparse.ArgumentParser(description="Emit one GGEV2 observation record to stdout. Observation only; grants no authority.")
    p.add_argument("event_type", choices=sorted(ALLOWED))
    p.add_argument("--agent-id", required=True)
    p.add_argument("--session-id", required=True)
    p.add_argument("--project-id", required=True)
    p.add_argument("--objective-id", required=True)
    p.add_argument("--workstream-id", required=True)
    p.add_argument("--repo", default="rotprods/cos-graph-engine")
    p.add_argument("--branch", required=True)
    p.add_argument("--head-sha", required=True)
    p.add_argument("--watermark", type=int, default=0)
    p.add_argument("--claim-id")
    p.add_argument("--fencing-generation", type=int)
    p.add_argument("--next-action")
    p.add_argument("--resource-scope", action="append", default=[])
    p.add_argument("--semantic-scope", action="append", default=[])
    p.add_argument("--evidence-id", action="append", default=[])
    args = p.parse_args()

    if len(args.head_sha) != 40 or any(c not in "0123456789abcdef" for c in args.head_sha):
        raise SystemExit("head-sha must be full lowercase 40-char SHA")
    if args.watermark < 0:
        raise SystemExit("watermark must be non-negative")
    if args.event_type == "CLAIM" and (not args.claim_id or args.fencing_generation is None):
        raise SystemExit("CLAIM requires --claim-id and --fencing-generation")
    if args.event_type == "HANDOFF" and not args.next_action:
        raise SystemExit("HANDOFF requires --next-action")

    event = {
        "schema_version": "1",
        "authority": "OBSERVATION_ONLY",
        "event_type": args.event_type,
        "agent_id": args.agent_id,
        "session_id": args.session_id,
        "project_id": args.project_id,
        "objective_id": args.objective_id,
        "workstream_id": args.workstream_id,
        "repo": args.repo,
        "branch": args.branch,
        "head_sha": args.head_sha,
        "event_watermark": args.watermark,
        "resource_scopes": sorted(set(args.resource_scope)),
        "semantic_scopes": sorted(set(args.semantic_scope)),
        "evidence_ids": sorted(set(args.evidence_id)),
        "observed_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    if args.claim_id:
        event["claim_id"] = args.claim_id
    if args.fencing_generation is not None:
        event["fencing_generation"] = args.fencing_generation
    if args.next_action:
        event["next_action"] = args.next_action

    json.dump(event, sys.stdout, sort_keys=True, separators=(",", ":"))
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

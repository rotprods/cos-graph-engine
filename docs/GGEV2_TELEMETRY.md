# GGEV2 telemetry bridge

Authority: OBSERVATION_ONLY

`tools/ggev2_emit.py` emits GGEV2 `BOOT`, `CLAIM`, `HEARTBEAT`, `EVIDENCE`, `PREFLIGHT`, and `HANDOFF` observation records.

This bridge does not modify COS graph authority, `.loop/state.json`, graph reducers, workflows, or canonical claim/event semantics. GGEV2 is a derived observer.

Required invariants:

- unique session identity
- full 40-character Git SHA
- monotonic watermark
- CLAIM must include claim ID and fencing generation
- stale heads remain visible; they are never silently rewritten
- observation cannot grant ownership/promotion authority

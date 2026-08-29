# COS V2 Operational Control Plane

Authority: `LIVE_GITHUB` for executable state; this directory is the machine-readable coordination projection.

Current session: `ses_b3bead3c-97e0-460c-b413-fd0d14fab81d`  
Current claim: `claim_24f132dd-8804-4066-b6c8-5b06aa36461c`  
Base revision: `789edef87549d4f173de03f73e54f5b6193c2e98`  
Event watermark: `1`  
Projection revision: `1`  
ContextPack revision: `1`

## Rules

1. `events/events.ndjson` is append-only.
2. A session and claim must exist before material mutation.
3. Claims never imply authority beyond their declared ceiling.
4. `state/live-truth.json` records observed repository truth and explicit unknowns.
5. `state/context-pack.json` is acceleration only; live GitHub must be re-read before mutation.
6. Unknown active agents/claims are represented as uncertainty, not silently treated as absent.
7. Runtime code is outside this first control-plane claim.
8. No score or verification status changes without executed evidence.

## Validation

A validator and graph compiler will be added in the next atomic change. Until then this bootstrap commit is `PROPOSED_CONTROL_PLANE / UNVERIFIED`.

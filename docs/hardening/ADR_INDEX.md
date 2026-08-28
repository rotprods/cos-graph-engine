# COS Hardening ADR Index

Normative decisions for the 10/10 Authority Program:

| ADR | Decision | Status |
|---|---|---|
| ADR-001 | One authority write owner per capability | ACCEPTED_FOR_HARDENING |
| ADR-002 | Append-only valid-time/system-time history | ACCEPTED_FOR_HARDENING |
| ADR-003 | Replay recorded outcomes, not historical commands | ACCEPTED_FOR_HARDENING |
| ADR-004 | No exactly-once side-effect claim without durable protocol | ACCEPTED_FOR_HARDENING |
| ADR-005 | Legacy test evidence immutable; authority tests additive | ACCEPTED_FOR_HARDENING |
| ADR-006 | Manual CI changes invocation cost, not verification breadth | ACCEPTED_FOR_HARDENING |

Files:

- `adrs/ADR-001-SINGLE-AUTHORITY-OWNER.md`
- `adrs/ADR-002-BITEMPORAL-APPEND-ONLY.md`
- `adrs/ADR-003-OUTCOME-SOURCED-REPLAY.md`
- `adrs/ADR-004-SIDE-EFFECT-DELIVERY-SEMANTICS.md`
- `adrs/ADR-005-TEST-EVIDENCE-PRESERVATION.md`
- `adrs/ADR-006-MANUAL-CI-FULL-BREADTH.md`

## Change rule

An accepted ADR is not reversed in place. A new ADR must explicitly supersede it and state evidence, migration, failure-mode delta and rollback.

ADR acceptance is architecture evidence, not runtime Assurance.

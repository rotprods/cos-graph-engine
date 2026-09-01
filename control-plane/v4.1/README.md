# COS Repository Assurance V4.1 — Executable Contract Kernel

> Current contract: `4.1.0-alpha.3`
> Status: TARGETED_PASS
> Authority ceiling: SHADOW_ONLY
> Parent: PR #58 exact head `7578c5827b46d6ca6f1ac8258f706af546723e2b`
> Scope: control-plane contracts only; no runtime/package-root/deployment mutation

## Purpose

V4.1 converts the core laws of `/REPO-PERFECTION-GAUNTLET-V4` from prose into deterministic machine contracts before the V5 repository compiler exists.

This slice deliberately does **not** implement repository ingestion, graphification, autonomous repair, provider mutation, production authority, deployment, or portfolio-wide behavior.

## Current contract surface

The current alpha.3 kernel freezes:

1. authority lattice and explicit uncertainty;
2. state machines for Defect, Evidence, Candidate and ClaimLease;
3. exact-SHA evidence qualification rules;
4. typed evidence kinds for promotion gates;
5. candidate identity-only promotion requests;
6. P0/P1 blockers derived from a typed `DEFECT_INVENTORY` evidence surface;
7. canonical evidence-strength ordering;
8. conjunctive promotion eligibility.

The current machine-readable model is `model/contracts.v3.json` and the executable validator is `scripts/validate-v4.1-contract-kernel.mjs`.

## Hard laws

- `UNKNOWN` never silently becomes `PASS`.
- `IMPLEMENTED_UNVERIFIED` never skips directly to authority.
- PASS-like evidence requires an exact 40-hex candidate SHA.
- evidence for SHA A cannot qualify SHA B.
- invalidated/superseded evidence remains historical but cannot qualify a candidate.
- the promotion request may contain only candidate identity; it cannot self-attest gates or defect counts.
- open P0 or P1 evidence blocks promotion.
- required checks, security, cleanroom and authority consistency require typed executed EvidencePackets.
- evidence-strength ordering is canonical and itself validated.
- aggregate scores cannot override a failed hard gate.
- projection state cannot assign canonical authority.
- promotion is conjunctive, not averaged.

## Contract evolution during review

### alpha.1
Targeted 19/19 self-test PASS, then superseded after review found that declarative candidate cleanroom state could outrank weaker evidence.

### alpha.2
Moved checks/security/cleanroom/authority-consistency to typed evidence, but was **not qualified**: independent review found that `openP0/openP1` were still candidate-supplied.

### alpha.3 — current
Candidate input is SHA-only. Defect blockers and all other hard promotion gates are evidence-derived. The exact published model/validator blobs match the locally executed bytes and the adversarial corpus passes 27/27.

Current evidence:

`evidence/contract-kernel/EVIDENCE_PACKET_V3.json`

Earlier evidence is preserved as historical provenance and does not outrank alpha.3.

## Proof boundary

`TARGETED_PASS / SHADOW_ONLY` proves only the V4.1 alpha.3 contract model and validator at the recorded exact implementation SHA.

It does **not** prove:

- discovery completeness of a real repository DefectGraph;
- cryptographic authenticity of future EvidencePackets;
- full COS runtime/build/test correctness;
- runtime hardening PRs #59 onward;
- real PostgreSQL/provider behavior;
- concurrency, recovery or deployment isolation;
- production readiness or main authority.

The next bounded slice is typed Observation/Event/Evidence receipt schemas with integrity and explicit supersession. V6 remains the independent authority verifier boundary.

## Lineage rule

This branch is a control-plane child of PR #58. Runtime qualification work in PR #59 onward, including the T0502/T0502D line, remains an independent lane and is not imported or overwritten here.

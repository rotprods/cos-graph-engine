# COS Repository Assurance V4.1 — Executable Contract Kernel

> Status: IMPLEMENTED_UNVERIFIED
> Authority ceiling: SHADOW_ONLY
> Parent: PR #58 exact head `7578c5827b46d6ca6f1ac8258f706af546723e2b`
> Scope: control-plane contracts only; no runtime/package-root/deployment mutation

## Purpose

V4.1 converts the core laws of `/REPO-PERFECTION-GAUNTLET-V4` from prose into deterministic machine contracts before the V5 repository compiler exists.

This slice deliberately does **not** implement repository ingestion, graphification, autonomous repair, provider mutation, production authority, deployment, or portfolio-wide behavior.

## Contract surface

The first kernel freezes four deterministic surfaces:

1. authority lattice and explicit uncertainty;
2. state machines for Defect, Evidence, Candidate and ClaimLease;
3. exact-SHA evidence qualification rules;
4. conjunctive promotion eligibility.

The machine-readable model is `model/contracts.v1.json` and the executable validator is `scripts/validate-v4.1-contract-kernel.mjs`.

## Hard laws

- `UNKNOWN` never silently becomes `PASS`.
- `IMPLEMENTED_UNVERIFIED` never skips directly to authority.
- PASS-like evidence requires an exact 40-hex candidate SHA.
- evidence for SHA A cannot qualify SHA B.
- invalidated/superseded evidence remains historical but cannot qualify a candidate.
- open P0 or P1 blocks promotion.
- aggregate scores cannot override a failed hard gate.
- projection state cannot assign canonical authority.
- promotion is conjunctive, not averaged.

## Proof boundary

Until exact-source execution is recorded, this slice remains `IMPLEMENTED_UNVERIFIED / SHADOW_ONLY`.

Even after targeted PASS it will prove only the V4.1 contract kernel. It will not prove the COS runtime, full repository test suite, real PostgreSQL, provider behavior, deployment, security isolation, recovery, or production readiness.

## Lineage rule

This branch is a control-plane child of PR #58. Runtime qualification work in PR #59 onward, including the T0502/T0502D line, remains an independent lane and is not imported or overwritten here.

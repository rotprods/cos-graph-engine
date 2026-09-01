# Fiscal Runtime Merge Gates

This branch must not be merged on documentation confidence alone.

## G1 — CI infrastructure
- repository workflow root-path issue #71 fixed;
- setup-node resolves package-lock;
- npm ci runs;
- tests reach execution steps.

## G2 — Unit correctness
- fiscal event chain test passes;
- identity alias collision test passes;
- L1/L3 projection test passes;
- unsafe L2 state promotions are rejected;
- valid evidence transitions pass.

## G3 — Architectural boundaries
- no personal fiscal evidence committed;
- no secrets/credentials;
- no LangChain/CrewAI canonical dependency;
- Drive/AEAT authority semantics preserved.

## G4 — Adversarial questions
- Can PREPARED become FILED with a spreadsheet/template? Must be NO.
- Can a payment letter become PAID? Must be NO.
- Can an unknown blocker silently disappear? Must be NO.
- Can dependency cycles be accepted? Must be NO.
- Can replay detect event tampering? Must be YES.
- Can an alias collision merge two legal entities? Must be NO.

## G5 — Integration
After PR #70 is available, the runtime files should be exported alongside the 20D profile from `@cos/graph` with no duplicate profile semantics.

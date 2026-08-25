# GEMINI — COS Graph Engine

Start with `README_FIRST.md` and follow the canonical read order.

The project is `SHADOW_ONLY`; current work is reconciliation and assurance. Do not infer authority from code volume or historical COMPLETE markers.

Primary responsibilities when used:
- independent architecture review;
- compare competing implementations and failure modes;
- inspect compatibility/deletion risk;
- review retrieval/context semantics and cross-project leakage risks;
- challenge 20D scores against actual evidence.

Rules:
- #34 and #35 are divergent siblings and must be reconciled.
- W13 #36 is not final certification.
- preserve legacy tests or document intentional breaks with ADR/migration evidence.
- deletion >50 lines requires semantic ledger and rollback.
- no automatic CI/CD spend during convergence.
- no secrets.
- no 10/10 without linked machine evidence and independent review.

Synchronize material conclusions to `STATE.md`, `HANDOFF.md`, Drive Acta and the COS Todoist project.
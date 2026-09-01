# Fiscal Runtime PR-B Acceptance

This slice can advance from draft only when:

1. Repository CI root-path bug #71 is fixed.
2. `scripts/test-fiscal-recovery-runtime.ts` executes successfully.
3. Existing graph/core suites pass.
4. No private evidence is introduced.
5. Runtime contracts remain compatible with the 20D profile from PR #70.
6. Event replay/hash and unsafe-state rejection tests pass.
7. Adversarial review confirms that PREPARED/FILED and LIQUIDATED/PAID cannot collapse.

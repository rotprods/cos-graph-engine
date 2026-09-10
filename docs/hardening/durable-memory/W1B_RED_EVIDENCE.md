# W1B Durable Memory — Exact RED Evidence

Status: `RED_PARENT_DEFECTS_REPRODUCED`

## Authority

- Implementation parent: `d0d63a665a7b89205c76145a4b669a2f12866500` (PR #105 exact head).
- W1B claim commit: `5b6f3eca928a9a69c9d94db21a441058b4ff1661`.
- RED harness cleanup head: `7a9a3e8ea63af667276b7f1d84e2e62fcb3d25a0`.
- Production source mutation before RED: **none**.

## Exact GitHub Actions receipt

- Workflow: `Durable Memory W1B`
- Run: `34507930614`
- Job: `102974589596`
- Exact checkout/head: `7a9a3e8ea63af667276b7f1d84e2e62fcb3d25a0`
- `npm ci --ignore-scripts --no-audit --no-fund`: **PASS**
- `npx --no-install tsc --noEmit`: **PASS**
- W1B durability contract: **FAIL as expected**
- Evidence artifact: `10164582452`
- Artifact digest: `sha256:37803342bc4043d279a4724aa60f5d3f50983e5b5eba3f349485980896749cee`

The first RED run (`34507520089`) also exposed a pending autosave that could throw after a test temp directory disappeared. The harness was then corrected to clean up legacy timers even when an assertion fails, and the second run reproduced the product defects without that test-harness contamination.

## Reproduced defect families

1. **Restart authority missing** — persisted memory entries do not survive reconstruction.
2. **Malformed JSON is swallowed** — parse corruption is misclassified as a missing file.
3. **Unknown snapshot schema is swallowed/accepted** — no fail-closed schema contract exists.
4. **Torn-write replacement** — direct write to the authority path can replace known-good bytes with partial JSON before the write fails.
5. **No explicit lifecycle** — `FileBackedMemory.flush()` / `dispose()` do not exist.
6. **Referenced dirty timer** — a pending autosave keeps the process alive.
7. **Persistent server is not using durable memory authority** — autonomous goal memory does not survive reconstruction.
8. **Wrapper shutdown is incomplete** — `PersistentCOSSERVER.shutdown()` does not delegate to the underlying `COSServer.shutdown()` and is not an idempotent full runtime shutdown.

The missing-file case itself passed and remains the one expected normal `false` return from `PersistenceManager.load()`.

## Tests that become reachable after repair

The restart suite also asserts that restored access telemetry is deterministic: after persistence, the next retrieve must increment from the saved `accessCount` and must not regress `lastAccessed`. The current implementation cannot reach that assertion because the entry disappears entirely.

## Next permitted mutation

Proceed to W1B.2 minimal source repair only. Do not broaden into W1C sandbox security or unrelated DI/runtime refactors.

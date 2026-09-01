# Fiscal Runtime Test Matrix

| Test | Expected |
|---|---|
| Event append order | strictly increasing sequence |
| Event replay | identical checkpoint hash |
| Tampered event | hash-chain verification error |
| Duplicate event ID | rejected |
| Canonical alias collision | rejected |
| Unknown task dependency | rejected |
| Dependency cycle | rejected |
| L1 blocker ordering | blocker precedes task |
| PREPARED -> FILED via derived summary | rejected |
| PREPARED -> FILED via official receipt | allowed |
| Payment letter -> PAID | rejected |
| Bank settlement -> PAID | allowed |
| Invoice rectify without evidence | rejected |
| Evidence authoritative promotion without source | rejected |

CI execution is blocked by repository workflow issue #71 until the root-path configuration is fixed.

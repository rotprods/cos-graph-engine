# Fiscal / Financial COS 20D — Adversarial Gauntlet

The system may not be labelled `COS_20D_MOUNTED` until these questions are answered with executable evidence/tests, not prose.

## Authority / truth
1. Can a blank template ever become FILED?
2. Can a prepared return become FILED without authority receipt?
3. Can a payment letter become PAID without settlement proof?
4. Can adviser correspondence outrank an official filed artifact?
5. Can a reconstructed ledger silently overwrite a filed return?
6. Can absence in Gmail be interpreted as non-existence?
7. Can a hypothesis node be returned as CONFIRMED?
8. Can a stale official rule answer a later valid-at query?
9. Can a corrected invoice erase the original evidence?
10. Can contradictory evidence be hidden by re-ranking?

## Identity / provenance
11. Can two taxpayers merge through a shared display name?
12. Can a brand and legal entity collapse into one node without evidence?
13. Can an invoice number collide across series/years/entities?
14. Can one email alias bind to two canonical counterparties silently?
15. Can source filename become canonical identity?
16. Can graph import create dangling evidence edges?
17. Can a source URI change without retaining old provenance?
18. Can one evidence artifact be assigned to the wrong tax year silently?
19. Can duplicated PDF content be double-counted?
20. Can an entity-resolution change be replayed and audited?

## Temporal correctness
21. Are event time and observed time distinct?
22. Can late-arriving evidence rewrite historical state silently?
23. Can GraphQL filter truth at a historical valid-at timestamp?
24. Can a superseded rule be selected for a later period?
25. Can filed-at and paid-at be conflated?
26. Can a deadline node survive law/version changes?
27. Are tax-lot acquisition dates immutable under projection rebuild?
28. Can a timezone conversion move an event into another tax period?
29. Does replay preserve original observation order?
30. Can a future-dated fact appear in a past context pack?

## Execution / workflow
31. Can a blocked P0 task execute before its blocker closes?
32. Can an unknown dependency silently disappear?
33. Can L3 cycles be accepted?
34. Can a workflow step be executed twice without idempotency protection?
35. Can retries create duplicate filing/payment events?
36. Can a failed external write be marked successful?
37. Can quarterly close bypass independent QA?
38. Can quarterly close bypass human adviser gate?
39. Can quarterly close bypass owner external-write approval?
40. Can connector outage destroy the execution frontier?

## Tool fabric
41. Can an unavailable authority connector be selected?
42. Can a read-only tool perform a write?
43. Can a write occur without human approval?
44. Can restricted financial data leak into an INTERNAL context?
45. Can tool schema drift occur without hash/version change?
46. Is fallback selection observable?
47. Can a degraded connector masquerade as healthy?
48. Can a web research tool become fiscal authority?
49. Can GitHub become evidence authority for a tax filing?
50. Can an external agent adapter alter tool permissions?

## GraphQL
51. Is the fiscal GraphQL gateway read-only for legal truth?
52. Can generic addNode/addEdge mutate fiscal truth through the gateway?
53. Can GraphQL filter by tax year/period/valid-at/sensitivity?
54. Can evidence traversal return supporting artifacts?
55. Can blocker traversal explain why a task/obligation is unresolved?
56. Can one query mix entities from the wrong taxpayer namespace?
57. Are pagination/order semantics deterministic?
58. Are read results consistent with event replay projections?
59. Are sensitive properties redacted for lower-clearance clients?
60. Can a stale projection disagree with canonical replay without alerting?

## GraphRAG
61. Does FILED_STATUS reject template/prepared evidence?
62. Does PAYMENT_STATUS reject payment letters/instructions?
63. Is retrieval confidence separate from truth confidence?
64. Are evidence paths returned?
65. Are contradictions surfaced?
66. Are canonical entity IDs used in graph-overlap scoring?
67. Can old/out-of-validity evidence be filtered?
68. Can sensitivity clearance filter chunks?
69. Can an official but semantically lower-ranked chunk survive finalTopK?
70. Does no official evidence yield answerable=false for authority-gated intents?

## Compute / accounting
71. Are money calculations represented as integer cents or exact decimal?
72. Can floating-point rounding change a tax result?
73. Can invoice base+VAT-withholding be replayed deterministically?
74. Can a transfer be mistaken for a crypto disposal?
75. Is global FIFO blocked until all providers are inventoried?
76. Can one provider's FIFO become national final tax truth?
77. Can a bank charge become deductible without invoice/business nexus?
78. Can reverse-charge VAT be applied without supplier/place-of-supply facts?
79. Can a cancelled invoice remain in active revenue totals?
80. Can debt principal/surcharge/interest be conflated?

## Memory / recovery
81. Can STATE/HANDOFF be rebuilt from graph/events?
82. Does every session produce a checkpoint?
83. Does checkpoint include evidence/task/risk deltas?
84. Can an agent recover without chat history?
85. Can an expired chat attachment break continuity if Drive evidence exists?
86. Is raw evidence authority distinct from memory projection?
87. Can memory TTL/decay ever delete legal evidence references?
88. Can a failed session leave no heartbeat/checkpoint?
89. Does zero-context recovery identify authoritative vs mirror systems?
90. Does recovery identify assumptions that must not be treated as truth?

## Domain projections / security / release
91. Does L17 preserve legal-entity vs person identity?
92. Does L18 avoid falsely mapping tax rules to biological entities?
93. Does L19 avoid falsely mapping invoices/tax lots to molecular semantics?
94. Can provider topology detect single points of failure?
95. Is raw PII excluded from public kernel repositories?
96. Are secrets/certificates/2FA excluded from graphs/events?
97. Can LangChain/LangGraph/CrewAI memory override COS state? Must be NO.
98. Does every external framework result enter as observation requiring validation?
99. Can all projections rebuild deterministically from events + evidence registry?
100. Is there a green full CI + fiscal-specific suite + independent adversarial review before `COS_20D_MOUNTED`?

# COS Security Architecture

## Governance Model

Policy-as-code with RBAC. Every CogCell has permissions. Every action is evaluated against policies before execution.

## Policy Engine

- **Rules** — Named policies with effect (allow/deny/require_approval)
- **Actions** — What operation is being performed
- **Resources** — What system component is being accessed
- **Conditions** — Context-based constraints (userId, session, time)
- **Priority** — Highest priority rule wins

## Permission Model

| Permission | Scope |
|------------|-------|
| `read` | View state, memory, configuration |
| `write` | Modify state, memory, configuration |
| `execute` | Run tools, process input |
| `admin` | Manage cells, policies, agents |
| `deny` | Explicit prohibition |

## Security Layers

1. **Authentication** — Identity verification at API boundary
2. **Authorization** — Policy evaluation per action
3. **Encryption** — Data at rest and in transit
4. **Secrets** — External secret store integration
5. **Audit** — Immutable event log of all policy decisions
6. **Budget** — Per-cell/per-user resource limits
7. **Sandbox** — Isolated code execution environment
8. **Human Approval** — Gates for high-risk operations

## Audit Trail

Every policy evaluation produces a structured event:
- Timestamp, action, resource, user, decision
- Matched rules with reasons
- Full context trace

All audit events are stored in the telemetry system with configurable retention.
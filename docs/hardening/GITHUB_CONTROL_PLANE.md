# GitHub Control Plane — ChatGPT / Agent Runtime

## Purpose
Define the operations that authorized agents can perform directly against GitHub from the conversational control plane, and the boundary between repository mutation and executable verification.

## Directly available from ChatGPT

### Repository discovery and inspection
- read repository metadata and permissions
- enumerate repositories/installations/accounts
- search code, files, branches, commits, issues and PRs
- fetch files, blobs, commits, PR patches/diffs and discussion threads
- compare refs/commits

### Git data and code mutation
- create branches from refs/SHAs
- create/update/delete text files
- create blobs
- create trees
- create commits with one or multiple parents
- advance branch refs (non-force by default)

### Issues and project operations
- create/update/close/reopen issues
- labels and assignees
- issue/PR comments and reactions
- lock/unlock conversations

### Pull requests
- open/update/close/reopen PRs
- draft <-> ready transitions
- inspect changed files and patches
- submit reviews: COMMENT / APPROVE / REQUEST_CHANGES
- inline review comments, replies and thread resolution
- request/remove reviewers
- enable auto-merge
- merge with expected-head protection

### GitHub Actions / CI observability and recovery
- inspect commit status
- inspect workflow runs associated with commits when available
- inspect workflow jobs and individual steps
- fetch decoded job logs
- list/download workflow artifacts
- re-run failed jobs
- re-run individual jobs

## Important boundary
The GitHub connector does not expose an arbitrary shell on a checked-out repository. Therefore:

1. ChatGPT can write the code/workflows directly.
2. GitHub Actions can execute install/build/test/replay/benchmark commands after commits/PR events.
3. ChatGPT can inspect the resulting jobs/logs/artifacts and patch the branch again.
4. Codex remains useful when long interactive repo-local execution is more efficient, but it is no longer required merely to create branches, commits or PRs.

## Canonical loop

DEFINE (/leydekidlin)
-> OWN (/leydegilbert)
-> MODEL FAILURE (/complexsystems)
-> READ BASE SHA
-> CREATE/USE BRANCH
-> APPLY SMALLEST REVERSIBLE DIFF
-> PUSH COMMIT
-> OBSERVE ACTIONS
-> READ FAILED JOB/LOG
-> PATCH
-> RE-RUN / NEW COMMIT
-> ADVERSARIAL PR REVIEW
-> MERGE WITH expected_head_sha
-> UPDATE STATE/HANDOFF

## Safety rules
- never push feature/hardening changes directly to `main`
- default to draft PR until machine evidence passes
- do not merge based only on model confidence
- use expected head SHA for merge
- do not force-update refs unless recovery explicitly requires it
- no hidden failing command may be converted to green with `|| true`, `|| echo`, or `continue-on-error` for required guarantees
- prefer separate shadow workflows before replacing production CI
- every material PR maps to one or more falsifiable guarantees
- zero recurring infrastructure cost remains a hard constraint

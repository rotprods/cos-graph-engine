---
name: visual-brand-system
description: Turn an idea plus a project brand system into a reproducible carousel or visual output while preserving identity, exact copy, and design invariants. Use when creating, adapting, QA, or scaling branded visual content from DESIGN.md.
source_repo: rotprods/viral-carrousels-
source_path: skills/visual-brand-system/SKILL.md
---

# Visual Brand System Skill

## Purpose
Turn an idea plus a project brand system into a reproducible carousel/output while preserving identity, exact copy and design invariants.

## Activation
Use when the task asks to create, adapt, QA or scale branded visual content from `DESIGN.md`.

## Required inputs
- `visual-dna.json` — observations/evidence.
- `DESIGN.md` — operational decisions.
- idea / objective / audience / format.

## Optional inputs
- identity image or Higgsfield Element.
- REF_LAYOUT / REF_TYPE / REF_IMAGE / REF_DETAIL.
- approved examples.

## Workflow
1. Validate inputs.
2. Read `DESIGN.md`; never invent unsupported brand rules.
3. Choose or recommend a template family.
4. Generate angle + hook + storyboard.
5. Produce exact-copy visual prompts.
6. QA identity, copy, hierarchy, composition, mobile legibility and reject rules.
7. If rejected, change one variable at a time.
8. Learn only from approved outputs and propose a minimal DESIGN/SKILL patch.

## Output contract
Return:
- selected template
- hook
- storyboard
- generation prompts
- QA score
- PASS / FAIL
- next action

## Reject conditions
Reject if the output changes exact copy, mixes brand identities, copies a reference literally, violates DESIGN.md invariants, hides critical information or is unreadable on the target format.

## Learning policy
Only learn from approved outputs. Rejected outputs are negative examples, not new style rules.

## Versioning
Every accepted rule change increments the version and is logged in `CHANGELOG.md`.

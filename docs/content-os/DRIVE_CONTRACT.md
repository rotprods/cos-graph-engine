# ROT Viral Content Engine — Google Drive Contract

## Purpose
Drive is the durable human/media corpus and cross-chat memory plane. It is not executable truth and must not be used as an implicit database.

## Canonical folder structure

00_CONTROL/
- NORTH_STAR
- STATE
- HANDOFF
- DRIVE_INDEX
- DATA_DICTIONARY

01_BRAND_IDENTITY/
- voice
- positioning
- visual systems
- account strategies
- brand rules

02_AUDIENCES/
- audience profiles
- pains/desires
- language patterns
- platform behavior

03_OFFERS/
- products
- services
- lead magnets
- funnels

04_RAW_SIGNALS/
- screenshots
- notes
- links
- transcripts
- raw ideas
- trend captures

05_RESEARCH/
- source packs
- competitor research
- news verification
- model/tool research

06_PROOF_BANK/
- client cases
- own projects
- screenshots/results
- before-after
- demos

07_SCRIPTS/
- drafts
- approved
- published snapshots

08_VISUAL_REFERENCES/
- thumbnails
- carousels
- reels
- shot references
- visual patterns

09_PUBLISHED/
- master exports
- platform-specific exports
- captions
- publication receipts

10_ANALYTICS/
- platform exports
- periodic snapshots
- derived reports

11_EXPERIMENTS/
- hypotheses
- variants
- result packs

12_HANDOFFS/
- session handoffs
- operator notes
- audit reports

99_ARCHIVE/

## Canonical IDs
Every material asset receives a stable application-level asset_id independent from filename.
Format recommendation:
asset:<domain>:<ulid>

Examples:
asset:proof:01J...
asset:video:01J...
asset:research:01J...

Drive file ID and URL are provider locators, not domain identity.

## Required metadata record
For each indexed asset:
- asset_id
- drive_file_id
- drive_url
- title
- mime_type
- category
- project
- account
- sensitivity
- created_at
- observed_at
- source_actor
- source_context
- content_hash when obtainable
- supersedes_asset_id optional
- status

## Sensitivity
PUBLIC
INTERNAL
CLIENT_CONFIDENTIAL
PRIVATE
RESTRICTED

Retrieval must filter by sensitivity before context reaches a generation agent.

## Naming convention
Human filenames should remain readable:
YYYY-MM-DD__PROJECT__TYPE__SHORT-DESCRIPTION__vNN.ext

The machine must never depend on filename parsing for identity.

## Provenance rules
1. Raw assets remain immutable where practical.
2. Edited/exported assets create new asset IDs linked by DERIVED_FROM.
3. Research documents list source URLs/IDs and observation date.
4. Published artifacts retain exact script/caption/version references.
5. Analytics exports are append-only snapshots with capture timestamp.

## Drive ingestion workflow
NEW FILE → classify → assign asset_id → sensitivity → hash/metadata → link to project/content → index → optional COS projection.

## Handoff contract
STATE and HANDOFF documents summarize current operational truth but cannot override Git/database executable truth. Conflicts must be surfaced explicitly.

## Anti-patterns
- no secrets/API keys
- no silent overwrite of evidence
- no using a folder name as a primary key
- no private client content in public generation context
- no graph-only asset references without underlying Drive/database provenance

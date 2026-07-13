# Botanical tree renderer backup

Created during migration to the approved reference design (`/family-tree`).

## Contents

- `FamilyTreePage.tsx.bak` — previous page that mounted `BotanicalTreeCanvas`
- `components-tree/` — full copy of `src/components/tree/` as of backup date

## Restore

To restore the botanical renderer on `/family-tree`:

1. Copy `FamilyTreePage.tsx.bak` → `src/pages/FamilyTreePage.tsx`
2. Original tree components remain at `src/components/tree/` (unchanged)

## Note

This backup preserves the prior implementation. The live `/family-tree` route now uses
`src/components/reference-tree/` instead.

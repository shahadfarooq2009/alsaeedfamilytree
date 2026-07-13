# Botanical tree renderer backup

Created during migration to the approved reference design (`/family-tree`).

## Contents

- `FamilyTreePage.tsx.bak` — previous page that mounted `BotanicalTreeCanvas`
- `components-tree/` — full copy of `src/components/tree/` as of backup date

## Locations

- **Primary mirror (build-safe):** `frontend/_backup/botanical-tree-renderer/`
- **In-repo copy:** `frontend/src/_backup/botanical-tree-renderer/` (excluded from TypeScript via `tsconfig.app.json`)

Original tree components remain at `src/components/tree/` (unchanged).

## Restore

Copy `FamilyTreePage.tsx.bak` → `src/pages/FamilyTreePage.tsx` and remount `BotanicalTreeCanvas`.

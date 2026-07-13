# Botanical Family Tree View — Current Structure

This document describes the current implementation of the "botanical" (real tree-shaped)
family tree view: an alternative to the card/diagram tree that renders the family as an
oak-like tree with a trunk, growing branches, and leaf/founder nodes.

It exists in two integration points:

1. **Standalone map page** — `/family-tree-map/:familyId?` (`FamilyTreeMapPage`), which
   renders `FamilyTreeMap` with a toggle between "diagram" and "tree" (botanical) view.
2. **Overlay inside the main reference tree** — `ReferenceTreeApp` renders the
   floating `reference-view-toggle` switch (bottom-left) that opens `BotanicalTreeView`
   as a full-screen overlay on top of the normal card-based tree.

## File Map

```
src/
├── pages/
│   └── FamilyTreeMapPage.tsx           # Route wrapper: loads members, feeds FamilyTreeMap
├── components/
│   ├── family-tree-map/
│   │   ├── FamilyTreeMap.tsx           # Full page component: diagram view + tree view + toolbar
│   │   ├── BotanicalTreeView.tsx       # Self-contained pan/zoom botanical tree (used as overlay)
│   │   └── FamilyTreeMap.css           # Styling for both diagram cards and botanical tree/leaves
│   └── reference-tree/
│       └── ReferenceTreeApp.tsx        # Hosts the "شجرة حقيقية" toggle + <BotanicalTreeView> overlay
├── hooks/
│   └── useFamilyTreeMembers.ts         # Fetches family + tree + people from the API
├── utils/
│   ├── buildBotanicalTreeLayout.ts     # Core layout algorithm (positions, branch paths, thickness)
│   ├── familyMembersToMapPeople.ts     # Adapts API FamilyMemberInput[] -> FamilyTreeMapPerson[]
│   └── generateReference81People.ts    # Demo/preview data generator (81-member reference tree)
└── data/
    └── reference81TreeSpec.ts          # Static names/counts used by the demo generator
```

## Data Model

Everything downstream of the API consumes a flat, minimal shape:

```ts
interface FamilyTreeMapPerson {
  id: number;
  name: string;
  parentId: number | null;   // null => root/founder
  childrenCount?: number;
}
```

`familyMembersToMapPeople(members)` builds this from the richer `FamilyMemberInput[]`
(the same members used by the main reference tree) by:

- Resolving each member's **primary tree parent** via `buildPrimaryTreeParentMap` (handles
  spouses/multiple-parent edge cases so the botanical tree only ever draws one parent edge
  per person).
- Using only the person's **first name** (`getMemberFirstName`) as the display label, since
  leaf/founder chips are small.
- Counting children per parent for the diagram view's "أبناء: N" badge.

For the standalone demo/preview (`demoFallback` on `FamilyTreeMap`, or no real data yet),
`generateReference81People()` builds a fixed 81-person, 5-generation tree from
`reference81TreeSpec.ts` (branch names + per-generation child counts), independent of the API.

## Layout Algorithm — `buildBotanicalTreeLayout.ts`

Given `FamilyTreeMapPerson[]`, produces a `BotanicalLayout`:

```ts
interface BotanicalLayout {
  nodes: BotanicalNode[];      // { id, name, parentId, depth, x, y, subtreeSize, childrenCount, isRoot, isLeaf }
  branches: BotanicalBranch[]; // { id, path (SVG "M..C.."), thickness, depth }
  width: number;
  height: number;
  maxDepth: number;
}
```

Algorithm (tidy / Reingold–Tilford style, deterministic):

1. **Build forest** — turn the flat list into parent→children trees (`buildForest`), and
   measure `subtreeSize` for every node (used later for branch thickness).
2. **Place nodes** — depth-first `place()` walk:
   - Leaves get sequential horizontal slots (`LEAF_SLOT = 138px` apart), so leaves can
     never overlap.
   - Internal (parent) nodes are centered over the midpoint of their first/last child, so
     branches fan out symmetrically without crossing siblings.
3. **Assign rows** — `yForDepth(depth) = (maxDepth - depth) * ROW_HEIGHT`. The founder
   (depth 0) is anchored at the **bottom** (largest y) and the canopy grows **upward** as
   depth increases — the opposite of a typical top-down org chart, to feel like a real tree.
4. **Emit nodes + branches** — for every parent→child pair, build a curved SVG path
   (`branchPath`) with two control points that hug the parent's x then the child's x at the
   vertical midpoint, plus a small deterministic horizontal "sway" (seeded per-child via
   `jitterFor(id)`) so branches look organic rather than mechanical right angles.
5. **Branch thickness** — `thicknessFor(subtreeSize, rootSize)` scales thickness with
   `sqrt(subtreeSize / rootSize)` between `MIN_THICKNESS (2.6px)` and `MAX_THICKNESS (30px)`,
   so the trunk/major limbs are thick and twigs near the leaves taper down.
6. **Normalize** — shift every coordinate (nodes + SVG path points) so the whole layout is
   positive and padded by `PADDING = 120px` on all sides; `width`/`height` are derived from
   the actual bounding box of all leaf half-widths/heights.

Key tunables (top of file):

| Constant | Value | Purpose |
|---|---|---|
| `LEAF_SLOT` | 138px | Minimum horizontal spacing between sibling leaves |
| `ROW_HEIGHT` | 165px | Vertical spacing between generations |
| `MIN_THICKNESS` / `MAX_THICKNESS` | 2.6 / 30px | Branch stroke width range |
| `BRANCH_JITTER` | 26px | Max horizontal sway of a branch's control points |
| `PADDING` | 120px | Outer margin around the computed bounding box |

## Rendering — `BotanicalTree` component (in `FamilyTreeMap.tsx`)

`BotanicalTree({ layout, onSelectMember })` renders:

- An absolutely-positioned `<svg class="botanical-branches">` containing one `<path>` per
  branch, colored by depth (`BRANCH_COLORS` — 5-step brown gradient, deepest depths reuse
  the last color) and stroke-animated to "grow" via `pathLength={1}` +
  `stroke-dasharray/dashoffset` CSS animation, staggered by `depth * GROWTH_STEP (0.16s)`.
- One absolutely-positioned button per node:
  - **Founder** (`isRoot`): rendered as `.botanical-founder` — a bark-brown rounded plaque
    with name + "مؤسس العائلة" (family founder) subtitle.
  - **Everyone else**: rendered as `.botanical-leaf`, green pill-shaped chip with a small
    "leaf blade" decoration; `is-tip` (true leaf, no children) vs `is-node` (internal,
    slightly different green) modify shading.
  - All nodes fade/pop in via `botanical-leaf-in` animation, staggered by
    `(depth + 1) * GROWTH_STEP + 0.25s` so they appear just after their incoming branch
    finishes drawing.
  - Clicking any node calls `onSelectMember?.(id)`.

## Two Consumers

### 1. `FamilyTreeMap.tsx` (full page, diagram ⇄ tree toggle)

- Owns both layouts: the classic top-down `layoutTree()` (card diagram) and
  `buildBotanicalTreeLayout()` (tree view), switching between them via `viewMode`
  (`'diagram' | 'tree'`).
- Shared pan/zoom/drag viewport (`family-map-viewport` + `family-map-canvas`), fit-to-screen
  on mount/resize, wheel-zoom, drag-to-pan (or arrow-key pan while in "move mode"), and a
  "lock position" toggle.
- `TreeGlyph` icon + the top-right pill button switches `viewMode` and bumps `growthKey` so
  the branch-growth animation replays every time you switch into tree view.
- Used by `FamilyTreeMapPage` at route `/family-tree-map/:familyId?`.

### 2. `BotanicalTreeView.tsx` (standalone overlay)

- A lighter-weight component with **only** the tree view (no diagram mode) — used when the
  botanical tree is shown as a full-screen overlay on top of another page rather than a
  dedicated route.
- Same pan/zoom/drag mechanics as `FamilyTreeMap`, but self-contained in its own
  `botanical-view-root` wrapper with its own toolbar (`تكبير +` / `تصغير −` / `إعادة ضبط`).
- Accepts a `growthKey` prop so the parent can force the growth animation to replay each
  time the overlay is opened.
- Mounted by `ReferenceTreeApp`:
  - `botanicalOpen` (state) controls whether the `.botanical-view-overlay` wrapper (fixed,
    full-screen, fades in) is rendered.
  - `botanicalPeople = familyMembersToMapPeople(normalizedMembers)` converts the tree's
    already-loaded members on the fly (no extra fetch).
  - The floating bottom-left `reference-view-toggle` button (a switch/thumb UI, see CSS
    section) calls `toggleBotanical()`, which flips `botanicalOpen` and bumps
    `botanicalGrowthKey` whenever it's turned on, so growth animates on every open.
  - Selecting a node (`onSelectMember`) calls `handleBotanicalSelect(id)`, which sets
    `selectedId` and opens the full member profile panel — i.e. clicking a leaf in the
    botanical view opens the same profile UI as clicking a card in the normal view.

## Data Flow Summary

```
API (getFamily / getFamilyTree / listFamilyPeople)
        │  useFamilyTreeMembers()
        ▼
FamilyMemberInput[]  (rich member records)
        │  familyMembersToMapPeople()
        ▼
FamilyTreeMapPerson[]  (flat id/name/parentId/childrenCount)
        │  buildBotanicalTreeLayout()
        ▼
BotanicalLayout  (nodes with x/y + SVG branch paths)
        │  <BotanicalTree layout={...} />
        ▼
Rendered tree (animated branches + founder/leaf buttons)
```

Demo data path (no live members yet, or explicit demo mode):

```
reference81TreeSpec.ts  →  generateReference81People()  →  FamilyTreeMapPerson[]
```

## Styling (`FamilyTreeMap.css`)

Relevant class groups:

- `.family-map-root / .family-map-viewport / .family-map-canvas` — shared pan/zoom
  scaffolding for both diagram and tree views.
- `.family-map-canvas.is-tree-view` — adds a soft green/cream radial-gradient backdrop
  behind the tree.
- `.botanical-tree / .botanical-branches / .botanical-branch` — SVG branch layer + the
  stroke-draw "growth" keyframe animation.
- `.botanical-leaf`, `.botanical-leaf.is-node`, `.botanical-leaf-blade`, `.botanical-leaf-name`
  — leaf/node chip styling (green gradients, hover scale/glow).
- `.botanical-founder`, `.botanical-founder-name`, `.botanical-founder-role` — the bark-brown
  founder plaque.
- `.botanical-view-root`, `.botanical-view-toolbar`, `.botanical-view-overlay` — wrapper and
  toolbar for the standalone/overlay usage in `BotanicalTreeView` + `ReferenceTreeApp`.
- `.reference-view-toggle`, `.view-switch-track`, `.view-switch-thumb` — the floating
  bottom-left switch used in `ReferenceTreeApp` to open/close the overlay.

## Known Gaps / Not Yet Implemented

- No automated tests for `buildBotanicalTreeLayout` (positions, thickness, path shifting).
- The `angle` field on `BotanicalNode` is always `0` (reserved but unused — branches are
  drawn as vertical S-curves, not radiating at an angle).
- No virtualization: every node/branch renders unconditionally, which is fine at ~100
  members but could need windowing for very large families.
- Botanical view in `FamilyTreeMap.tsx` and the standalone `BotanicalTreeView.tsx` duplicate
  the pan/zoom/drag logic; there is no shared hook yet.

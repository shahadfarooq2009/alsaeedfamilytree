export interface FamilyMemberInput {
  id: number;
  fullName: string;
  fatherId: number | null;
  motherId?: number | null;
  gender?: 'male' | 'female' | 'other';
  generation: number;
  initial: string;
  photoUrl?: string | null;
  relationLabel?: string;
  isFamilyHead?: boolean;
}

export interface LayoutTreeNode extends FamilyMemberInput {
  children: LayoutTreeNode[];
  subtreeWidth: number;
  x: number;
  y: number;
}

export interface PositionedMember extends FamilyMemberInput {
  x: number;
  y: number;
}

export interface BranchLabel {
  text: string;
  x: number;
  y: number;
  width: number;
  parentId: number;
}

export interface BranchConnectorPath {
  key: string;
  d: string;
  type: 'root' | 'main' | 'child';
  groupId: number;
  parentId: number;
  childId: number;
}

import type { TreeLayoutScale } from './treeLayoutScale';

export interface TreeLayoutResult {
  members: PositionedMember[];
  labels: BranchLabel[];
  connectors: BranchConnectorPath[];
  canvasWidth: number;
  canvasHeight: number;
  contentBounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  scale: TreeLayoutScale;
  validation?: {
    overlappingCards: number;
    clippedCards: number;
    hiddenNames: number;
    valid: boolean;
  };
  /** When true, virtual canvas matches stage — no CSS zoom needed. */
  layoutFillsStage?: boolean;
}

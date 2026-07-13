export type BranchAssetType =
  | 'branch-main-left'
  | 'branch-main-right'
  | 'branch-medium-left'
  | 'branch-medium-right'
  | 'branch-small-left'
  | 'branch-small-right'
  | 'twig-left'
  | 'twig-right'
  | 'hanging-stem';

export interface AttachmentPoint {
  x: number;
  y: number;
}

export interface BranchInstance {
  id: string;
  asset: BranchAssetType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  flipX: boolean;
  parentPersonId: number;
  childPersonId: number;
  attachmentStart: AttachmentPoint;
  attachmentEnd: AttachmentPoint;
  zIndex: number;
  generationDepth: number;
  segmentIndex: number;
}

export interface LeafAnchor {
  worldX: number;
  worldY: number;
  tiltDeg: number;
}

export interface BranchCompositionResult {
  branches: BranchInstance[];
  leafAnchors: Map<number, LeafAnchor>;
}

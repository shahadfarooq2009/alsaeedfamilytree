/** Usable layout area matching the family-tree viewport stage. */
export interface LayoutStage {
  width: number;
  height: number;
  paddingX: number;
  paddingY: number;
}

export const DEFAULT_STAGE: LayoutStage = {
  width: 2600,
  height: 1200,
  paddingX: 28,
  paddingY: 28,
};

/** Max content width for React Flow tree — grow vertically when rows exceed this. */
export const MAX_TREE_BRANCH_WIDTH = 1500;

export function mainBranchUsableRect(stage: LayoutStage) {
  return {
    left: stage.width * 0.04,
    top: stage.height * 0.12,
    right: stage.width * 0.96,
    bottom: stage.height * 0.92,
    width: stage.width * 0.92,
    height: stage.height * 0.8,
  };
}

export function usableStageRect(stage: LayoutStage) {
  return mainBranchUsableRect(stage);
}

export function stageFromViewport(width: number, height: number): LayoutStage {
  const w = Math.max(640, Math.round(width));
  const h = Math.max(480, Math.round(height));
  return {
    width: w,
    height: h,
    paddingX: 28,
    paddingY: 28,
  };
}

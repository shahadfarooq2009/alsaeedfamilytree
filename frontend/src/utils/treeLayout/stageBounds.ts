/** Usable layout area matching the family-tree viewport stage. */
export interface LayoutStage {
  width: number;
  height: number;
  paddingX: number;
  paddingY: number;
}

export const DEFAULT_STAGE: LayoutStage = {
  width: 1600,
  height: 900,
  paddingX: 28,
  paddingY: 28,
};

export function usableStageRect(stage: LayoutStage) {
  return {
    left: stage.paddingX,
    top: stage.paddingY,
    right: stage.width - stage.paddingX,
    bottom: stage.height - stage.paddingY,
    width: stage.width - stage.paddingX * 2,
    height: stage.height - stage.paddingY * 2,
  };
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

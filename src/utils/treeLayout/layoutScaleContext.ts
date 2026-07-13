import { computeTreeLayoutScale, type TreeLayoutScale } from './treeLayoutScale';

let activeScale: TreeLayoutScale = computeTreeLayoutScale(1);

export function setLayoutScale(scale: TreeLayoutScale): void {
  activeScale = scale;
}

export function getLayoutScale(): TreeLayoutScale {
  return activeScale;
}

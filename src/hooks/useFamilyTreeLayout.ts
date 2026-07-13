import { useMemo } from 'react';
import { computeDynamicTreeLayout } from '../utils/treeLayout/index';
import type { LayoutStage } from '../utils/treeLayout/stageBounds';
import type { FamilyMemberInput, TreeLayoutResult } from '../utils/treeLayout/types';

export function useFamilyTreeLayout(
  members: FamilyMemberInput[],
  stage: LayoutStage,
): TreeLayoutResult {
  return useMemo(
    () => computeDynamicTreeLayout(members, stage),
    [members, stage.width, stage.height, stage.paddingX, stage.paddingY],
  );
}

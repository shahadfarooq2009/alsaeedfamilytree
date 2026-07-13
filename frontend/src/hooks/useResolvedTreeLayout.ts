import { useMemo } from 'react';
import type { PrototypeMember } from '../components/reference-tree/prototypeMembers';
import {
  computeFamilyTreeMapLayout,
  computeMapBranchLabels,
  type MapPositionedMember,
} from '../utils/familyTreeMapLayout';

export function useResolvedTreeLayout(sourceMembers: PrototypeMember[]) {
  const members = useMemo<MapPositionedMember[]>(
    () => computeFamilyTreeMapLayout(sourceMembers),
    [sourceMembers],
  );

  const branchLabels = useMemo(() => computeMapBranchLabels(members), [members]);

  return { members, branchLabels };
}

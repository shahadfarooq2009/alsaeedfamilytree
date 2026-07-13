import type { FamilyTreeMapPerson } from '../components/family-tree-map/FamilyTreeMap';
import { getMemberFirstName } from './normalizeFamilyData';
import { buildPrimaryTreeParentMap } from './treeLayout/primaryTreeParent';
import type { FamilyMemberInput } from './treeLayout/types';

/** Map API/layout members to the standalone FamilyTreeMap input shape. */
export function familyMembersToMapPeople(members: FamilyMemberInput[]): FamilyTreeMapPerson[] {
  const memberIds = new Set(members.map((member) => member.id));
  const parentMap = buildPrimaryTreeParentMap(members);

  const childrenCountByParent = new Map<number, number>();
  members.forEach((member) => {
    const parentId = parentMap.get(member.id);
    if (parentId != null && memberIds.has(parentId)) {
      childrenCountByParent.set(parentId, (childrenCountByParent.get(parentId) ?? 0) + 1);
    }
  });

  return members.map((member) => {
    const rawParentId = parentMap.get(member.id) ?? null;
    const parentId = rawParentId != null && memberIds.has(rawParentId) ? rawParentId : null;

    return {
      id: member.id,
      name: getMemberFirstName(member.fullName),
      parentId,
      childrenCount: childrenCountByParent.get(member.id) ?? 0,
    };
  });
}

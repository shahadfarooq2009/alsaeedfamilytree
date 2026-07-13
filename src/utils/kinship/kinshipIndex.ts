import type { PersonSummary } from '../../types/person';
import type { FamilyMemberInput } from '../treeLayout/types';
import { resolveMemberParentNames } from '../memberDisplayInfo';
import { getFamilyMarriages } from '../marriageRegistry';
import { resolveKinshipMember } from './resolveKinshipMember';

export interface KinshipIndex {
  members: FamilyMemberInput[];
  familyId?: number;
  people?: PersonSummary[];
  memberById: Map<number, FamilyMemberInput>;
  childrenByParentId: Map<number, FamilyMemberInput[]>;
  siblingIdsByMemberId: Map<number, number[]>;
  spouseIdsByMemberId: Map<number, number[]>;
  fatherByMemberId: Map<number, FamilyMemberInput | null>;
  motherByMemberId: Map<number, FamilyMemberInput | null>;
  peopleById: Map<number, PersonSummary>;
}

function pushChild(
  map: Map<number, FamilyMemberInput[]>,
  parentId: number,
  child: FamilyMemberInput,
): void {
  const bucket = map.get(parentId);
  if (bucket) {
    if (!bucket.some((member) => member.id === child.id)) bucket.push(child);
    return;
  }
  map.set(parentId, [child]);
}

function addSiblingLinks(
  siblingIdsByMemberId: Map<number, Set<number>>,
  memberIds: number[],
): void {
  if (memberIds.length < 2) return;

  for (const memberId of memberIds) {
    const bucket = siblingIdsByMemberId.get(memberId) ?? new Set<number>();
    for (const otherId of memberIds) {
      if (otherId !== memberId) bucket.add(otherId);
    }
    siblingIdsByMemberId.set(memberId, bucket);
  }
}

export function buildKinshipIndex(
  members: FamilyMemberInput[],
  familyId?: number,
  people?: PersonSummary[],
): KinshipIndex {
  const memberById = new Map<number, FamilyMemberInput>();
  const childrenByParentId = new Map<number, FamilyMemberInput[]>();
  const siblingSets = new Map<number, Set<number>>();
  const spouseIdsByMemberId = new Map<number, number[]>();
  const fatherByMemberId = new Map<number, FamilyMemberInput | null>();
  const motherByMemberId = new Map<number, FamilyMemberInput | null>();
  const peopleById = new Map<number, PersonSummary>();

  for (const person of people ?? []) {
    peopleById.set(person.id, person);
  }

  for (const member of members) {
    memberById.set(member.id, member);
    if (member.fatherId != null) pushChild(childrenByParentId, member.fatherId, member);
    if (member.motherId != null) pushChild(childrenByParentId, member.motherId, member);
  }

  const fatherGroups = new Map<number, number[]>();
  const motherGroups = new Map<number, number[]>();
  for (const member of members) {
    if (member.fatherId != null) {
      const group = fatherGroups.get(member.fatherId) ?? [];
      group.push(member.id);
      fatherGroups.set(member.fatherId, group);
    }
    if (member.motherId != null) {
      const group = motherGroups.get(member.motherId) ?? [];
      group.push(member.id);
      motherGroups.set(member.motherId, group);
    }
  }

  fatherGroups.forEach((ids) => addSiblingLinks(siblingSets, ids));
  motherGroups.forEach((ids) => addSiblingLinks(siblingSets, ids));

  if (familyId != null) {
    for (const marriage of getFamilyMarriages(familyId)) {
      const pair = [marriage.husbandId, marriage.wifeId].filter((id): id is number => id != null);
      if (pair.length !== 2) continue;
      const [leftId, rightId] = pair;
      spouseIdsByMemberId.set(leftId, [rightId]);
      spouseIdsByMemberId.set(rightId, [leftId]);
    }
  }

  const siblingIdsByMemberId = new Map<number, number[]>();
  siblingSets.forEach((ids, memberId) => {
    siblingIdsByMemberId.set(memberId, Array.from(ids));
  });

  return {
    members,
    familyId,
    people,
    memberById,
    childrenByParentId,
    siblingIdsByMemberId,
    spouseIdsByMemberId,
    fatherByMemberId,
    motherByMemberId,
    peopleById,
  };
}

export function getKinshipMember(index: KinshipIndex, id: number | null | undefined): FamilyMemberInput | null {
  if (id == null) return null;
  return index.memberById.get(id) ?? null;
}

export function getKinshipFather(index: KinshipIndex, member: FamilyMemberInput): FamilyMemberInput | null {
  const cached = index.fatherByMemberId.get(member.id);
  if (cached !== undefined) return cached;

  let father: FamilyMemberInput | null = null;
  if (member.fatherId != null) {
    const linked = getKinshipMember(index, member.fatherId);
    if (linked && linked.gender !== 'female') father = linked;
  }

  if (!father) {
    const person = index.peopleById.get(member.id) ?? null;
    const parents = resolveMemberParentNames(member, index.members, person, index.familyId);
    if (parents.fatherName) {
      father = resolveKinshipMember(index.members, parents.fatherName, index.familyId).member;
    }
  }

  index.fatherByMemberId.set(member.id, father);
  return father;
}

export function getKinshipMother(index: KinshipIndex, member: FamilyMemberInput): FamilyMemberInput | null {
  const cached = index.motherByMemberId.get(member.id);
  if (cached !== undefined) return cached;

  let mother: FamilyMemberInput | null = null;
  if (member.motherId != null) {
    mother = getKinshipMember(index, member.motherId);
  }

  if (!mother) {
    const person = index.peopleById.get(member.id) ?? null;
    const parents = resolveMemberParentNames(member, index.members, person, index.familyId);
    if (parents.motherName) {
      mother = resolveKinshipMember(index.members, parents.motherName, index.familyId).member;
    }
  }

  index.motherByMemberId.set(member.id, mother);
  return mother;
}

export function getKinshipChildren(index: KinshipIndex, parentId: number): FamilyMemberInput[] {
  return index.childrenByParentId.get(parentId) ?? [];
}

export function getKinshipSiblings(index: KinshipIndex, member: FamilyMemberInput): FamilyMemberInput[] {
  const siblingIds = index.siblingIdsByMemberId.get(member.id) ?? [];
  return siblingIds
    .map((id) => getKinshipMember(index, id))
    .filter((item): item is FamilyMemberInput => item != null);
}

export function areKinshipSpouses(index: KinshipIndex, leftId: number, rightId: number): boolean {
  return (index.spouseIdsByMemberId.get(leftId) ?? []).includes(rightId);
}

export function areKinshipSiblings(index: KinshipIndex, left: FamilyMemberInput, right: FamilyMemberInput): boolean {
  if (left.id === right.id) return false;
  if (left.fatherId === right.id || left.motherId === right.id) return false;
  if (right.fatherId === left.id || right.motherId === left.id) return false;

  if (left.fatherId != null && left.fatherId === right.fatherId) return true;
  if (left.motherId != null && left.motherId === right.motherId) return true;

  return (index.siblingIdsByMemberId.get(left.id) ?? []).includes(right.id);
}

export function getKinshipParentRole(
  index: KinshipIndex,
  parent: FamilyMemberInput,
  child: FamilyMemberInput,
): 'father' | 'mother' | null {
  const father = getKinshipFather(index, child);
  if (father?.id === parent.id) return 'father';

  const mother = getKinshipMother(index, child);
  if (mother?.id === parent.id) return 'mother';

  return null;
}

export function getKinshipDescendantDepth(
  index: KinshipIndex,
  ancestorId: number,
  descendantId: number,
  maxDepth = 6,
): number | null {
  const queue: Array<{ memberId: number; depth: number }> = [{ memberId: ancestorId, depth: 0 }];
  const visited = new Set<number>([ancestorId]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.depth >= maxDepth) continue;

    for (const child of getKinshipChildren(index, current.memberId)) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);

      const depth = current.depth + 1;
      if (child.id === descendantId) return depth;
      queue.push({ memberId: child.id, depth });
    }
  }

  return null;
}

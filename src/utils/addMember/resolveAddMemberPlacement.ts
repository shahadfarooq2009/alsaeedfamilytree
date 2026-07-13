import type { CreatePersonPayload, Gender } from '../../types/person';
import { formatMemberNameWithFather, getMemberFirstName } from '../normalizeFamilyData';
import { buildFamilyHierarchy } from '../treeLayout/buildFamilyHierarchy';
import { isFounderMember } from '../treeLayout/constants';
import {
  buildPrimaryTreeParentMap,
  computeMainBranchRootMap,
} from '../treeLayout/primaryTreeParent';
import type { FamilyMemberInput } from '../treeLayout/types';
import type { MarriageRecord } from '../marriageRegistry';
import { cleanNameInput, normalizeArabicName } from '../normalizeArabicName';
import {
  resolveParentsWithMarriage,
} from './inferParentsFromMarriage';

export type ParentRole = 'father' | 'mother';

export type ParentMatchStatus = 'empty' | 'single' | 'multiple';

export interface ParentMatchResult {
  status: ParentMatchStatus;
  members: FamilyMemberInput[];
}

export interface ResolvedParents {
  father: FamilyMemberInput | null;
  mother: FamilyMemberInput | null;
  fatherNameText: string | null;
  motherNameText: string | null;
}

export interface TreePlacement {
  treeParentId: number | null;
  branchRootId: number | null;
  canPlaceOnTree: boolean;
}

function getFounderDirectChildIds(members: FamilyMemberInput[]): Set<number> {
  const roots = buildFamilyHierarchy(members);
  const founder = roots.find((root) => isFounderMember(root)) ?? roots[0];
  if (!founder) return new Set();
  return new Set(founder.children.map((child) => child.id));
}

function getBranchRootId(
  memberId: number,
  members: FamilyMemberInput[],
  founderChildIds: Set<number>,
): number {
  const memberIds = new Set(members.map((member) => member.id));
  const parentMap = buildPrimaryTreeParentMap(members);
  const branchRootMap = computeMainBranchRootMap(memberIds, parentMap, founderChildIds);
  return branchRootMap.get(memberId) ?? memberId;
}

function isInMainFamilyBranch(
  memberId: number,
  members: FamilyMemberInput[],
  founderChildIds: Set<number>,
): boolean {
  const branchRootId = getBranchRootId(memberId, members, founderChildIds);
  return founderChildIds.has(branchRootId) || founderChildIds.has(memberId);
}

function matchesParentGender(member: FamilyMemberInput, role: ParentRole): boolean {
  if (role === 'father') return member.gender === 'male';
  if (role === 'mother') return member.gender === 'female';
  return false;
}

function resolvePatronymicFatherName(resolved: ResolvedParents): string | null {
  if (resolved.father?.gender === 'female') {
    return resolved.fatherNameText?.trim() || null;
  }

  const linkedName = resolved.father?.fullName?.trim() ?? null;
  const textName = resolved.fatherNameText?.trim() ?? null;
  const motherName = resolved.mother?.fullName?.trim() ?? null;

  if (linkedName && motherName && normalizeParentNameKey(linkedName) === normalizeParentNameKey(motherName)) {
    return textName;
  }

  return linkedName ?? textName ?? null;
}

function normalizeParentNameKey(name: string): string {
  return normalizeArabicName(cleanNameInput(name));
}

function resolveLinkedParent(
  role: ParentRole,
  typedName: string,
  match: ParentMatchResult,
  selected?: FamilyMemberInput | null,
): FamilyMemberInput | null {
  const cleaned = cleanNameInput(typedName);
  const matched = match.status === 'single' ? match.members[0] : null;
  const candidate = selected ?? matched;
  if (!candidate || !matchesParentGender(candidate, role)) {
    return null;
  }

  if (!cleaned) {
    return candidate;
  }

  const typedKey = normalizeParentNameKey(cleaned);
  const candidateKey = normalizeParentNameKey(candidate.fullName);
  if (typedKey && candidateKey && typedKey !== candidateKey) {
    return null;
  }

  return candidate;
}

export function matchParentByFullName(
  members: FamilyMemberInput[],
  rawName: string,
  role: ParentRole,
): ParentMatchResult {
  const cleaned = cleanNameInput(rawName);
  if (!cleaned) {
    return { status: 'empty', members: [] };
  }

  const normalizedQuery = normalizeArabicName(cleaned);
  const matches = members.filter((member) => (
    matchesParentGender(member, role)
    && normalizeArabicName(member.fullName) === normalizedQuery
  ));

  if (matches.length === 0) {
    return { status: 'empty', members: [] };
  }

  if (matches.length === 1) {
    return { status: 'single', members: matches };
  }

  return { status: 'multiple', members: matches };
}

export function resolveTreeParentId(
  father: FamilyMemberInput | null,
  mother: FamilyMemberInput | null,
  members: FamilyMemberInput[],
): number | null {
  if (father && !mother) return father.id;
  if (mother && !father) return mother.id;
  if (!father || !mother) return null;

  const founderChildIds = getFounderDirectChildIds(members);
  const fatherInBranch = isInMainFamilyBranch(father.id, members, founderChildIds);
  const motherInBranch = isInMainFamilyBranch(mother.id, members, founderChildIds);

  if (fatherInBranch && motherInBranch) {
    const fatherBranch = getBranchRootId(father.id, members, founderChildIds);
    const motherBranch = getBranchRootId(mother.id, members, founderChildIds);
    if (fatherBranch === motherBranch) {
      return father.id;
    }
    return father.id;
  }

  if (motherInBranch && !fatherInBranch) {
    return mother.id;
  }

  if (fatherInBranch && !motherInBranch) {
    return father.id;
  }

  return father.id;
}

export function resolveBranchRootId(
  treeParentId: number | null,
  members: FamilyMemberInput[],
): number | null {
  if (treeParentId == null) return null;
  const founderChildIds = getFounderDirectChildIds(members);
  return getBranchRootId(treeParentId, members, founderChildIds);
}

export function buildResolvedParents(
  fatherName: string,
  motherName: string,
  fatherMatch: ParentMatchResult,
  motherMatch: ParentMatchResult,
  selectedFather?: FamilyMemberInput | null,
  selectedMother?: FamilyMemberInput | null,
): ResolvedParents {
  const cleanedFather = cleanNameInput(fatherName);
  const cleanedMother = cleanNameInput(motherName);

  const father = resolveLinkedParent('father', fatherName, fatherMatch, selectedFather);
  const mother = resolveLinkedParent('mother', motherName, motherMatch, selectedMother);

  return {
    father,
    mother,
    fatherNameText: cleanedFather && !father ? cleanedFather : null,
    motherNameText: cleanedMother && !mother ? cleanedMother : null,
  };
}

export function resolveTreePlacement(
  resolved: ResolvedParents,
  members: FamilyMemberInput[],
): TreePlacement {
  const hasLinkedParent = resolved.father != null || resolved.mother != null;
  if (!hasLinkedParent) {
    return {
      treeParentId: null,
      branchRootId: null,
      canPlaceOnTree: false,
    };
  }

  const treeParentId = resolveTreeParentId(resolved.father, resolved.mother, members);
  const branchRootId = resolveBranchRootId(treeParentId, members);

  return {
    treeParentId,
    branchRootId,
    canPlaceOnTree: treeParentId != null,
  };
}

export function needsOrphanConfirmation(
  fatherName: string,
  motherName: string,
  resolved: ResolvedParents,
): boolean {
  const hasFatherInput = cleanNameInput(fatherName).length > 0;
  const hasMotherInput = cleanNameInput(motherName).length > 0;
  if (!hasFatherInput && !hasMotherInput) return false;
  return resolved.father == null && resolved.mother == null;
}

export function buildAddMemberPayload(input: {
  firstName: string;
  gender: Gender;
  isLiving: boolean;
  isFounder: boolean;
  resolved: ResolvedParents;
  placement: TreePlacement;
  allowOrphan?: boolean;
}): CreatePersonPayload {
  const firstName = cleanNameInput(input.firstName);
  const fatherDisplayName = resolvePatronymicFatherName(input.resolved);
  const fullName = input.isFounder
    ? firstName
    : formatMemberNameWithFather(firstName, fatherDisplayName);

  const payload: CreatePersonPayload = {
    first_name: firstName,
    full_name: fullName,
    middle_name: null,
    last_name: null,
    gender: input.gender,
    is_living: input.isLiving,
    is_family_head: input.isFounder,
    father_id: input.isFounder ? null : (input.resolved.father?.gender === 'male' ? input.resolved.father.id : null),
    mother_id: input.isFounder ? null : (input.resolved.mother?.gender === 'female' ? input.resolved.mother.id : null),
    father_name_text: input.isFounder ? null : input.resolved.fatherNameText,
    mother_name_text: input.isFounder ? null : input.resolved.motherNameText,
  };

  if (!input.isFounder && input.placement.canPlaceOnTree && !input.allowOrphan) {
    payload.tree_parent_id = input.placement.treeParentId;
    payload.display_parent_id = input.placement.treeParentId;
    payload.branch_root_id = input.placement.branchRootId;
  }

  return payload;
}

export function buildUpdateMemberPayload(input: {
  firstName: string;
  gender: Gender;
  isLiving: boolean;
  deathDate: string | null;
  resolved: ResolvedParents;
  placement: TreePlacement;
}): CreatePersonPayload {
  const firstName = cleanNameInput(input.firstName);
  const fatherDisplayName = resolvePatronymicFatherName(input.resolved);
  const fullName = formatMemberNameWithFather(firstName, fatherDisplayName);

  const payload: CreatePersonPayload = {
    first_name: firstName,
    full_name: fullName,
    middle_name: null,
    last_name: null,
    gender: input.gender,
    is_living: input.isLiving,
    death_date: input.deathDate,
    father_id: input.resolved.father?.gender === 'male' ? input.resolved.father.id : null,
    mother_id: input.resolved.mother?.gender === 'female' ? input.resolved.mother.id : null,
    father_name_text: input.resolved.fatherNameText,
    mother_name_text: input.resolved.motherNameText,
  };

  if (input.placement.canPlaceOnTree) {
    payload.tree_parent_id = input.placement.treeParentId;
    payload.display_parent_id = input.placement.treeParentId;
    payload.branch_root_id = input.placement.branchRootId;
  }

  return payload;
}

export function getMemberBranchRootId(
  memberId: number,
  members: FamilyMemberInput[],
): number {
  const founderChildIds = getFounderDirectChildIds(members);
  return getBranchRootId(memberId, members, founderChildIds);
}

export function formatMemberWithBranchLabel(
  member: FamilyMemberInput,
  members: FamilyMemberInput[],
): string {
  const branchRootId = getMemberBranchRootId(member.id, members);
  const branchRoot = members.find((item) => item.id === branchRootId);
  const branchName = branchRoot ? getMemberFirstName(branchRoot.fullName) : null;
  if (branchName && branchName !== '—') {
    return `${member.fullName} - فرع ${branchName}`;
  }
  return member.fullName;
}

export interface AddMemberFieldHint {
  message: string;
  variant: 'found' | 'ambig';
}

export interface AddMemberFieldHints {
  fatherHint: AddMemberFieldHint | null;
  motherHint: AddMemberFieldHint | null;
  placementHint: string | null;
}

export function buildAddMemberFieldHints(input: {
  members: FamilyMemberInput[];
  fatherName: string;
  motherName: string;
  resolvedFather?: FamilyMemberInput | null;
  resolvedMother?: FamilyMemberInput | null;
  marriages?: MarriageRecord[];
}): AddMemberFieldHints {
  const fatherMatch = matchParentByFullName(input.members, input.fatherName, 'father');
  const motherMatch = matchParentByFullName(input.members, input.motherName, 'mother');
  const resolved = resolveParentsWithMarriage(
    input.members,
    input.marriages ?? [],
    input.fatherName,
    input.motherName,
    fatherMatch,
    motherMatch,
    input.resolvedFather,
    input.resolvedMother,
  );
  const placement = resolveTreePlacement(resolved, input.members);

  let fatherHint: AddMemberFieldHint | null = null;
  let motherHint: AddMemberFieldHint | null = null;
  let placementHint: string | null = null;

  if (cleanNameInput(input.fatherName).length > 0) {
    if (fatherMatch.status === 'single' && resolved.father?.gender === 'male') {
      fatherHint = {
        variant: 'found',
        message: `تم العثور على الأب: ${formatMemberWithBranchLabel(resolved.father, input.members)}`,
      };
    } else if (fatherMatch.status === 'multiple') {
      fatherHint = {
        variant: 'ambig',
        message: 'وُجد أكثر من تطابق لاسم الأب — سيُطلب الاختيار عند الحفظ',
      };
    } else if (resolved.father?.gender === 'male') {
      fatherHint = {
        variant: 'found',
        message: `تم ربط الأب: ${formatMemberWithBranchLabel(resolved.father, input.members)}`,
      };
    } else if (resolved.fatherNameText) {
      fatherHint = {
        variant: 'found',
        message: `اسم الأب: ${resolved.fatherNameText}`,
      };
    }
  }

  if (cleanNameInput(input.motherName).length > 0) {
    if (motherMatch.status === 'single' && resolved.mother) {
      motherHint = {
        variant: 'found',
        message: `تم العثور على الأم: ${formatMemberWithBranchLabel(resolved.mother, input.members)}`,
      };
    } else if (motherMatch.status === 'multiple') {
      motherHint = {
        variant: 'ambig',
        message: 'وُجد أكثر من تطابق لاسم الأم — سيُطلب الاختيار عند الحفظ',
      };
    } else if (resolved.mother) {
      motherHint = {
        variant: 'found',
        message: `تم ربط الأم من الزواج: ${formatMemberWithBranchLabel(resolved.mother, input.members)}`,
      };
    }
  } else if (resolved.mother?.gender === 'female' && cleanNameInput(input.fatherName).length > 0 && !cleanNameInput(input.motherName).length) {
    motherHint = {
      variant: 'found',
      message: `سيُربط الطفل بالأم: ${resolved.mother.fullName}`,
    };
    placementHint = placementHint ?? (
      resolved.fatherNameText
        ? `سيُحفظ الاسم مع الأب: ${resolved.fatherNameText}`
        : 'سيُربط الطفل بالأم تلقائياً من الزواج'
    );
  }

  if (
    cleanNameInput(input.fatherName).length === 0
    && resolved.father
    && cleanNameInput(input.motherName).length > 0
  ) {
    placementHint = placementHint ?? `سيُربط الطفل بالأم: ${resolved.mother?.fullName ?? input.motherName}`;
  }

  if (placement.canPlaceOnTree && placement.treeParentId != null) {
    const treeParent = input.members.find((member) => member.id === placement.treeParentId);
    if (treeParent) {
      placementHint = `سيظهر الشخص تحت: ${treeParent.fullName}`;
    }
  }

  return { fatherHint, motherHint, placementHint };
}

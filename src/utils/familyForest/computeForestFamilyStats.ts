import type { PersonSummary } from '../../types/person';
import { buildFamilyHierarchy } from '../treeLayout/buildFamilyHierarchy';
import { hasParentLink, isFounderMember } from '../treeLayout/constants';
import type { FamilyMemberInput } from '../treeLayout/types';
import { getMemberSubtreeMembers } from './getBranchSubtreeMembers';

export interface ForestBranchStat {
  name: string;
  count: number;
}

export interface ForestGenerationStat {
  generation: number;
  label: string;
  count: number;
}

export interface ForestReviewStats {
  noBirthDate: number;
  noPhoto: number;
  noGender: number;
  noParent: number;
  potentialDuplicate: number;
}

export interface ForestFamilyStats {
  total: number;
  males: number;
  females: number;
  living: number;
  deceased: number;
  incomplete: number;
  branches: ForestBranchStat[];
  generations: ForestGenerationStat[];
  review: ForestReviewStats;
}

const GENERATION_LABELS: Record<number, string> = {
  1: 'الجيل الأول',
  2: 'الجيل الثاني',
  3: 'الجيل الثالث',
  4: 'الجيل الرابع',
  5: 'الجيل الخامس',
};

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ar');
}

function resolveGender(
  member: FamilyMemberInput,
  person?: PersonSummary,
): 'male' | 'female' | 'other' | null {
  return member.gender ?? person?.gender ?? null;
}

function resolvePhoto(member: FamilyMemberInput, person?: PersonSummary): string | null {
  return member.photoUrl ?? person?.photo_url ?? null;
}

function isLiving(person?: PersonSummary): boolean {
  if (!person) return true;
  if (person.death_date) return false;
  return person.is_living ?? true;
}

function memberHasIncompleteData(
  member: FamilyMemberInput,
  person: PersonSummary | undefined,
): boolean {
  const noBirthDate = !person?.birth_date;
  const noPhoto = !resolvePhoto(member, person);
  const noGender = resolveGender(member, person) == null;
  const noParent = !isFounderMember(member) && !hasParentLink(member);
  return noBirthDate || noPhoto || noGender || noParent;
}

export function computeForestFamilyStats(
  members: FamilyMemberInput[],
  people: PersonSummary[] = [],
): ForestFamilyStats {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const total = members.length;

  let males = 0;
  let females = 0;
  let living = 0;
  let deceased = 0;
  let incomplete = 0;

  const review: ForestReviewStats = {
    noBirthDate: 0,
    noPhoto: 0,
    noGender: 0,
    noParent: 0,
    potentialDuplicate: 0,
  };

  members.forEach((member) => {
    const person = peopleById.get(member.id);
    const gender = resolveGender(member, person);

    if (gender === 'male') males += 1;
    if (gender === 'female') females += 1;

    if (isLiving(person)) {
      living += 1;
    } else {
      deceased += 1;
    }

    if (memberHasIncompleteData(member, person)) {
      incomplete += 1;
    }

    if (!person?.birth_date) review.noBirthDate += 1;
    if (!resolvePhoto(member, person)) review.noPhoto += 1;
    if (gender == null) review.noGender += 1;
    if (!isFounderMember(member) && !hasParentLink(member)) review.noParent += 1;
  });

  const nameCounts = new Map<string, number>();
  members.forEach((member) => {
    const key = normalizeName(member.fullName);
    if (!key) return;
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  });
  review.potentialDuplicate = members.filter((member) => {
    const key = normalizeName(member.fullName);
    return key.length > 0 && (nameCounts.get(key) ?? 0) > 1;
  }).length;

  const roots = buildFamilyHierarchy(members);
  const founder = roots.find((root) => isFounderMember(root)) ?? roots[0];
  const branches: ForestBranchStat[] = founder
    ? founder.children.map((branch) => ({
        name: branch.fullName,
        count: getMemberSubtreeMembers(members, branch.id).length,
      }))
    : [];

  const maxGeneration = Math.max(5, ...members.map((member) => member.generation));
  const generations: ForestGenerationStat[] = [];
  for (let generation = 1; generation <= Math.min(5, maxGeneration); generation += 1) {
    generations.push({
      generation,
      label: GENERATION_LABELS[generation] ?? `الجيل ${generation}`,
      count: members.filter((member) => member.generation === generation).length,
    });
  }

  return {
    total,
    males,
    females,
    living,
    deceased,
    incomplete,
    branches,
    generations,
    review,
  };
}

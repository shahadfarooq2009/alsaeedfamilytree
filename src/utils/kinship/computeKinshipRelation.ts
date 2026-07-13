import type { PersonSummary } from '../../types/person';
import type { FamilyMemberInput } from '../treeLayout/types';
import { getMemberDisplayNameWithFather } from '../memberDisplayInfo';
import { describeDistantKinship } from './describeKinshipPath';
import { formatKinshipMessage } from './kinshipMessageFormat';
import {
  areKinshipSiblings,
  areKinshipSpouses,
  buildKinshipIndex,
  getKinshipDescendantDepth,
  getKinshipFather,
  getKinshipMother,
  getKinshipParentRole,
  getKinshipSiblings,
  type KinshipIndex,
} from './kinshipIndex';
import { resolveKinshipMember } from './resolveKinshipMember';

export interface KinshipRelationInput {
  subjectQuery: string;
  objectQuery: string;
  members: FamilyMemberInput[];
  familyId?: number;
  people?: PersonSummary[];
  index?: KinshipIndex;
}

export interface KinshipRelationResult {
  ok: boolean;
  message: string;
  detail?: string;
}

function memberLabel(
  member: FamilyMemberInput,
  members: FamilyMemberInput[],
  familyId?: number,
): string {
  return getMemberDisplayNameWithFather(member, members, familyId);
}

function describeParentTerm(
  index: KinshipIndex,
  parent: FamilyMemberInput,
  child: FamilyMemberInput,
): string | null {
  const role = getKinshipParentRole(index, parent, child);
  if (role === 'father') return 'والد';
  if (role === 'mother') return 'والدة';
  return null;
}

function describeChildTerm(
  index: KinshipIndex,
  child: FamilyMemberInput,
  parent: FamilyMemberInput,
): string | null {
  if (getKinshipParentRole(index, parent, child) == null) return null;
  return child.gender === 'female' ? 'ابنة' : 'ابن';
}

function describeSiblingTerm(subject: FamilyMemberInput): string {
  return subject.gender === 'female' ? 'أخت' : 'أخ';
}

function describeSpouseTerm(subject: FamilyMemberInput): string {
  if (subject.gender === 'female') return 'زوجة';
  if (subject.gender === 'male') return 'زوج';
  return 'زوج/زوجة';
}

function describeInLawTerm(
  index: KinshipIndex,
  subject: FamilyMemberInput,
  object: FamilyMemberInput,
): string | null {
  for (const sibling of getKinshipSiblings(index, object)) {
    if (!areKinshipSpouses(index, subject.id, sibling.id)) continue;
    if (sibling.gender === 'female') {
      return subject.gender === 'female' ? 'زوجة أخت' : 'زوج أخت';
    }
    if (sibling.gender === 'male') {
      return subject.gender === 'female' ? 'زوجة أخ' : 'زوج أخ';
    }
  }

  for (const sibling of getKinshipSiblings(index, subject)) {
    if (!areKinshipSpouses(index, object.id, sibling.id)) continue;
    if (sibling.gender === 'female') {
      return object.gender === 'female' ? 'زوجة أخت' : 'زوج أخت';
    }
    if (sibling.gender === 'male') {
      return object.gender === 'female' ? 'زوجة أخ' : 'زوج أخ';
    }
  }

  return null;
}

function describeGrandparentTerm(
  index: KinshipIndex,
  grandparent: FamilyMemberInput,
  grandchild: FamilyMemberInput,
): string | null {
  const father = getKinshipFather(index, grandchild);
  const mother = getKinshipMother(index, grandchild);

  if (father) {
    if (getKinshipParentRole(index, grandparent, father) === 'father') {
      return grandparent.gender === 'female' ? 'جدة' : 'جد';
    }
    if (getKinshipParentRole(index, grandparent, father) === 'mother') {
      return 'جدة';
    }
  }

  if (mother) {
    if (getKinshipParentRole(index, grandparent, mother) === 'mother') {
      return 'جدة';
    }
    if (getKinshipParentRole(index, grandparent, mother) === 'father') {
      return 'جد';
    }
  }

  return null;
}

function describeUncleAuntTerm(
  index: KinshipIndex,
  subject: FamilyMemberInput,
  object: FamilyMemberInput,
): string | null {
  const father = getKinshipFather(index, object);
  if (father && areKinshipSiblings(index, subject, father)) {
    return subject.gender === 'female' ? 'عمة' : 'عم';
  }

  const mother = getKinshipMother(index, object);
  if (mother && areKinshipSiblings(index, subject, mother)) {
    return subject.gender === 'female' ? 'خالة' : 'خال';
  }

  return null;
}

function describeCousinTerm(
  index: KinshipIndex,
  subject: FamilyMemberInput,
  object: FamilyMemberInput,
): string | null {
  const subjectFather = getKinshipFather(index, subject);
  const objectFather = getKinshipFather(index, object);
  if (subjectFather && objectFather
    && subjectFather.id !== objectFather.id
    && areKinshipSiblings(index, subjectFather, objectFather)) {
    return subject.gender === 'female' ? 'ابنة عم' : 'ابن عم';
  }

  const objectMother = getKinshipMother(index, object);
  if (subjectFather && objectMother
    && areKinshipSiblings(index, subjectFather, objectMother)) {
    return subject.gender === 'female' ? 'ابنة خال' : 'ابن خال';
  }

  const subjectMother = getKinshipMother(index, subject);
  if (subjectMother && objectFather
    && areKinshipSiblings(index, subjectMother, objectFather)) {
    return subject.gender === 'female' ? 'ابنة خاله' : 'ابن خاله';
  }

  const objectMotherForMaternal = getKinshipMother(index, object);
  if (subjectMother && objectMotherForMaternal
    && subjectMother.id !== objectMotherForMaternal.id
    && areKinshipSiblings(index, subjectMother, objectMotherForMaternal)) {
    return subject.gender === 'female' ? 'ابنة خالة' : 'ابن خالة';
  }

  return null;
}

function describeDescendantTerm(
  index: KinshipIndex,
  ancestor: FamilyMemberInput,
  descendant: FamilyMemberInput,
  maxDepth = 6,
): string | null {
  const depth = getKinshipDescendantDepth(index, ancestor.id, descendant.id, maxDepth);
  if (depth == null) return null;

  if (depth === 1) return describeChildTerm(index, descendant, ancestor);
  if (depth === 2) return descendant.gender === 'female' ? 'حفيدة' : 'حفيد';
  if (depth === 3) return descendant.gender === 'female' ? 'بنت حفيدة' : 'ابن حفيد';
  return descendant.gender === 'female' ? 'من النسل' : 'من النسل';
}

function describeViaObjectSiblingTerm(
  index: KinshipIndex,
  subject: FamilyMemberInput,
  object: FamilyMemberInput,
): string | null {
  for (const sibling of getKinshipSiblings(index, object)) {
    if (describeChildTerm(index, subject, sibling)) {
      if (sibling.gender === 'female') {
        return subject.gender === 'female' ? 'ابنة أخت' : 'ابن أخت';
      }
      return subject.gender === 'female' ? 'ابنة أخ' : 'ابن أخ';
    }

    const depth = getKinshipDescendantDepth(index, sibling.id, subject.id, 4);
    if (depth === 2) {
      if (sibling.gender === 'female') {
        return subject.gender === 'female' ? 'حفيدة أخت' : 'حفيد أخت';
      }
      return subject.gender === 'female' ? 'حفيدة أخ' : 'حفيد أخ';
    }
    if (depth === 3) {
      if (sibling.gender === 'female') {
        return subject.gender === 'female' ? 'بنت حفيدة أخت' : 'ابن حفيد أخت';
      }
      return subject.gender === 'female' ? 'بنت حفيدة أخ' : 'ابن حفيد أخ';
    }
  }

  return null;
}

function describeAncestorTerm(
  index: KinshipIndex,
  subject: FamilyMemberInput,
  object: FamilyMemberInput,
  maxDepth = 6,
): string | null {
  let current: FamilyMemberInput | null = object;
  const visited = new Set<number>();

  for (let depth = 1; depth <= maxDepth && current; depth += 1) {
    if (visited.has(current.id)) break;
    visited.add(current.id);

    const father = getKinshipFather(index, current);
    if (father) {
      if (father.id === subject.id) {
        if (depth === 1) return describeParentTerm(index, subject, object);
        if (depth === 2) return subject.gender === 'female' ? 'جدة' : 'جد';
        return 'من الأسلاف';
      }
      current = father;
      continue;
    }

    const mother = getKinshipMother(index, current);
    if (mother) {
      if (mother.id === subject.id) {
        if (depth === 1) return describeParentTerm(index, subject, object);
        return 'جدة';
      }
      current = mother;
      continue;
    }

    break;
  }

  return null;
}

function resolveKinshipTerm(
  index: KinshipIndex,
  subject: FamilyMemberInput,
  object: FamilyMemberInput,
): string | null {
  const checks = [
    () => describeParentTerm(index, subject, object),
    () => describeChildTerm(index, subject, object),
    () => (areKinshipSiblings(index, subject, object) ? describeSiblingTerm(subject) : null),
    () => (areKinshipSpouses(index, subject.id, object.id) ? describeSpouseTerm(subject) : null),
    () => describeInLawTerm(index, subject, object),
    () => describeUncleAuntTerm(index, subject, object),
    () => describeViaObjectSiblingTerm(index, subject, object),
    () => describeCousinTerm(index, subject, object),
    () => describeGrandparentTerm(index, subject, object),
    () => describeDescendantTerm(index, subject, object),
    () => describeDescendantTerm(index, object, subject),
    () => describeAncestorTerm(index, subject, object),
    () => describeDistantKinship(subject, object, index),
  ];

  for (const check of checks) {
    const term = check();
    if (term) return term;
  }

  return null;
}

export function computeKinshipRelation(input: KinshipRelationInput): KinshipRelationResult {
  const subjectResolution = resolveKinshipMember(input.members, input.subjectQuery, input.familyId);
  if (subjectResolution.notFound) {
    return { ok: false, message: 'لم نعثر على الشخص الأول في شجرة العائلة.' };
  }
  if (subjectResolution.ambiguous.length > 0) {
    const names = subjectResolution.ambiguous
      .map((member) => memberLabel(member, input.members, input.familyId))
      .join('، ');
    return {
      ok: false,
      message: 'الشخص الأول غير واضح.',
      detail: `وجدنا أكثر من تطابق: ${names}. استخدم اسماً أكثر تحديداً.`,
    };
  }

  const objectResolution = resolveKinshipMember(input.members, input.objectQuery, input.familyId);
  if (objectResolution.notFound) {
    return { ok: false, message: 'لم نعثر على الشخص الثاني في شجرة العائلة.' };
  }
  if (objectResolution.ambiguous.length > 0) {
    const names = objectResolution.ambiguous
      .map((member) => memberLabel(member, input.members, input.familyId))
      .join('، ');
    return {
      ok: false,
      message: 'الشخص الثاني غير واضح.',
      detail: `وجدنا أكثر من تطابق: ${names}. استخدم اسماً أكثر تحديداً.`,
    };
  }

  const subject = subjectResolution.member!;
  const object = objectResolution.member!;

  if (subject.id === object.id) {
    return { ok: true, message: 'نفس الشخص.' };
  }

  const index = input.index ?? buildKinshipIndex(input.members, input.familyId, input.people);
  const term = resolveKinshipTerm(index, subject, object);

  if (term) {
    return {
      ok: true,
      message: formatKinshipMessage(input.subjectQuery, input.objectQuery, term),
    };
  }

  const subjectLabel = memberLabel(subject, input.members, input.familyId);
  const objectLabel = memberLabel(object, input.members, input.familyId);
  return {
    ok: false,
    message: `لم نجد مسار قرابة بين ${subjectLabel} و${objectLabel} ضمن بيانات الشجرة الحالية.`,
    detail: 'تأكد من اكتمال روابط الأب والأم والزواج في الشجرة، واختر الأسماء من القائمة.',
  };
}

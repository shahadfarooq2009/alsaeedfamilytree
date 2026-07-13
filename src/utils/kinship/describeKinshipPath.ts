import type { FamilyMemberInput } from '../treeLayout/types';
import { collectAncestorDepths } from './kinshipGraph';
import type { KinshipIndex } from './kinshipIndex';

function isFemale(member: FamilyMemberInput): boolean {
  return member.gender === 'female';
}

function describeUpGenerations(count: number, female: boolean): string {
  if (count <= 0) return '';
  if (count === 1) return female ? 'ابنة' : 'ابن';
  if (count === 2) return female ? 'حفيدة' : 'حفيد';
  if (count === 3) return female ? 'بنت حفيدة' : 'ابن حفيد';
  return female ? 'من النسل' : 'من النسل';
}

function describeDownGenerations(count: number, female: boolean): string {
  if (count <= 0) return '';
  if (count === 1) return female ? 'والدة' : 'والد';
  if (count === 2) return female ? 'جدة' : 'جد';
  if (count === 3) return female ? 'جدّة' : 'جدّ';
  return female ? 'من الأسلاف' : 'من الأسلاف';
}

function describeCousinBase(side: 'paternal' | 'maternal', female: boolean): string {
  if (side === 'maternal') return female ? 'ابنة خال' : 'ابن خال';
  return female ? 'ابنة عم' : 'ابن عم';
}

function describeBloodRelationFromLca(
  subject: FamilyMemberInput,
  subjectDepth: number,
  objectDepth: number,
  side: 'paternal' | 'maternal' | 'mixed',
): string | null {
  const subjectFemale = isFemale(subject);
  const gSubject = subjectDepth;
  const gObject = objectDepth;

  if (gSubject === 0 && gObject === 0) return null;

  if (gObject === 0 && gSubject > 0) {
    return describeUpGenerations(gSubject, subjectFemale);
  }

  if (gSubject === 0 && gObject > 0) {
    return describeDownGenerations(gObject, subjectFemale);
  }

  if (gSubject === 1 && gObject === 1) {
    return subjectFemale ? 'أخت' : 'أخ';
  }

  if (gSubject === 2 && gObject === 1) {
    return subjectFemale
      ? (side === 'maternal' ? 'خالة' : 'عمة')
      : (side === 'maternal' ? 'خال' : 'عم');
  }

  if (gSubject === 1 && gObject === 2) {
    return subjectFemale ? 'ابنة أخت' : 'ابن أخ';
  }

  const cousinSide = side === 'maternal' ? 'maternal' : 'paternal';
  const cousinBase = describeCousinBase(cousinSide, subjectFemale);
  const minGen = Math.min(gSubject, gObject) - 1;
  const removed = Math.abs(gSubject - gObject);

  if (minGen === 1 && removed === 0) {
    return cousinBase;
  }

  if (minGen === 1 && removed === 1) {
    if (gSubject > gObject) {
      return subjectFemale ? `ابنة ${cousinBase}` : `ابن ${cousinBase}`;
    }
    return subjectFemale ? `خالة ${cousinBase}` : `عم ${cousinBase}`;
  }

  if (minGen === 1 && removed === 2) {
    if (gSubject > gObject) {
      return subjectFemale ? `حفيدة ${cousinBase}` : `حفيد ${cousinBase}`;
    }
    return subjectFemale ? `ابنة ${cousinBase}` : `ابن ${cousinBase}`;
  }

  if (minGen === 2 && removed === 0) {
    return subjectFemale ? `ابنة ${cousinBase}` : `ابن ${cousinBase}`;
  }

  if (minGen === 2 && removed === 1) {
    if (gSubject > gObject) {
      return subjectFemale
        ? `حفيدة بنت ${cousinSide === 'maternal' ? 'خال' : 'عم'}`
        : `حفيد ابن ${cousinSide === 'maternal' ? 'خال' : 'عم'}`;
    }
    return subjectFemale ? `ابنة ${cousinBase}` : `ابن ${cousinBase}`;
  }

  if (minGen >= 2 && removed >= 1) {
    const deeper = gSubject > gObject ? gSubject - gObject : 0;
    if (deeper >= 2) {
      return subjectFemale ? `حفيدة ${cousinBase}` : `حفيد ${cousinBase}`;
    }
    if (deeper === 1) {
      return subjectFemale ? `ابنة ${cousinBase}` : `ابن ${cousinBase}`;
    }
  }

  return subjectFemale ? 'قريبة' : 'قريب';
}

function describeByCommonAncestor(
  subject: FamilyMemberInput,
  object: FamilyMemberInput,
  index: KinshipIndex,
): string | null {
  const subjectAncestors = collectAncestorDepths(subject, index);
  const objectAncestors = collectAncestorDepths(object, index);

  let best: {
    total: number;
    subjectDepth: number;
    objectDepth: number;
    side: 'paternal' | 'maternal' | 'mixed';
  } | null = null;

  for (const [ancestorId, subjectInfo] of subjectAncestors) {
    const objectInfo = objectAncestors.get(ancestorId);
    if (!objectInfo) continue;

    const total = subjectInfo.depth + objectInfo.depth;
    if (total === 0) continue;

    let side: 'paternal' | 'maternal' | 'mixed' = 'paternal';
    if (subjectInfo.throughMother && objectInfo.throughMother) side = 'maternal';
    else if (subjectInfo.throughMother || objectInfo.throughMother) side = 'mixed';

    if (!best || total < best.total) {
      best = {
        total,
        subjectDepth: subjectInfo.depth,
        objectDepth: objectInfo.depth,
        side,
      };
    }
  }

  if (!best) return null;

  return describeBloodRelationFromLca(
    subject,
    best.subjectDepth,
    best.objectDepth,
    best.side,
  );
}

export function describeDistantKinship(
  subject: FamilyMemberInput,
  object: FamilyMemberInput,
  index: KinshipIndex,
): string | null {
  return describeByCommonAncestor(subject, object, index);
}

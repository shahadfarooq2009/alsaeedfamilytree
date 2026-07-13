import { isFounderMember } from './constants';
import { REFERENCE_CARD_SIZES } from './treeLayoutScale';

/** Fixed reference card widths by generation — matches family-tree-reference.png. */
export function cardWidthForMemberFromScale(member: {
  fatherId: number | null;
  generation: number;
  fullName: string;
}): number {
  if (isFounderMember(member)) {
    return REFERENCE_CARD_SIZES.founder.width;
  }

  if (member.generation <= 1) {
    return REFERENCE_CARD_SIZES.generation1.width;
  }
  if (member.generation === 2) {
    return REFERENCE_CARD_SIZES.generation2.width;
  }
  if (member.generation === 3) {
    return REFERENCE_CARD_SIZES.generation3.width;
  }
  return REFERENCE_CARD_SIZES.default.width;
}

export function cardHeightForMemberFromScale(member: {
  fatherId: number | null;
  generation: number;
}): number {
  if (isFounderMember(member)) {
    return REFERENCE_CARD_SIZES.founder.height;
  }

  if (member.generation <= 1) {
    return REFERENCE_CARD_SIZES.generation1.height;
  }
  if (member.generation === 2) {
    return REFERENCE_CARD_SIZES.generation2.height;
  }
  if (member.generation === 3) {
    return REFERENCE_CARD_SIZES.generation3.height;
  }
  return REFERENCE_CARD_SIZES.default.height;
}

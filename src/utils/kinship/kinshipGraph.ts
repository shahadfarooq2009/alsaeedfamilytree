import type { FamilyMemberInput } from '../treeLayout/types';
import { getKinshipFather, getKinshipMother, type KinshipIndex } from './kinshipIndex';

export interface AncestorDepth {
  depth: number;
  throughMother: boolean;
}

export function collectAncestorDepths(
  member: FamilyMemberInput,
  index: KinshipIndex,
  maxDepth = 12,
): Map<number, AncestorDepth> {
  const depths = new Map<number, AncestorDepth>();
  const queue: Array<{ member: FamilyMemberInput; depth: number; throughMother: boolean }> = [
    { member, depth: 0, throughMother: false },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.depth > maxDepth) continue;

    const existing = depths.get(current.member.id);
    if (existing && existing.depth <= current.depth) continue;

    depths.set(current.member.id, {
      depth: current.depth,
      throughMother: current.throughMother,
    });

    const father = getKinshipFather(index, current.member);
    if (father) {
      queue.push({ member: father, depth: current.depth + 1, throughMother: false });
    }

    const mother = getKinshipMother(index, current.member);
    if (mother) {
      queue.push({ member: mother, depth: current.depth + 1, throughMother: true });
    }
  }

  return depths;
}

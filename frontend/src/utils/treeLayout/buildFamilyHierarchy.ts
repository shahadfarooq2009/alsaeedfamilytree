import type { HierarchyNode } from '../../types/person';
import type { FamilyMemberInput, LayoutTreeNode } from './types';

function memberInitial(name: string): string {
  const firstName = name.trim().split(/\s+/)[0];
  return firstName ? firstName.charAt(0) : '?';
}

/** Flatten nested API hierarchy nodes into a flat member list (deduplicated by id). */
export function flattenHierarchyNodes(
  nodes: HierarchyNode[],
  generation = 1,
  seen = new Map<number, FamilyMemberInput>(),
): FamilyMemberInput[] {
  nodes.forEach((node) => {
    const resolvedFatherId = node.father_id ?? null;
    const resolvedMotherId = node.mother_id ?? null;

    if (!seen.has(node.id)) {
      seen.set(node.id, {
        id: node.id,
        fullName: node.full_name,
        fatherId: resolvedFatherId,
        motherId: resolvedMotherId,
        gender: node.gender ?? undefined,
        generation: node.generation_number ?? generation,
        initial: memberInitial(node.full_name),
        photoUrl: node.photo_url ?? null,
        isFamilyHead: node.is_family_head ?? false,
      });
    } else {
      const existing = seen.get(node.id)!;
      if (existing.fatherId == null && resolvedFatherId != null) {
        existing.fatherId = resolvedFatherId;
      }
      if (existing.motherId == null && resolvedMotherId != null) {
        existing.motherId = resolvedMotherId;
      }
      if (existing.photoUrl == null && node.photo_url) {
        existing.photoUrl = node.photo_url;
      }
      if (node.is_family_head) {
        existing.isFamilyHead = true;
      }
    }

    if (node.children?.length) {
      flattenHierarchyNodes(node.children, generation + 1, seen);
    }
  });

  return Array.from(seen.values());
}

/** Build layout tree using direct father_id links only. */
export function buildFamilyHierarchy(members: FamilyMemberInput[]): LayoutTreeNode[] {
  const byId = new Map<number, LayoutTreeNode>();

  members.forEach((member) => {
    byId.set(member.id, {
      ...member,
      children: [],
      subtreeWidth: 0,
      x: 0,
      y: 0,
    });
  });

  const roots: LayoutTreeNode[] = [];

  byId.forEach((node) => {
    if (node.fatherId != null && byId.has(node.fatherId)) {
      byId.get(node.fatherId)!.children.push(node);
      return;
    }
    roots.push(node);
  });

  const sortTree = (node: LayoutTreeNode): void => {
    node.children.sort((a, b) => a.generation - b.generation || a.id - b.id);
    node.children.forEach(sortTree);
  };

  roots.sort((a, b) => a.generation - b.generation || a.id - b.id);
  roots.forEach(sortTree);

  if (roots.length > 1) {
    return mergeOrphanRootsUnderFounder(roots);
  }

  if (roots.length === 0 && byId.size > 0) {
    const founder = [...byId.values()].find((node) => node.isFamilyHead)
      ?? [...byId.values()].sort((a, b) => a.generation - b.generation || a.id - b.id)[0];
    return [founder];
  }

  return roots;
}

/** Parentless branch heads (Jihan, Nabila, Farouq…) attach under the founder. */
function mergeOrphanRootsUnderFounder(roots: LayoutTreeNode[]): LayoutTreeNode[] {
  const founder = roots.find((root) => root.isFamilyHead)
    ?? [...roots].sort((a, b) => a.generation - b.generation || a.id - b.id)[0];

  roots.forEach((root) => {
    if (root.id === founder.id) return;
    if (founder.children.some((child) => child.id === root.id)) return;
    founder.children.push(root);
  });

  const sortTree = (node: LayoutTreeNode): void => {
    node.children.sort((a, b) => a.generation - b.generation || a.id - b.id);
    node.children.forEach(sortTree);
  };

  sortTree(founder);
  return [founder];
}

/** Collect all nodes in pre-order (for bounds / collision). */
export function flattenLayoutNodes(roots: LayoutTreeNode[]): LayoutTreeNode[] {
  const out: LayoutTreeNode[] = [];

  const walk = (node: LayoutTreeNode): void => {
    if (node.id >= 0) out.push(node);
    node.children.forEach(walk);
  };

  roots.forEach(walk);
  return out;
}

import { isFounderMember } from './constants';
import {
  buildPrimaryTreeParentMap,
  computeMainBranchRootMap,
  resolvePrimaryTreeParentId,
} from './primaryTreeParent';
import { sortSiblingTree, sortSiblingsByAddOrder } from './siblingOrder';
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
        generation: node.is_family_head
          ? 1
          : (node.generation_number != null && node.generation_number > 0
            ? node.generation_number
            : 0),
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
        existing.generation = 1;
      }
      if (node.generation_number != null && node.generation_number > 0) {
        existing.generation = node.generation_number;
      }
    }

    if (node.children?.length) {
      flattenHierarchyNodes(node.children, generation + 1, seen);
    }
  });

  return Array.from(seen.values());
}

/** Build layout tree using explicit primaryTreeParentId links. */
export function buildFamilyHierarchy(members: FamilyMemberInput[]): LayoutTreeNode[] {
  const parentMap = buildPrimaryTreeParentMap(members);
  const memberIds = new Set(members.map((member) => member.id));
  const byId = new Map<number, LayoutTreeNode>();

  members.forEach((member) => {
    byId.set(member.id, {
      ...member,
      children: [],
      subtreeWidth: 0,
      x: 0,
      y: 0,
      primaryTreeParentId: parentMap.get(member.id) ?? null,
      mainBranchRootId: null,
    });
  });

  const roots: LayoutTreeNode[] = [];

  byId.forEach((node) => {
    const parentId = node.primaryTreeParentId;
    if (parentId != null && byId.has(parentId)) {
      byId.get(parentId)!.children.push(node);
      return;
    }
    roots.push(node);
  });

  const sortTree = (node: LayoutTreeNode): void => {
    sortSiblingTree(node);
  };

  roots.sort((a, b) => a.id - b.id);
  roots.forEach(sortTree);

  let resolvedRoots = roots;
  if (roots.length > 1) {
    resolvedRoots = mergeOrphanRootsUnderFounder(roots);
  }

  if (resolvedRoots.length === 0 && byId.size > 0) {
    const founder = [...byId.values()].find((node) => node.isFamilyHead)
      ?? sortSiblingsByAddOrder([...byId.values()])[0];
    resolvedRoots = [founder];
  }

  const founder = resolvedRoots[0];
  if (founder) {
    sortSiblingTree(founder);
    const founderChildIds = new Set(founder.children.map((child) => child.id));
    const branchRootMap = computeMainBranchRootMap(memberIds, parentMap, founderChildIds);

    const assignBranchRoots = (node: LayoutTreeNode): void => {
      node.mainBranchRootId = isFounderMember(node) ? null : (branchRootMap.get(node.id) ?? node.id);
      node.children.forEach(assignBranchRoots);
    };
    assignBranchRoots(founder);
  }

  return resolvedRoots;
}

/** Parentless branch heads attach under the founder. */
function mergeOrphanRootsUnderFounder(roots: LayoutTreeNode[]): LayoutTreeNode[] {
  const founder = roots.find((root) => root.isFamilyHead)
    ?? sortSiblingsByAddOrder(roots)[0];

  roots.forEach((root) => {
    if (root.id === founder.id) return;
    if (founder.children.some((child) => child.id === root.id)) return;
    root.primaryTreeParentId = founder.id;
    founder.children.push(root);
  });

  sortSiblingTree(founder);
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

export { resolvePrimaryTreeParentId, buildPrimaryTreeParentMap };

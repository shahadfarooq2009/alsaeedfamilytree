import { isFounderMember, cardWidthForMember } from './constants';

import { getLayoutScale } from './layoutScaleContext';

import { flattenLayoutNodes } from './buildFamilyHierarchy';

import type { FamilyMemberInput, LayoutTreeNode, PositionedMember, TreeLayoutResult } from './types';

import { generateBranchPathsFromLayout } from './generateBranchPath';

import {

  centerMembersInStage,

  computeUnusedHorizontalSpace,

  layoutFounderTreeWithBranchZones,

  maxNodesPerBranchZone,

  resolveSectorOverlaps,

} from './branchZoneLayout';

import { resolveLayoutCollisions } from './detectCollisions';

import {

  countUnresolvedPrimaryParents,

} from './primaryTreeParent';

import { expandInternalMapCanvas, measureFullLayoutBounds } from './internalMapBounds';

import { validateLayout, type LayoutValidationReport } from './layoutValidation';

import { DEFAULT_STAGE, type LayoutStage } from './stageBounds';



function nodesToMembers(roots: LayoutTreeNode[]): PositionedMember[] {

  return flattenLayoutNodes(roots).map((node) => ({

    id: node.id,

    fullName: node.fullName,

    fatherId: node.fatherId,

    motherId: node.motherId,

    treeParentId: node.treeParentId,

    displayParentId: node.displayParentId,

    gender: node.gender,

    generation: node.generation,

    initial: node.initial,

    photoUrl: node.photoUrl,

    relationLabel: node.relationLabel,

    x: node.x,

    y: node.y,

    primaryTreeParentId: node.primaryTreeParentId,

    mainBranchRootId: node.mainBranchRootId,

  }));

}



function syncPositionsToTree(roots: LayoutTreeNode[], members: PositionedMember[]): void {

  const byId = new Map(members.map((member) => [member.id, member]));



  const walk = (node: LayoutTreeNode): void => {

    const positioned = byId.get(node.id);

    if (positioned) {

      node.x = positioned.x;

      node.y = positioned.y;

    }

    node.children.forEach(walk);

  };



  roots.forEach(walk);

}



function realignFounderOverBranches(members: PositionedMember[]): PositionedMember[] {

  const resolved = members.map((member) => ({ ...member }));

  const founder = resolved.find((member) => isFounderMember(member));

  const branchRoots = resolved.filter((member) => member.mainBranchRootId === member.id);

  if (!founder || branchRoots.length === 0) return resolved;



  const minX = Math.min(...branchRoots.map((member) => member.x));

  const maxX = Math.max(

    ...branchRoots.map((member) => member.x + cardWidthForMember(member)),

  );

  founder.x = Math.round((minX + maxX) / 2 - cardWidthForMember(founder) / 2);

  return resolved;

}



function buildBranchMetrics(members: PositionedMember[], founder: LayoutTreeNode | undefined) {

  const founderDirectChildrenCount = founder?.children.length ?? 0;

  const mainBranchCount = founderDirectChildrenCount;

  const membersPerMainBranch: Record<number, number> = {};



  members.forEach((member) => {

    if (member.mainBranchRootId == null) return;

    membersPerMainBranch[member.mainBranchRootId] =

      (membersPerMainBranch[member.mainBranchRootId] ?? 0) + 1;

  });



  return { founderDirectChildrenCount, mainBranchCount, membersPerMainBranch };

}



function finalizeLayout(

  roots: LayoutTreeNode[],

  stage: LayoutStage,

  inputMembers: FamilyMemberInput[],

): TreeLayoutResult & { validation: LayoutValidationReport } {

  const scale = getLayoutScale();

  const maxCluster = maxNodesPerBranchZone(roots);

  const founder = roots[0];



  layoutFounderTreeWithBranchZones(founder, stage, maxCluster);



  let resolved = nodesToMembers(roots);

  resolved = resolveSectorOverlaps(resolved, stage);

  resolved = resolveLayoutCollisions(resolved, roots);

  resolved = centerMembersInStage(resolved, stage);

  resolved = realignFounderOverBranches(resolved);

  syncPositionsToTree(roots, resolved);



  let connectors = generateBranchPathsFromLayout(roots, resolved);

  const expanded = expandInternalMapCanvas(roots, resolved, connectors, stage);

  resolved = expanded.members;

  connectors = expanded.connectors;

  resolved = resolveLayoutCollisions(resolved, roots);

  syncPositionsToTree(roots, resolved);



  const { canvasWidth, canvasHeight, contentBounds } = expanded;

  const branchMetrics = buildBranchMetrics(resolved, founder);

  const memberIds = new Set(resolved.map((member) => member.id));

  const parentMap = new Map(resolved.map((member) => [member.id, member.primaryTreeParentId]));

  const { unusedLeftWidth, unusedRightWidth } = computeUnusedHorizontalSpace(resolved, stage);



  const validation = validateLayout(resolved, stage, connectors, {

    totalMembers: resolved.length,

    unresolvedPrimaryParentCount: countUnresolvedPrimaryParents(

      inputMembers,

      parentMap,

      memberIds,

    ),

    unusedLeftWidth,

    unusedRightWidth,

    ...branchMetrics,

  });



  const labels: TreeLayoutResult['labels'] = [];



  if (import.meta.env?.DEV && resolved.length >= 10) {

    console.info('[TreeLayout] main-branch validation', {

      totalMembers: validation.totalMembers,

      founderDirectChildrenCount: validation.founderDirectChildrenCount,

      mainBranchCount: validation.mainBranchCount,

      membersPerMainBranch: validation.membersPerMainBranch,

      unresolvedPrimaryParentCount: validation.unresolvedPrimaryParentCount,

      cardsOutsideBounds: validation.cardsOutsideBounds,

      clippedCards: validation.clippedCards,

      overlappingCards: validation.overlappingCards,

      crossBranchConnectorCount: validation.crossBranchConnectorCount,

      connectorCardIntersectionCount: validation.connectorCardIntersectionCount,

      unusedLeftWidth: validation.unusedLeftWidth,

      unusedRightWidth: validation.unusedRightWidth,

      contentBounds,

      fullLayoutBounds: measureFullLayoutBounds(resolved, connectors),

      canvas: { width: canvasWidth, height: canvasHeight },

      card: { width: scale.cardWidth, height: scale.cardHeight },

      founderY: resolved.find((member) => isFounderMember(member))?.y,

    });

  }



  if (!validation.valid && import.meta.env?.DEV) {

    console.warn('[TreeLayout] unresolved layout issues', validation);

  }



  return {

    members: resolved,

    labels,

    connectors,

    canvasWidth,

    canvasHeight,

    contentBounds,

    scale,

    validation,

    layoutFillsStage: false,

  };

}



export function calculateTreeLayout(

  roots: LayoutTreeNode[],

  stage: LayoutStage = DEFAULT_STAGE,

  inputMembers: FamilyMemberInput[] = [],

): TreeLayoutResult & { validation?: LayoutValidationReport; layoutFillsStage?: boolean } {

  if (roots.length === 0) {

    return {

      members: [],

      labels: [],

      connectors: [],

      canvasWidth: stage.width,

      canvasHeight: stage.height,

      contentBounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },

      scale: getLayoutScale(),

      validation: {

        overlappingCards: 0,

        clippedCards: 0,

        hiddenNames: 0,

        overlapPairs: [],

        valid: true,

        totalMembers: 0,

        founderDirectChildrenCount: 0,

        mainBranchCount: 0,

        membersPerMainBranch: {},

        unresolvedPrimaryParentCount: 0,

        cardsOutsideBounds: 0,

        crossBranchConnectorCount: 0,

        connectorCardIntersectionCount: 0,

        unusedLeftWidth: 0,

        unusedRightWidth: 0,

      },

      layoutFillsStage: false,

    };

  }



  return finalizeLayout(roots, stage, inputMembers);

}



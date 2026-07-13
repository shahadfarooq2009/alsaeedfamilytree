export type { PrimaryParentMember } from './primaryTreeParent';
export {
  buildPrimaryTreeParentMap,
  computeMainBranchRootMap,
  countUnresolvedPrimaryParents,
  resolvePrimaryTreeParentId,
} from './primaryTreeParent';

/** @deprecated Use resolvePrimaryTreeParentId */
export { resolvePrimaryTreeParentId as computeLayoutParentId } from './primaryTreeParent';

/** @deprecated Use buildPrimaryTreeParentMap */
export { buildPrimaryTreeParentMap as computeLayoutParentMap } from './primaryTreeParent';

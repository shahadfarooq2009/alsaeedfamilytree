import type { PositionedLink } from '../../types/tree';
import { OrganicBranch } from './OrganicBranch';

interface TreeLinksProps {
  links: PositionedLink[];
}

export function TreeLinks({ links }: TreeLinksProps) {
  return <OrganicBranch links={links} />;
}

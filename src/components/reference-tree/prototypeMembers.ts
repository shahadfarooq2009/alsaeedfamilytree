/** @deprecated Test data removed — tree renders backend members only. */
export interface PrototypeMember {
  id: number;
  fullName: string;
  fatherId: number | null;
  motherId?: number | null;
  gender?: 'male' | 'female';
  generation: number;
  relationLabel: string;
  initial: string;
  x: number;
  y: number;
}

export interface PrototypeBranchLabel {
  text: string;
  x: number;
  y: number;
  width?: number;
}

/** Empty — live tree uses API data only. */
export const prototypeMembers: PrototypeMember[] = [];

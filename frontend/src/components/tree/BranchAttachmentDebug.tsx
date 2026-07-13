import type { BranchInstance } from '../../types/branchInstance';

/** Dev-only branch base/tip markers — disabled by default. */
const SHOW_BRANCH_ATTACHMENTS =
  import.meta.env.DEV && import.meta.env.VITE_SHOW_BRANCH_ATTACHMENTS === 'true';

interface BranchAttachmentDebugProps {
  branches: BranchInstance[];
}

export function BranchAttachmentDebug({ branches }: BranchAttachmentDebugProps) {
  if (!SHOW_BRANCH_ATTACHMENTS) {
    return null;
  }

  return (
    <g className="branch-attachment-debug" pointerEvents="none" aria-hidden>
      {branches.map((branch) => (
        <g key={`dbg-${branch.id}`}>
          <circle
            cx={branch.attachmentStart.x}
            cy={branch.attachmentStart.y}
            r={5}
            fill="#2563eb"
            opacity={0.85}
          />
          <circle
            cx={branch.attachmentEnd.x}
            cy={branch.attachmentEnd.y}
            r={5}
            fill="#c9a227"
            opacity={0.9}
          />
          <line
            x1={branch.attachmentStart.x}
            y1={branch.attachmentStart.y}
            x2={branch.attachmentEnd.x}
            y2={branch.attachmentEnd.y}
            stroke="#dc2626"
            strokeWidth={1}
            strokeDasharray="4 3"
            opacity={0.5}
          />
        </g>
      ))}
    </g>
  );
}

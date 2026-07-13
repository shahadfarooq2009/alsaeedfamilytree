import { memo } from 'react';
import { useViewport, type Node } from '@xyflow/react';

import type { ForestBranchPanelData, ForestFlowNodeData } from '../../utils/familyForest/buildFamilyForestLayout';

interface ForestBranchPanelOverlaysProps {
  panels: Array<Node<ForestFlowNodeData>>;
}

function ForestBranchPanelOverlaysComponent({ panels }: ForestBranchPanelOverlaysProps) {
  const viewport = useViewport();

  if (panels.length === 0) return null;

  return (
    <div className="family-forest__panel-overlays" aria-hidden>
      {panels.map((panel) => {
        const data = panel.data as ForestBranchPanelData;
        const width = panel.width ?? 0;
        const height = panel.height ?? 0;

        return (
          <div
            key={panel.id}
            className={`family-forest-branch-panel is-panel-${data.columnIndex} is-overlay`}
            style={{
              left: panel.position.x * viewport.zoom + viewport.x,
              top: panel.position.y * viewport.zoom + viewport.y,
              width: width * viewport.zoom,
              height: height * viewport.zoom,
              '--branch-color': data.branchColor,
            }}
          >
            {data.memberCount > 0 ? (
              <div className="family-forest-branch-panel__footer">
                إجمالي أفراد الفرع: <strong>{data.memberCount}</strong>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export const ForestBranchPanelOverlays = memo(ForestBranchPanelOverlaysComponent);

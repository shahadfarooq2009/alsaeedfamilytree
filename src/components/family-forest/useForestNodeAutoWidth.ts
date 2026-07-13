import { useLayoutEffect, useRef, type RefObject } from 'react';
import { useReactFlow, useUpdateNodeInternals } from '@xyflow/react';

import type { ForestFounderRailData } from './ForestFounderRail';

interface UseForestNodeAutoWidthOptions {
  memberId: number;
  enabled: boolean;
  minWidth: number;
  measureKey: string;
  anchorCenter?: boolean;
  syncFounderRail?: boolean;
}

function readNodeWidth(width: number | undefined, minWidth: number): number {
  return typeof width === 'number' && Number.isFinite(width) ? width : minWidth;
}

export function useForestNodeAutoWidth({
  memberId,
  enabled,
  minWidth,
  measureKey,
  anchorCenter = false,
  syncFounderRail = false,
}: UseForestNodeAutoWidthOptions): RefObject<HTMLDivElement | null> {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const lastWidthRef = useRef<number | null>(null);
  const { setNodes, getNode } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();

  useLayoutEffect(() => {
    if (!enabled) return undefined;

    const element = cardRef.current;
    if (!element) return undefined;

    const applyMeasuredWidth = () => {
      const naturalWidth = Math.ceil(element.scrollWidth);
      const nextWidth = Math.max(minWidth, naturalWidth);
      if (lastWidthRef.current === nextWidth) return;

      const nodeId = String(memberId);
      const node = getNode(nodeId);
      if (!node) return;

      const prevWidth = readNodeWidth(node.width, minWidth);
      const centerX = node.position.x + prevWidth / 2;
      const nextX = anchorCenter ? centerX - nextWidth / 2 : node.position.x;

      lastWidthRef.current = nextWidth;

      setNodes((nodes) => nodes.map((current) => {
        if (current.id === nodeId) {
          return {
            ...current,
            width: nextWidth,
            position: anchorCenter
              ? { x: nextX, y: current.position.y }
              : current.position,
            style: {
              ...(typeof current.style === 'object' && current.style ? current.style : {}),
              width: nextWidth,
              minWidth,
            },
          };
        }

        if (syncFounderRail && current.type === 'forestFounderRail') {
          const railData = current.data as ForestFounderRailData;
          return {
            ...current,
            data: {
              ...railData,
              founderBottom: {
                ...railData.founderBottom,
                x: centerX,
              },
            },
          };
        }

        return current;
      }));

      updateNodeInternals(nodeId);
    };

    applyMeasuredWidth();

    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(applyMeasuredWidth);
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, [
    anchorCenter,
    enabled,
    getNode,
    measureKey,
    memberId,
    minWidth,
    setNodes,
    syncFounderRail,
    updateNodeInternals,
  ]);

  return cardRef;
}

import { useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react';
import type { BranchConnectorPath } from '../../utils/treeLayout/types';

interface ReferenceBranchConnectorsProps {
  connectors: BranchConnectorPath[];
  canvasWidth: number;
  canvasHeight: number;
  selectedId?: number | null;
  hoveredId?: number | null;
  focusPathIds?: number[];
  focusChildIds?: number[];
  siblingIds?: number[];
  pathAnimationOrder?: Map<string, number>;
  pathAnimKey?: number;
}

export function ReferenceBranchConnectors({
  connectors,
  canvasWidth,
  canvasHeight,
  selectedId = null,
  hoveredId = null,
  focusPathIds = [],
  focusChildIds = [],
  siblingIds = [],
  pathAnimationOrder = new Map(),
  pathAnimKey = 0,
}: ReferenceBranchConnectorsProps) {
  const activeId = selectedId ?? hoveredId;
  const pathIdSet = new Set(focusPathIds);
  const childIdSet = new Set(focusChildIds);
  const siblingIdSet = new Set(siblingIds);
  const pathRefs = useRef<Map<string, SVGPathElement>>(new Map());
  const focusActive = activeId != null;

  const connectorClassName = (path: BranchConnectorPath) => {
    const classes = ['tree-connector-core', `tree-connector-core-${path.type}`];
    const highlightsAncestry = focusActive
      && pathIdSet.has(path.parentId)
      && pathIdSet.has(path.childId);
    const highlightsChild = focusActive
      && path.parentId === activeId
      && childIdSet.has(path.childId);
    const highlightsToActive = focusActive
      && path.childId === activeId
      && pathIdSet.has(path.parentId);
    const highlightsSiblingBranch = focusActive
      && siblingIdSet.has(path.childId)
      && path.parentId === (focusPathIds[1] ?? path.parentId);

    if (highlightsAncestry || highlightsToActive) classes.push('is-focus-path');
    if (highlightsChild || highlightsSiblingBranch) classes.push('is-focus-child');
    if (focusActive && !highlightsAncestry && !highlightsChild && !highlightsToActive && !highlightsSiblingBranch) {
      classes.push('is-muted');
    }
    if (focusActive && pathAnimationOrder.has(path.key) && selectedId != null) {
      classes.push('is-path-draw');
    }
    return classes.join(' ');
  };

  const animatedKeys = useMemo(
    () => Array.from(pathAnimationOrder.keys()).join('|'),
    [pathAnimationOrder],
  );

  useLayoutEffect(() => {
    if (!focusActive || selectedId == null) return;

    pathAnimationOrder.forEach((index, key) => {
      const el = pathRefs.current.get(key);
      if (!el) return;

      const length = el.getTotalLength();
      el.style.setProperty('--path-length', `${length}`);
      el.style.setProperty('--path-index', `${index}`);
      el.style.strokeDasharray = `${length}`;
      el.style.strokeDashoffset = `${length}`;
      el.style.animation = 'none';
      void el.getBoundingClientRect();
      el.style.removeProperty('animation');
    });
  }, [focusActive, pathAnimKey, animatedKeys, pathAnimationOrder, selectedId]);

  const registerPathRef = (key: string, element: SVGPathElement | null) => {
    if (element) {
      pathRefs.current.set(key, element);
      return;
    }
    pathRefs.current.delete(key);
  };

  const pathStyle = (key: string): CSSProperties | undefined => {
    if (!pathAnimationOrder.has(key)) return undefined;
    return { ['--path-index' as string]: pathAnimationOrder.get(key) };
  };

  return (
    <svg
      className="branches family-tree-connections family-tree-map-svg"
      viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
      width={canvasWidth}
      height={canvasHeight}
      aria-hidden
    >
      {connectors.map((path) => (
        <g key={path.key} className="tree-connector-simple" style={pathStyle(path.key)}>
          <path
            d={path.d}
            ref={(element) => registerPathRef(path.key, element)}
            className={connectorClassName(path)}
          />
        </g>
      ))}
    </svg>
  );
}

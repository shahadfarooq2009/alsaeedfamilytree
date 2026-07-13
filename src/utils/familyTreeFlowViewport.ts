import type { Node } from '@xyflow/react';

const DEFAULT_NODE_WIDTH = 104;
const DEFAULT_NODE_HEIGHT = 76;
const MEMBER_BADGE_OVERHANG = 21;
const FOUNDER_BADGE_OVERHANG = 24;
const GEN5_ICON_SIZE = 22;
const GEN5_NODE_WIDTH = 58;
const GEN5_NODE_HEIGHT = 34;
const FIT_BOUNDS_MARGIN = 56;

export const FULL_TREE_FIT_MIN_ZOOM = 0.02;

export interface FlowViewport {
  x: number;
  y: number;
  zoom: number;
}

const DEFAULT_VIEWPORT_ZOOM_EPSILON = 0.015;
const DEFAULT_VIEWPORT_PAN_EPSILON = 4;

export function viewportsApproximatelyEqual(
  a: FlowViewport,
  b: FlowViewport,
  zoomEpsilon = DEFAULT_VIEWPORT_ZOOM_EPSILON,
  panEpsilon = DEFAULT_VIEWPORT_PAN_EPSILON,
): boolean {
  return (
    Math.abs(a.zoom - b.zoom) < zoomEpsilon
    && Math.abs(a.x - b.x) < panEpsilon
    && Math.abs(a.y - b.y) < panEpsilon
  );
}

export function computeMemberBounds(nodes: Node[], margin = FIT_BOUNDS_MARGIN) {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  nodes.forEach((node) => {
    let width = node.width ?? DEFAULT_NODE_WIDTH;
    let height = node.height ?? DEFAULT_NODE_HEIGHT;
    let top = node.position.y;

    if (node.type === 'gen5Icon') {
      width = GEN5_ICON_SIZE;
      height = GEN5_ICON_SIZE;
    } else if (node.type === 'gen5Member') {
      width = GEN5_NODE_WIDTH;
      height = GEN5_NODE_HEIGHT;
    } else if (node.type === 'familyMember') {
      const isFounder = Boolean((node.data as { isFounder?: boolean } | undefined)?.isFounder);
      top -= isFounder ? FOUNDER_BADGE_OVERHANG : MEMBER_BADGE_OVERHANG;
    }

    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, top);
    maxX = Math.max(maxX, node.position.x + width);
    maxY = Math.max(maxY, node.position.y + height);
  });

  const paddedMinX = minX - margin;
  const paddedMinY = minY - margin;
  const paddedMaxX = maxX + margin;
  const paddedMaxY = maxY + margin;

  return {
    minX: paddedMinX,
    minY: paddedMinY,
    maxX: paddedMaxX,
    maxY: paddedMaxY,
    width: paddedMaxX - paddedMinX,
    height: paddedMaxY - paddedMinY,
  };
}

export interface FitViewportOptions {
  padding?: number;
  maxZoom?: number;
  /** Fill horizontal space so branch columns stay readable; pan vertically for the rest. */
  preferWidth?: boolean;
}

export function computeFitViewport(
  memberNodes: Node[],
  viewportWidth: number,
  viewportHeight: number,
  paddingOrOptions: number | FitViewportOptions = 0.18,
  maxZoom = 1.8,
): FlowViewport {
  const options = typeof paddingOrOptions === 'number'
    ? { padding: paddingOrOptions, maxZoom, preferWidth: false }
    : {
      padding: paddingOrOptions.padding ?? 0.18,
      maxZoom: paddingOrOptions.maxZoom ?? 1.8,
      preferWidth: paddingOrOptions.preferWidth ?? false,
    };

  if (
    memberNodes.length === 0
    || viewportWidth <= 0
    || viewportHeight <= 0
  ) {
    return { x: 0, y: 0, zoom: 1 };
  }

  const bounds = computeMemberBounds(memberNodes);
  if (bounds.width <= 0 || bounds.height <= 0) {
    return { x: 0, y: 0, zoom: 1 };
  }

  const paddedWidth = viewportWidth * (1 - options.padding * 2);
  const paddedHeight = viewportHeight * (1 - options.padding * 2);
  const zoomByWidth = paddedWidth / bounds.width;
  const zoomByHeight = paddedHeight / bounds.height;
  const zoom = options.preferWidth
    ? Math.min(zoomByWidth, options.maxZoom)
    : Math.min(zoomByWidth, zoomByHeight, options.maxZoom);

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  return {
    x: viewportWidth / 2 - centerX * zoom,
    y: viewportHeight / 2 - centerY * zoom,
    zoom,
  };
}

export const TREE_SVG_NODE_ID = 'tree-svg-bg';

/** Smooth zoom-in / zoom-out timing — matches member focus panel easing. */
export const VIEWPORT_FOCUS_ZOOM_IN_MS = 1100;
export const VIEWPORT_FOCUS_ZOOM_OUT_MS = 1000;

/** Ease-out cubic — close to cubic-bezier(0.22, 1, 0.36, 1). */
export function viewportFocusEase(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - (1 - clamped) ** 3;
}

export interface ViewportAnimationHandle {
  cancel: () => void;
  finished: Promise<void>;
}

/** Animate x/y/zoom between two viewports with custom easing. */
export function animateFlowViewport(
  getViewport: () => FlowViewport,
  setViewport: (viewport: FlowViewport) => void,
  target: FlowViewport,
  duration: number,
  options?: {
    ease?: (t: number) => number;
    onFrame?: () => void;
    onComplete?: () => void;
  },
): ViewportAnimationHandle {
  const ease = options?.ease ?? viewportFocusEase;
  const start = getViewport();
  const startTime = performance.now();
  let frameId: number | null = null;
  let resolveDone: (() => void) | null = null;

  const finished = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  const cancel = () => {
    if (frameId != null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
    resolveDone?.();
    resolveDone = null;
  };

  const step = (now: number) => {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / duration);
    const eased = ease(progress);

    setViewport({
      x: start.x + (target.x - start.x) * eased,
      y: start.y + (target.y - start.y) * eased,
      zoom: start.zoom + (target.zoom - start.zoom) * eased,
    });
    options?.onFrame?.();

    if (progress < 1) {
      frameId = requestAnimationFrame(step);
      return;
    }

    frameId = null;
    options?.onComplete?.();
    resolveDone?.();
    resolveDone = null;
  };

  frameId = requestAnimationFrame(step);
  return { cancel, finished };
}

export function computeCenteredViewport(
  centerX: number,
  centerY: number,
  zoom: number,
  viewportWidth: number,
  viewportHeight: number,
): FlowViewport {
  return {
    x: viewportWidth / 2 - centerX * zoom,
    y: viewportHeight / 2 - centerY * zoom,
    zoom,
  };
}

const TOOLBAR_ZOOM_STEP_FACTOR = 1.2;

/** Toolbar zoom around the visible center — avoids RTL/d3 scaleBy pan drift. */
export function zoomViewportAroundCenter(
  current: FlowViewport,
  viewportWidth: number,
  viewportHeight: number,
  direction: 'in' | 'out',
  minZoom: number,
  maxZoom: number,
  stepFactor = TOOLBAR_ZOOM_STEP_FACTOR,
): FlowViewport | null {
  if (viewportWidth <= 0 || viewportHeight <= 0) {
    return null;
  }

  const factor = direction === 'in' ? stepFactor : 1 / stepFactor;
  const nextZoom = Math.min(
    maxZoom,
    Math.max(minZoom, Number((current.zoom * factor).toFixed(4))),
  );

  if (Math.abs(nextZoom - current.zoom) < 0.0001) {
    return null;
  }

  const focusX = (viewportWidth / 2 - current.x) / current.zoom;
  const focusY = (viewportHeight / 2 - current.y) / current.zoom;

  return computeCenteredViewport(
    focusX,
    focusY,
    nextZoom,
    viewportWidth,
    viewportHeight,
  );
}

/** Tree layer aligned to the active viewport — zooms/pans with the map. */
export function createViewportTreeBackgroundNode(
  viewportWidth: number,
  viewportHeight: number,
  viewport: FlowViewport,
  bleed = 1,
): Node {
  const zoom = Math.max(viewport.zoom, 0.0001);
  const screenFlowWidth = viewportWidth / zoom;
  const screenFlowHeight = viewportHeight / zoom;
  const screenFlowX = -viewport.x / zoom;
  const screenFlowY = -viewport.y / zoom;
  const width = screenFlowWidth * bleed;
  const height = screenFlowHeight * bleed;
  const x = screenFlowX - (width - screenFlowWidth) / 2;
  const y = screenFlowY - (height - screenFlowHeight) / 2;

  return {
    id: TREE_SVG_NODE_ID,
    type: 'treeSvg',
    position: { x, y },
    data: {},
    draggable: false,
    selectable: false,
    focusable: false,
    connectable: false,
    deletable: false,
    zIndex: 0,
    width,
    height,
    style: {
      width,
      height,
      padding: 0,
      border: 'none',
      background: 'transparent',
      pointerEvents: 'none',
    },
  };
}

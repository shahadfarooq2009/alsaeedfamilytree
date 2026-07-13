import {
  Component,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type MouseEvent,
  type RefObject,
} from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  type Node,
  type NodeMouseHandler,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { FamilyMemberInput } from '../../utils/treeLayout/types';
import {
  buildFamilyTreeFlowLayout,
  type FamilyTreeLayoutOptions,
  type FamilyTreeNodeData,
  type FlowNodeData,
  type Gen5IconNodeData,
  type Gen5MemberNodeData,
} from '../../utils/buildFamilyTreeFlowLayout';
import {
  ADAPTIVE_MAX_ZOOM,
  ADAPTIVE_MIN_ZOOM,
  computeAdaptiveZoom,
  countVisibleFlowNodes,
  GEN5_FIT_DURATION_MS,
  GEN5_ZOOM_THRESHOLD,
  getGen4ParentsWithGen5Children,
} from '../../utils/gen5Expansion';
import {
  applyPathHighlightToEdges,
  applyPathHighlightToMemberNodes,
  getAncestorPathIds,
  getHighlightedEdgeIds,
} from '../../utils/familyTreeFlowPath';
import {
  animateFlowViewport,
  computeCenteredViewport,
  computeFitViewport,
  FULL_TREE_FIT_MIN_ZOOM,
  TREE_SVG_NODE_ID,
  viewportsApproximatelyEqual,
  VIEWPORT_FOCUS_ZOOM_IN_MS,
  VIEWPORT_FOCUS_ZOOM_OUT_MS,
  zoomViewportAroundCenter,
  type FlowViewport,
  type ViewportAnimationHandle,
} from '../../utils/familyTreeFlowViewport';
import { FamilyTreeFlowNode } from './FamilyTreeFlowNode';
import { Gen5ExpandIcon } from './Gen5ExpandIcon';
import { Gen5MemberNode } from './Gen5MemberNode';
import treeBackground from '../../assets/family-tree/reference/tree-background.svg';
import './FamilyTreeFlow.css';

const nodeTypes = {
  familyMember: FamilyTreeFlowNode,
  gen5Icon: Gen5ExpandIcon,
  gen5Member: Gen5MemberNode,
};

const GEN5_CLOSE_ANIMATION_MS = 280;
const GEN5_OPEN_ANIMATION_MS = 500;
const INITIAL_FIT_PADDING = 0.12;
const INITIAL_FIT_DURATION_MS = VIEWPORT_FOCUS_ZOOM_OUT_MS;
const MIN_ZOOM = FULL_TREE_FIT_MIN_ZOOM;
const MAX_ZOOM = 1.8;
const TOOLBAR_VIEWPORT_DURATION_MS = 0;

type FlowCanvasNode = Node<FlowNodeData>;

function flowNodesSignature(nodes: FlowCanvasNode[]): string {
  return nodes.map((node) => {
    const width = node.width ?? 0;
    const height = node.height ?? 0;
    return `${node.id}:${node.position.x.toFixed(1)},${node.position.y.toFixed(1)},${width.toFixed(1)},${height.toFixed(1)}`;
  }).join('|');
}

function readViewportDimensions(
  membersRef: RefObject<HTMLDivElement | null> | undefined,
  cached: { width: number; height: number },
): { width: number; height: number } {
  const element = membersRef?.current;
  if (element) {
    const rect = element.getBoundingClientRect();
    const parentRect = element.parentElement?.getBoundingClientRect();
    const width = Math.max(rect.width, parentRect?.width ?? 0);
    const height = Math.max(rect.height, parentRect?.height ?? 0);
    if (width > 0 && height > 0) {
      return { width, height };
    }
  }

  return cached;
}

export interface FamilyTreeFlowHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fitView: (animated?: boolean) => void;
  focusMember: (id: number) => boolean;
}

export type FamilyTreeFlowControls = FamilyTreeFlowHandle;

interface FamilyTreeFlowProps {
  members: FamilyMemberInput[];
  selectedId: number | null;
  highlightIds: number[];
  justAddedMemberId?: number | null;
  layoutOptions?: FamilyTreeLayoutOptions;
  membersRef?: React.RefObject<HTMLDivElement | null>;
  onBeginMemberFocus: (id: number) => boolean;
  onCompleteMemberFocus: (id: number) => void;
  onHover?: (id: number | null) => void;
  onViewportChange?: () => void;
  onDefaultViewportChange?: (isAtDefault: boolean) => void;
  onPaneClick?: () => void;
  onViewportPanStart?: () => void;
  onResetViewport?: () => void;
  onFlowControlsReady?: (controls: FamilyTreeFlowControls) => void;
  expandedGen5ParentIds?: ReadonlySet<number>;
  onToggleGen5?: (parentId: number) => void;
  showTreeBackground?: boolean;
}

interface FlowViewportBridgeProps {
  flowInstanceRef: React.MutableRefObject<ReactFlowInstance | null>;
  viewportSize: { width: number; height: number };
  onViewportReady: () => void;
}

function FlowViewportBridge({
  flowInstanceRef,
  viewportSize,
  onViewportReady,
}: FlowViewportBridgeProps) {
  const instance = useReactFlow();

  useEffect(() => {
    flowInstanceRef.current = instance;
  }, [flowInstanceRef, instance]);

  useEffect(() => {
    if (viewportSize.width <= 0 || viewportSize.height <= 0) return;
    onViewportReady();
  }, [instance, onViewportReady, viewportSize.height, viewportSize.width]);

  return null;
}

class FamilyTreeFlowErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): { hasError: boolean; message: string } {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[FamilyTreeFlow] render error', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="family-tree-flow-empty">
          تعذّر عرض الشجرة. حدّث الصفحة أو أعد تشغيل السيرفر.
          {import.meta.env.DEV && this.state.message ? (
            <p style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>{this.state.message}</p>
          ) : null}
        </div>
      );
    }

    return this.props.children;
  }
}

const FamilyTreeFlowInner = forwardRef<FamilyTreeFlowHandle, FamilyTreeFlowProps>(
  function FamilyTreeFlowInner(
    {
      members,
      selectedId,
      highlightIds,
      justAddedMemberId = null,
      layoutOptions,
      membersRef,
      onBeginMemberFocus,
      onCompleteMemberFocus,
      onHover,
      onViewportChange,
      onDefaultViewportChange,
      onPaneClick,
      onViewportPanStart,
      onResetViewport,
      onFlowControlsReady,
      expandedGen5ParentIds = new Set<number>(),
      onToggleGen5,
      showTreeBackground = true,
    },
    ref,
  ) {
    const flowInstanceRef = useRef<ReactFlowInstance | null>(null);
    const focusCompleteTimerRef = useRef<number | null>(null);
    const viewportAnimationRef = useRef<ViewportAnimationHandle | null>(null);
    const isPanningRef = useRef(false);
    const suppressPaneClickUntilRef = useRef(0);
    const isViewportAnimatingRef = useRef(false);
    const lastNodesSignatureRef = useRef('');
    const viewportNotifyRafRef = useRef<number | null>(null);
    const baselineViewportRef = useRef<FlowViewport | null>(null);
    const initialViewportRef = useRef<FlowViewport | null>(null);
    const memberNodesRef = useRef<ReturnType<typeof buildFamilyTreeFlowLayout>['nodes']>([]);
    const viewportSizeRef = useRef({ width: 0, height: 0 });
    const [viewportReady, setViewportReady] = useState(false);
    const [isAtDefaultViewport, setIsAtDefaultViewport] = useState(true);
    const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
    const layoutFitSignatureRef = useRef('');
    const baselineMinZoomRef = useRef(MIN_ZOOM);
    const [effectiveMinZoom, setEffectiveMinZoom] = useState(MIN_ZOOM);
    const initialFitDoneRef = useRef(false);
    const [currentZoom, setCurrentZoom] = useState(1);
    const [gen5AnimatingParentIds, setGen5AnimatingParentIds] = useState<Set<number>>(() => new Set());
    const [gen5ClosingParentIds, setGen5ClosingParentIds] = useState<Set<number>>(() => new Set());
    const prevZoomRef = useRef(1);
    const gen5CloseTimerRef = useRef<number | null>(null);
    const gen5OpenTimerRef = useRef<number | null>(null);
    const gen5ZoomRevealTimerRef = useRef<number | null>(null);

    const allMembersForLayout = layoutOptions?.allMembers ?? members;
    const gen4ParentsWithGen5 = useMemo(
      () => getGen4ParentsWithGen5Children(allMembersForLayout),
      [allMembersForLayout],
    );

    const mergedLayoutOptions = useMemo<FamilyTreeLayoutOptions>(() => ({
      ...layoutOptions,
      expandedGen5ParentIds,
      currentZoom,
      gen5AnimatingParentIds,
      gen5ClosingParentIds,
    }), [currentZoom, expandedGen5ParentIds, gen5AnimatingParentIds, gen5ClosingParentIds, layoutOptions]);

    const layout = useMemo(
      () => buildFamilyTreeFlowLayout(members, selectedId, highlightIds, mergedLayoutOptions),
      [highlightIds, members, mergedLayoutOptions, selectedId],
    );
    const memberNodes = useMemo(
      () => layout.nodes,
      [layout.nodes],
    );
    memberNodesRef.current = memberNodes;

    const selectedPathIds = useMemo(
      () => (selectedId != null ? getAncestorPathIds(selectedId, members) : []),
      [members, selectedId],
    );
    const highlightedEdgeIds = useMemo(
      () => getHighlightedEdgeIds(selectedPathIds),
      [selectedPathIds],
    );
    const styledMemberNodes = useMemo(() => {
      const familyNodes = memberNodes.filter(
        (node): node is Node<FamilyTreeNodeData> => node.type === 'familyMember',
      );
      const highlighted = applyPathHighlightToMemberNodes(familyNodes, selectedId, selectedPathIds);
      const highlightedById = new Map(highlighted.map((node) => [node.id, node]));
      return memberNodes.map((node) => {
        if (node.type !== 'familyMember') return node;
        const highlightedNode = highlightedById.get(node.id) ?? node;
        const memberId = (highlightedNode.data as FamilyTreeNodeData).memberId;
        return {
          ...highlightedNode,
          data: {
            ...highlightedNode.data,
            isJustAdded: justAddedMemberId != null && memberId === justAddedMemberId,
          },
        };
      });
    }, [justAddedMemberId, memberNodes, selectedId, selectedPathIds]);
    const styledEdges = useMemo(
      () => applyPathHighlightToEdges(layout.edges, highlightedEdgeIds),
      [highlightedEdgeIds, layout.edges],
    );

    const [nodes, setNodes, onNodesChange] = useNodesState<FlowCanvasNode>([]);

    const syncBackgroundNodes = useCallback(() => {
      const memberOnly = styledMemberNodes.filter(
        (node) => node.id !== TREE_SVG_NODE_ID && node.type !== 'treeSvg',
      );

      const { width, height } = readViewportDimensions(membersRef, viewportSizeRef.current);
      if (width <= 0 || height <= 0 || memberOnly.length === 0) {
        setNodes(memberOnly);
        return;
      }

      viewportSizeRef.current = { width, height };

      const signature = flowNodesSignature(memberOnly);
      if (signature === lastNodesSignatureRef.current) return;
      lastNodesSignatureRef.current = signature;
      setNodes(memberOnly);
    }, [membersRef, setNodes, styledMemberNodes]);

    const scheduleViewportNotify = useCallback(() => {
      if (viewportNotifyRafRef.current != null) return;
      viewportNotifyRafRef.current = requestAnimationFrame(() => {
        viewportNotifyRafRef.current = null;
        syncBackgroundNodes();
        onViewportChange?.();
      });
    }, [onViewportChange, syncBackgroundNodes]);

    const sizeObserverCleanupRef = useRef<(() => void) | null>(null);

    const assignFlowRootRef = useCallback((element: HTMLDivElement | null) => {
      if (membersRef) {
        membersRef.current = element;
      }

      sizeObserverCleanupRef.current?.();
      sizeObserverCleanupRef.current = null;

      if (!element) return;

      const updateSize = () => {
        const rect = element.getBoundingClientRect();
        const parentRect = element.parentElement?.getBoundingClientRect();
        const width = Math.max(rect.width, parentRect?.width ?? 0);
        const height = Math.max(rect.height, parentRect?.height ?? 0);
        if (width > 0 && height > 0) {
          const sizeChanged = (
            viewportSizeRef.current.width !== width
            || viewportSizeRef.current.height !== height
          );
          viewportSizeRef.current = { width, height };
          if (sizeChanged) {
            setViewportSize({ width, height });
          }
          syncBackgroundNodes();
        }
      };

      updateSize();
      const observer = new ResizeObserver(updateSize);
      observer.observe(element);
      window.addEventListener('resize', updateSize);

      sizeObserverCleanupRef.current = () => {
        observer.disconnect();
        window.removeEventListener('resize', updateSize);
      };
    }, [membersRef, syncBackgroundNodes]);

    useEffect(() => () => {
      sizeObserverCleanupRef.current?.();
      if (viewportNotifyRafRef.current != null) {
        cancelAnimationFrame(viewportNotifyRafRef.current);
      }
    }, []);

    useEffect(() => {
      lastNodesSignatureRef.current = '';
      syncBackgroundNodes();
    }, [syncBackgroundNodes]);

    const cancelViewportAnimation = useCallback(() => {
      viewportAnimationRef.current?.cancel();
      viewportAnimationRef.current = null;
      isViewportAnimatingRef.current = false;
    }, []);

    const runViewportAnimation = useCallback((
      instance: ReactFlowInstance,
      target: FlowViewport,
      duration: number,
      onComplete?: () => void,
    ) => {
      cancelViewportAnimation();
      isViewportAnimatingRef.current = true;

      const handle = animateFlowViewport(
        () => instance.getViewport(),
        (viewport) => {
          void instance.setViewport(viewport);
        },
        target,
        duration,
        {
          onFrame: () => onViewportChange?.(),
          onComplete: () => {
            viewportAnimationRef.current = null;
            isViewportAnimatingRef.current = false;
            onViewportChange?.();
            onComplete?.();
          },
        },
      );

      viewportAnimationRef.current = handle;
      return handle.finished;
    }, [cancelViewportAnimation, onViewportChange]);

    const captureViewportAsDefault = useCallback((
      instance: Pick<ReactFlowInstance, 'getViewport'>,
      replaceInitial = false,
    ) => {
      const viewport = instance.getViewport();
      const snapshot: FlowViewport = {
        x: viewport.x,
        y: viewport.y,
        zoom: viewport.zoom,
      };

      if (replaceInitial || initialViewportRef.current == null) {
        initialViewportRef.current = snapshot;
      }

      baselineViewportRef.current = initialViewportRef.current
        ? { ...initialViewportRef.current }
        : snapshot;

      const baselineZoom = Math.max(MIN_ZOOM, snapshot.zoom);
      baselineMinZoomRef.current = baselineZoom;
      setEffectiveMinZoom(baselineZoom);

      setIsAtDefaultViewport((current) => {
        if (current) return current;
        onDefaultViewportChange?.(true);
        return true;
      });
      return snapshot;
    }, [onDefaultViewportChange]);

    const updateDefaultViewportState = useCallback(() => {
      const instance = flowInstanceRef.current;
      const baseline = baselineViewportRef.current;
      if (!instance || !baseline) return;

      const isAtDefault = viewportsApproximatelyEqual(instance.getViewport(), baseline);
      setIsAtDefaultViewport((current) => {
        if (current === isAtDefault) return current;
        onDefaultViewportChange?.(isAtDefault);
        return isAtDefault;
      });
    }, [onDefaultViewportChange]);

    const runFitView = useCallback(async (
      instance: ReactFlowInstance,
      duration = INITIAL_FIT_DURATION_MS,
      padding = INITIAL_FIT_PADDING,
      fitMode: 'full-tree' | 'adaptive' = 'full-tree',
    ) => {
      if (memberNodesRef.current.length === 0) return;

      const fitNodes = memberNodesRef.current.filter(
        (node) => node.id !== TREE_SVG_NODE_ID && node.type !== 'treeSvg',
      );
      if (fitNodes.length === 0) return;

      const { width, height } = readViewportDimensions(membersRef, viewportSizeRef.current);
      if (width <= 0 || height <= 0) return;

      viewportSizeRef.current = { width, height };

      const viewport = computeFitViewport(fitNodes, width, height, {
        padding,
        maxZoom: ADAPTIVE_MAX_ZOOM,
        preferWidth: fitMode === 'full-tree',
      });

      if (fitMode === 'adaptive') {
        const visibleCount = countVisibleFlowNodes(
          members.length,
          gen4ParentsWithGen5,
          expandedGen5ParentIds,
          currentZoom,
        );
        const adaptiveZoom = computeAdaptiveZoom(visibleCount);
        viewport.zoom = Math.max(
          ADAPTIVE_MIN_ZOOM,
          Math.min(ADAPTIVE_MAX_ZOOM, Math.min(viewport.zoom, adaptiveZoom)),
        );
      } else {
        // Show the entire tree on open — zoom out as far as needed to avoid clipping.
        viewport.zoom = Math.min(
          ADAPTIVE_MAX_ZOOM,
          Math.max(FULL_TREE_FIT_MIN_ZOOM, viewport.zoom),
        );
      }

      cancelViewportAnimation();
      if (duration > 0) {
        isViewportAnimatingRef.current = true;
        await instance.setViewport(viewport, { duration });
        isViewportAnimatingRef.current = false;
      } else {
        await instance.setViewport(viewport);
      }

      setCurrentZoom(viewport.zoom);
      syncBackgroundNodes();
      captureViewportAsDefault(instance, true);
      onViewportChange?.();
    }, [
      cancelViewportAnimation,
      captureViewportAsDefault,
      currentZoom,
      expandedGen5ParentIds,
      gen4ParentsWithGen5,
      members.length,
      membersRef,
      onViewportChange,
      syncBackgroundNodes,
    ]);

    const runSoftAdaptiveZoom = useCallback(async () => {
      const instance = flowInstanceRef.current;
      if (!instance || memberNodesRef.current.length === 0) return;

      const visibleCount = countVisibleFlowNodes(
        members.length,
        gen4ParentsWithGen5,
        expandedGen5ParentIds,
        currentZoom,
      );
      const adaptiveZoom = computeAdaptiveZoom(visibleCount);
      const current = instance.getViewport();
      const targetZoom = Math.max(
        ADAPTIVE_MIN_ZOOM,
        Math.min(ADAPTIVE_MAX_ZOOM, Math.min(adaptiveZoom, current.zoom)),
      );

      if (Math.abs(current.zoom - targetZoom) < 0.02) return;

      isViewportAnimatingRef.current = true;
      await instance.setViewport({ ...current, zoom: targetZoom }, { duration: GEN5_FIT_DURATION_MS });
      isViewportAnimatingRef.current = false;
      setCurrentZoom(targetZoom);
      syncBackgroundNodes();
      onViewportChange?.();
    }, [
      currentZoom,
      expandedGen5ParentIds,
      gen4ParentsWithGen5,
      members.length,
      onViewportChange,
      syncBackgroundNodes,
    ]);

    const resetToDefaultViewport = useCallback(async (
      instance: ReactFlowInstance,
      duration: number = INITIAL_FIT_DURATION_MS,
    ) => {
      if (memberNodesRef.current.length === 0) return;

      cancelViewportAnimation();

      if (focusCompleteTimerRef.current != null) {
        window.clearTimeout(focusCompleteTimerRef.current);
        focusCompleteTimerRef.current = null;
      }

      onResetViewport?.();
      await runFitView(instance, duration, INITIAL_FIT_PADDING, 'full-tree');
    }, [cancelViewportAnimation, onResetViewport, runFitView]);

    const handleInitialFit = useCallback((instance: ReactFlowInstance) => {
      void runFitView(instance, INITIAL_FIT_DURATION_MS, INITIAL_FIT_PADDING, 'full-tree');
    }, [runFitView]);

    useEffect(() => {
      if (!viewportReady || members.length === 0) return;
      if (memberNodesRef.current.length === 0) return;
      if (initialFitDoneRef.current) return;

      const instance = flowInstanceRef.current;
      if (!instance) return;

      initialFitDoneRef.current = true;
      const timer = window.setTimeout(() => {
        handleInitialFit(instance);
      }, 120);

      return () => window.clearTimeout(timer);
    }, [handleInitialFit, members.length, viewportReady, layout.nodes.length]);

    useEffect(() => {
      if (!viewportReady || members.length === 0) return;
      if (!isAtDefaultViewport) return;

      const memberOnly = memberNodes.filter(
        (node) => node.id !== TREE_SVG_NODE_ID && node.type !== 'treeSvg',
      );
      if (memberOnly.length === 0) return;

      const signature = flowNodesSignature(memberOnly);
      if (signature === layoutFitSignatureRef.current) return;
      layoutFitSignatureRef.current = signature;

      const instance = flowInstanceRef.current;
      if (!instance) return;

      const timer = window.setTimeout(() => {
        void runFitView(instance, 0, INITIAL_FIT_PADDING, 'full-tree');
      }, 60);

      return () => window.clearTimeout(timer);
    }, [isAtDefaultViewport, memberNodes, members.length, runFitView, viewportReady]);

    useEffect(() => {
      if (members.length === 0) {
        initialFitDoneRef.current = false;
      }
    }, [members.length]);

    useEffect(() => () => {
      if (focusCompleteTimerRef.current != null) {
        window.clearTimeout(focusCompleteTimerRef.current);
      }
      if (gen5CloseTimerRef.current != null) {
        window.clearTimeout(gen5CloseTimerRef.current);
      }
      if (gen5OpenTimerRef.current != null) {
        window.clearTimeout(gen5OpenTimerRef.current);
      }
      if (gen5ZoomRevealTimerRef.current != null) {
        window.clearTimeout(gen5ZoomRevealTimerRef.current);
      }
      cancelViewportAnimation();
    }, [cancelViewportAnimation]);

    useEffect(() => {
      const wasBelow = prevZoomRef.current < GEN5_ZOOM_THRESHOLD;
      const isAbove = currentZoom >= GEN5_ZOOM_THRESHOLD;
      prevZoomRef.current = currentZoom;

      if (!wasBelow || !isAbove || expandedGen5ParentIds.size === 0) return;

      setGen5AnimatingParentIds(new Set(expandedGen5ParentIds));
      if (gen5ZoomRevealTimerRef.current != null) {
        window.clearTimeout(gen5ZoomRevealTimerRef.current);
      }
      gen5ZoomRevealTimerRef.current = window.setTimeout(() => {
        setGen5AnimatingParentIds(new Set());
        gen5ZoomRevealTimerRef.current = null;
      }, GEN5_OPEN_ANIMATION_MS);
    }, [currentZoom, expandedGen5ParentIds]);

    const handleGen5Toggle = useCallback((parentId: number) => {
      if (!onToggleGen5) return;

      if (expandedGen5ParentIds.has(parentId)) {
        setGen5ClosingParentIds((current) => new Set(current).add(parentId));
        if (gen5CloseTimerRef.current != null) {
          window.clearTimeout(gen5CloseTimerRef.current);
        }
        gen5CloseTimerRef.current = window.setTimeout(() => {
          onToggleGen5(parentId);
          setGen5ClosingParentIds((current) => {
            const next = new Set(current);
            next.delete(parentId);
            return next;
          });
          gen5CloseTimerRef.current = null;
        }, GEN5_CLOSE_ANIMATION_MS);
        return;
      }

      onToggleGen5(parentId);
      setGen5AnimatingParentIds((current) => new Set(current).add(parentId));
      if (gen5OpenTimerRef.current != null) {
        window.clearTimeout(gen5OpenTimerRef.current);
      }
      gen5OpenTimerRef.current = window.setTimeout(() => {
        setGen5AnimatingParentIds((current) => {
          const next = new Set(current);
          next.delete(parentId);
          return next;
        });
        gen5OpenTimerRef.current = null;
      }, GEN5_OPEN_ANIMATION_MS);
    }, [expandedGen5ParentIds, onToggleGen5]);

    const focusMemberById = useCallback((memberId: number): boolean => {
      const node = memberNodesRef.current.find((entry) => entry.id === String(memberId));
      const instance = flowInstanceRef.current;
      const { width, height } = readViewportDimensions(membersRef, viewportSizeRef.current);
      if (!node || !instance || width <= 0 || height <= 0) return false;

      if (!onBeginMemberFocus(memberId)) return false;

      if (focusCompleteTimerRef.current != null) {
        window.clearTimeout(focusCompleteTimerRef.current);
        focusCompleteTimerRef.current = null;
      }

      const nodeWidth = node.width ?? 152;
      const nodeHeight = node.height ?? 108;
      const centerX = node.position.x + nodeWidth / 2;
      const centerY = node.position.y + nodeHeight / 2;
      const targetViewport = computeCenteredViewport(
        centerX,
        centerY,
        Math.min(ADAPTIVE_MAX_ZOOM, Math.max(ADAPTIVE_MIN_ZOOM, instance.getViewport().zoom * 1.15)),
        width,
        height,
      );

      setIsAtDefaultViewport((current) => {
        if (!current) return current;
        onDefaultViewportChange?.(false);
        return false;
      });

      void runViewportAnimation(
        instance,
        targetViewport,
        VIEWPORT_FOCUS_ZOOM_IN_MS,
        () => onCompleteMemberFocus(memberId),
      );

      return true;
    }, [
      membersRef,
      onBeginMemberFocus,
      onCompleteMemberFocus,
      onDefaultViewportChange,
      runViewportAnimation,
    ]);

    const zoomByStep = useCallback(async (
      instance: ReactFlowInstance,
      direction: 'in' | 'out',
    ) => {
      cancelViewportAnimation();

      const baseline = baselineViewportRef.current;
      if (direction === 'out' && baseline && viewportsApproximatelyEqual(instance.getViewport(), baseline)) {
        updateDefaultViewportState();
        return;
      }

      const { width, height } = readViewportDimensions(membersRef, viewportSizeRef.current);
      if (width <= 0 || height <= 0) return;

      viewportSizeRef.current = { width, height };

      const target = zoomViewportAroundCenter(
        instance.getViewport(),
        width,
        height,
        direction,
        baselineMinZoomRef.current,
        MAX_ZOOM,
      );

      if (!target) {
        updateDefaultViewportState();
        return;
      }

      await instance.setViewport(target);
      syncBackgroundNodes();

      if (direction === 'in') {
        setIsAtDefaultViewport((current) => {
          if (!current) return current;
          onDefaultViewportChange?.(false);
          return false;
        });
      } else {
        updateDefaultViewportState();
      }
      onViewportChange?.();
    }, [
      cancelViewportAnimation,
      membersRef,
      onDefaultViewportChange,
      onViewportChange,
      syncBackgroundNodes,
      updateDefaultViewportState,
    ]);

    const buildControls = useCallback((): FamilyTreeFlowControls => ({
      zoomIn: () => {
        const instance = flowInstanceRef.current;
        if (instance) void zoomByStep(instance, 'in');
      },
      zoomOut: () => {
        const instance = flowInstanceRef.current;
        if (instance) void zoomByStep(instance, 'out');
      },
      fitView: (animated = false) => {
        const instance = flowInstanceRef.current;
        if (!instance) return;
        void resetToDefaultViewport(
          instance,
          animated ? VIEWPORT_FOCUS_ZOOM_OUT_MS : TOOLBAR_VIEWPORT_DURATION_MS,
        );
      },
      focusMember: focusMemberById,
    }), [focusMemberById, resetToDefaultViewport, zoomByStep]);

    const prevExpandedGen5Ref = useRef('');
    useEffect(() => {
      const signature = [...expandedGen5ParentIds].sort((a, b) => a - b).join(',');
      if (signature === prevExpandedGen5Ref.current) return;
      prevExpandedGen5Ref.current = signature;

      const instance = flowInstanceRef.current;
      if (!instance || !viewportReady) return;

      const timer = window.setTimeout(() => {
        void runSoftAdaptiveZoom();
      }, 48);

      return () => window.clearTimeout(timer);
    }, [expandedGen5ParentIds, runSoftAdaptiveZoom, viewportReady]);

    useEffect(() => {
      if (!viewportReady) return;
      onFlowControlsReady?.(buildControls());
    }, [buildControls, onFlowControlsReady, viewportReady]);

    useImperativeHandle(ref, () => buildControls(), [buildControls]);

    const handleDoubleClickReset = useCallback((event: MouseEvent) => {
      event.preventDefault();

      const instance = flowInstanceRef.current;
      if (!instance) return;

      void resetToDefaultViewport(instance, VIEWPORT_FOCUS_ZOOM_OUT_MS);
    }, [resetToDefaultViewport]);

    const shouldIgnoreClickAfterPan = useCallback(() => (
      isPanningRef.current || performance.now() < suppressPaneClickUntilRef.current
    ), []);

    const handleNodeClick: NodeMouseHandler = useCallback((_event, node) => {
      if (shouldIgnoreClickAfterPan()) return;
      if (node.id === TREE_SVG_NODE_ID || node.type === 'treeSvg') return;

      if (node.type === 'gen5Icon') {
        const parentId = Number((node.data as Gen5IconNodeData).parentMemberId);
        if (Number.isFinite(parentId)) {
          handleGen5Toggle(parentId);
        }
        return;
      }

      if (node.type === 'gen5Member') {
        focusMemberById(Number((node.data as Gen5MemberNodeData).memberId));
        return;
      }

      if (node.type !== 'familyMember') return;
      focusMemberById(Number(node.id));
    }, [focusMemberById, handleGen5Toggle, shouldIgnoreClickAfterPan]);

    const handleNodeMouseEnter: NodeMouseHandler = useCallback((_event, node) => {
      if (node.type !== 'familyMember') return;
      onHover?.(Number(node.id));
    }, [onHover]);

    const handleNodeMouseLeave: NodeMouseHandler = useCallback(() => {
      onHover?.(null);
    }, [onHover]);

    const handlePaneClick = useCallback(() => {
      if (shouldIgnoreClickAfterPan()) return;
      if (focusCompleteTimerRef.current != null) {
        window.clearTimeout(focusCompleteTimerRef.current);
        focusCompleteTimerRef.current = null;
      }
      onPaneClick?.();
    }, [onPaneClick, shouldIgnoreClickAfterPan]);

    if (members.length === 0) {
      return <div className="family-tree-flow-empty">لا يوجد أفراد في الشجرة بعد</div>;
    }

    return (
      <div
        ref={assignFlowRootRef}
        className={`family-tree-flow-root${viewportReady ? ' is-viewport-ready' : ''}`}
        onDoubleClick={handleDoubleClickReset}
      >
        {showTreeBackground ? (
          <div className="family-tree-flow-viewport-bg" aria-hidden>
            <img
              src={treeBackground}
              alt=""
              className="family-tree-flow-svg-bg"
              draggable={false}
              decoding="async"
              loading="eager"
            />
          </div>
        ) : null}
        <ReactFlow
          className={`family-tree-flow${selectedId != null ? ' has-node-focus' : ''}${!isAtDefaultViewport ? ' is-map-pannable' : ''}`}
          nodes={nodes}
          edges={styledEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeClick={handleNodeClick}
          onNodeMouseEnter={handleNodeMouseEnter}
          onNodeMouseLeave={handleNodeMouseLeave}
          onPaneClick={handlePaneClick}
          onMoveStart={(event) => {
            isPanningRef.current = true;
            if (event && !isViewportAnimatingRef.current) {
              onViewportPanStart?.();
            }
          }}
          onMove={() => {
            const instance = flowInstanceRef.current;
            if (instance) {
              const zoom = instance.getViewport().zoom;
              setCurrentZoom((current) => (Math.abs(current - zoom) < 0.001 ? current : zoom));
            }
            scheduleViewportNotify();
          }}
          onMoveEnd={() => {
            isPanningRef.current = false;
            suppressPaneClickUntilRef.current = performance.now() + 220;
            const instance = flowInstanceRef.current;
            if (instance) {
              const zoom = instance.getViewport().zoom;
              setCurrentZoom((current) => (Math.abs(current - zoom) < 0.001 ? current : zoom));
            }
            if (viewportNotifyRafRef.current != null) {
              cancelAnimationFrame(viewportNotifyRafRef.current);
              viewportNotifyRafRef.current = null;
            }
            syncBackgroundNodes();
            onViewportChange?.();
            updateDefaultViewportState();
          }}
          nodeClickDistance={10}
          fitView={false}
          minZoom={effectiveMinZoom}
          maxZoom={MAX_ZOOM}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnScroll={false}
          zoomOnScroll
          panOnDrag={!isAtDefaultViewport}
          zoomOnPinch
          zoomOnDoubleClick={false}
          selectNodesOnDrag={false}
          preventScrolling
          proOptions={{ hideAttribution: true }}
        >
          <FlowViewportBridge
            flowInstanceRef={flowInstanceRef}
            viewportSize={viewportSize}
            onViewportReady={() => setViewportReady(true)}
          />
        </ReactFlow>
      </div>
    );
  },
);

export const FamilyTreeFlow = forwardRef<FamilyTreeFlowHandle, FamilyTreeFlowProps>(
  function FamilyTreeFlow(props, ref) {
    return (
      <FamilyTreeFlowErrorBoundary>
        <ReactFlowProvider>
          <FamilyTreeFlowInner {...props} ref={ref} />
        </ReactFlowProvider>
      </FamilyTreeFlowErrorBoundary>
    );
  },
);

export default FamilyTreeFlow;

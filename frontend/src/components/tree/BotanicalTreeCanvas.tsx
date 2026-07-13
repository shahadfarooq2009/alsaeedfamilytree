import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { select, zoom, zoomIdentity, type ZoomTransform } from 'd3';
import type { TreePersonNode as TreePersonData } from '../../types/tree';
import { useTreeStore } from '../../store/treeStore';
import {
  buildPositionsById,
  computeTreeLayout,
  getFitTransform,
  getNodeFocusTransform,
} from '../../utils/treeLayout';
import { buildBranchInstances } from '../../utils/buildBranchInstances';
import { isFounderNode } from '../../utils/organicBranchPath';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../../utils/nodeMetrics';
import { TreeBackground } from './TreeBackground';
import { TreeTrunk } from './TreeTrunk';
import { ImageBranchLayer } from './ImageBranchLayer';
import { BranchFoliage } from './BranchFoliage';
import { BranchAttachmentDebug } from './BranchAttachmentDebug';
import { LeafPersonNode } from './LeafPersonNode';
import { TreeToolbar } from './TreeToolbar';
import { TreeMinimap } from './TreeMinimap';
import { TreeLayoutDebug } from './TreeLayoutDebug';

export interface BotanicalTreeCanvasHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
  reset: () => void;
  toggleFullscreen: () => void;
}

interface BotanicalTreeCanvasProps {
  roots: TreePersonData[];
  searchFocusPersonId: number | null;
  familyName?: string | null;
  searchSlot: ReactNode;
}

export const BotanicalTreeCanvas = forwardRef<
  BotanicalTreeCanvasHandle,
  BotanicalTreeCanvasProps
>(function BotanicalTreeCanvas(
  { roots, searchFocusPersonId, familyName, searchSlot },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomLayerRef = useRef<SVGGElement>(null);
  const zoomBehaviorRef = useRef<ReturnType<typeof zoom<SVGSVGElement, unknown>> | null>(null);
  const knownNodeIdsRef = useRef<Set<number>>(new Set());
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [growingChildId, setGrowingChildId] = useState<number | null>(null);

  const selectedPersonId = useTreeStore((state) => state.selectedPersonId);
  const highlightedPersonId = useTreeStore((state) => state.highlightedPersonId);
  const setSelectedPersonId = useTreeStore((state) => state.setSelectedPersonId);

  const layout = useMemo(() => computeTreeLayout(roots), [roots]);
  const branchComposition = useMemo(
    () => buildBranchInstances(layout),
    [layout],
  );
  const positionsById = useMemo(
    () => buildPositionsById(layout.nodes),
    [layout.nodes],
  );

  const descendantNodes = useMemo(
    () => layout.nodes.filter((node) => !isFounderNode(node)),
    [layout.nodes],
  );
  const founderNode = useMemo(
    () => layout.nodes.find((node) => isFounderNode(node)) ?? null,
    [layout.nodes],
  );

  useEffect(() => {
    const currentIds = new Set(layout.nodes.map((node) => node.id));
    const previous = knownNodeIdsRef.current;

    if (previous.size > 0) {
      for (const id of currentIds) {
        if (!previous.has(id)) {
          setGrowingChildId(id);
          window.setTimeout(() => setGrowingChildId(null), 2200);
          break;
        }
      }
    }

    knownNodeIdsRef.current = currentIds;
  }, [layout.nodes]);

  useEffect(() => {
    if (!growingChildId || viewport.width === 0 || viewport.height === 0) {
      return;
    }

    const node = positionsById.get(growingChildId);
    const anchor = branchComposition.leafAnchors.get(growingChildId);
    if (!node || !anchor) {
      return;
    }

    const focusNode = { ...node, worldX: anchor.worldX, worldY: anchor.worldY };
    const focus = getNodeFocusTransform(focusNode, viewport.width, viewport.height, 1.12);
    const svg = svgRef.current;
    const behavior = zoomBehaviorRef.current;

    if (svg && behavior) {
      select(svg)
        .transition()
        .duration(700)
        .ease((t) => 1 - Math.pow(1 - t, 3))
        .call(behavior.transform, focus);
    }
  }, [growingChildId, branchComposition.leafAnchors, positionsById, viewport.width, viewport.height]);

  const applyTransform = useCallback((nextTransform: ZoomTransform) => {
    if (!zoomLayerRef.current) {
      return;
    }

    select(zoomLayerRef.current).attr('transform', nextTransform.toString());
    setTransform(nextTransform);
  }, []);

  const handleZoomBy = useCallback((factor: number) => {
    const svg = svgRef.current;
    const behavior = zoomBehaviorRef.current;
    if (!svg || !behavior) return;
    select(svg).transition().duration(200).call(behavior.scaleBy, factor);
  }, []);

  const handleFit = useCallback(() => {
    const fit = getFitTransform(layout, viewport.width, viewport.height);
    const svg = svgRef.current;
    const behavior = zoomBehaviorRef.current;
    if (svg && behavior) {
      select(svg).transition().duration(300).call(behavior.transform, fit);
    } else {
      applyTransform(fit);
    }
  }, [layout, viewport.width, viewport.height, applyTransform]);

  const handleReset = useCallback(() => {
    const svg = svgRef.current;
    const behavior = zoomBehaviorRef.current;
    if (svg && behavior) {
      select(svg).transition().duration(300).call(behavior.transform, zoomIdentity);
    } else {
      applyTransform(zoomIdentity);
    }
  }, [applyTransform]);

  const toggleFullscreen = useCallback(async () => {
    const element = containerRef.current;
    if (!element) return;

    if (!document.fullscreenElement) {
      await element.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, []);

  useImperativeHandle(ref, () => ({
    zoomIn: () => handleZoomBy(1.2),
    zoomOut: () => handleZoomBy(1 / 1.2),
    fit: handleFit,
    reset: handleReset,
    toggleFullscreen,
  }));

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      setViewport({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.08, 2.8])
      .on('zoom', (event) => {
        if (zoomLayerRef.current) {
          select(zoomLayerRef.current).attr('transform', event.transform.toString());
        }
        setTransform(event.transform);
      });

    const selection = select(svg);
    selection.call(behavior);
    zoomBehaviorRef.current = behavior;

    return () => {
      selection.on('.zoom', null);
    };
  }, []);

  useEffect(() => {
    if (layout.nodes.length === 0 || viewport.width === 0 || viewport.height === 0) return;

    const fit = getFitTransform(layout, viewport.width, viewport.height);
    const svg = svgRef.current;
    const behavior = zoomBehaviorRef.current;

    if (svg && behavior) {
      select(svg).call(behavior.transform, fit);
    } else {
      applyTransform(fit);
    }
  }, [layout, viewport.width, viewport.height, applyTransform]);

  useEffect(() => {
    if (!searchFocusPersonId || viewport.width === 0 || viewport.height === 0) return;

    const node = positionsById.get(searchFocusPersonId);
    const anchor = branchComposition.leafAnchors.get(searchFocusPersonId);
    if (!node) return;

    const focusNode = anchor
      ? { ...node, worldX: anchor.worldX, worldY: anchor.worldY }
      : node;
    const focus = getNodeFocusTransform(focusNode, viewport.width, viewport.height, 1.15);
    const svg = svgRef.current;
    const behavior = zoomBehaviorRef.current;

    if (svg && behavior) {
      select(svg)
        .transition()
        .duration(500)
        .ease((t) => 1 - Math.pow(1 - t, 3))
        .call(behavior.transform, focus);
    } else {
      applyTransform(focus);
    }
  }, [searchFocusPersonId, positionsById, branchComposition.leafAnchors, viewport.width, viewport.height, applyTransform]);

  const focusActive = highlightedPersonId !== null;

  const renderNode = (node: (typeof layout.nodes)[number]) => {
    const isSelected = selectedPersonId === node.id;
    const isHighlighted = highlightedPersonId === node.id;
    const isDimmed = focusActive && !isSelected && !isHighlighted;
    const anchor = branchComposition.leafAnchors.get(node.id);

    return (
      <LeafPersonNode
        key={node.id}
        node={node}
        worldX={anchor?.worldX ?? node.worldX}
        worldY={anchor?.worldY ?? node.worldY}
        isSelected={isSelected}
        isHighlighted={isHighlighted}
        isDimmed={isDimmed}
        tiltDeg={anchor?.tiltDeg ?? 0}
        isGrowing={growingChildId === node.id}
        onSelect={setSelectedPersonId}
      />
    );
  };

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      <TreeBackground />

      <TreeToolbar
        familyName={familyName}
        searchSlot={searchSlot}
        onZoomIn={() => handleZoomBy(1.2)}
        onZoomOut={() => handleZoomBy(1 / 1.2)}
        onFit={handleFit}
        onReset={handleReset}
        onFullscreen={toggleFullscreen}
        isFullscreen={isFullscreen}
      />

      <svg
        ref={svgRef}
        className="relative z-10 h-full w-full touch-none"
        width={viewport.width || undefined}
        height={viewport.height || undefined}
      >
        <defs>
          <linearGradient id="ground-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d8d2c4" stopOpacity="0" />
            <stop offset="100%" stopColor="#c8c0b0" stopOpacity="0.35" />
          </linearGradient>
        </defs>

        <g ref={zoomLayerRef} className="viewport-transform" transform={transform.toString()}>
          <g className="world">
            <g className="scene-ground" pointerEvents="none" aria-hidden>
              <rect
                x={0}
                y={WORLD_HEIGHT - 28}
                width={WORLD_WIDTH}
                height={40}
                fill="url(#ground-fade)"
                opacity={0.5}
              />
            </g>

            <TreeTrunk />
            <ImageBranchLayer
              branches={branchComposition.branches}
              growingChildId={growingChildId}
            />
            <BranchFoliage branches={branchComposition.branches} />
            <BranchAttachmentDebug branches={branchComposition.branches} />

            <g className="person-nodes">
              {descendantNodes.map(renderNode)}
              {founderNode ? renderNode(founderNode) : null}
            </g>

            <TreeLayoutDebug layout={layout} transform={transform} />
          </g>
        </g>
      </svg>

      <TreeMinimap
        layout={layout}
        transform={transform}
        viewportWidth={viewport.width}
        viewportHeight={viewport.height}
      />

      <div
        className="pointer-events-none absolute bottom-5 left-1/2 z-20 hidden -translate-x-1/2 items-center gap-2 rounded-full border px-4 py-2 text-xs text-[#5c6652] backdrop-blur-md md:flex"
        style={{
          background: 'rgba(255, 255, 255, 0.72)',
          borderColor: 'rgba(201, 162, 39, 0.18)',
        }}
      >
        <span aria-hidden>✋</span>
        <span>اسحب للتحريك</span>
      </div>

      <div className="pointer-events-none absolute bottom-4 right-4 z-20 rounded-xl px-3 py-2 text-xs text-[#5c6652] backdrop-blur-md md:hidden">
        اسحب للتحريك • قرصة للتكبير
      </div>
    </div>
  );
});

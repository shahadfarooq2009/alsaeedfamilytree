import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { generateReference81People } from '../../utils/generateReference81People';
import './FamilyTreeMap.css';

const CARD_WIDTH = 96;
const CARD_HEIGHT = 66;
const FOUNDER_WIDTH = 118;
const FOUNDER_HEIGHT = 82;
const H_GAP = 14;
const V_GAP = 118;
const PADDING = 100;

export interface FamilyTreeMapPerson {
  id: number;
  name: string;
  parentId: number | null;
  childrenCount?: number;
}

interface TreeNode extends FamilyTreeMapPerson {
  children: TreeNode[];
  x: number;
  y: number;
  depth: number;
  isFounder?: boolean;
}

interface LayoutLink {
  from: TreeNode;
  to: TreeNode;
}

interface LayoutResult {
  nodes: TreeNode[];
  links: LayoutLink[];
  width: number;
  height: number;
}

interface Transform {
  x: number;
  y: number;
  scale: number;
}

interface DragState {
  startX: number;
  startY: number;
  baseX: number;
  baseY: number;
}

export interface FamilyTreeMapProps {
  people?: FamilyTreeMapPerson[];
  /** Show built-in demo tree when `people` is empty or omitted. */
  demoFallback?: boolean;
}

function buildTree(people: FamilyTreeMapPerson[] = []): TreeNode[] {
  const map = new Map<number, TreeNode>();

  people.forEach((person) => {
    map.set(person.id, { ...person, children: [], x: 0, y: 0, depth: 0 });
  });

  const roots: TreeNode[] = [];

  map.forEach((node) => {
    if (node.parentId != null && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

function cardSize(node: TreeNode): { width: number; height: number } {
  if (node.parentId === null) {
    return { width: FOUNDER_WIDTH, height: FOUNDER_HEIGHT };
  }
  return { width: CARD_WIDTH, height: CARD_HEIGHT };
}

function layoutTree(roots: TreeNode[]): LayoutResult {
  let cursorX = 0;
  const nodes: TreeNode[] = [];
  const links: LayoutLink[] = [];

  function walk(node: TreeNode, depth = 0, parent: TreeNode | null = null) {
    const children = node.children;
    const { width } = cardSize(node);

    if (children.length === 0) {
      node.x = cursorX;
      cursorX += width + H_GAP;
    } else {
      children.forEach((child) => walk(child, depth + 1, node));
      const first = children[0];
      const last = children[children.length - 1];
      const firstWidth = cardSize(first).width;
      const lastWidth = cardSize(last).width;
      node.x = (first.x + firstWidth / 2 + last.x + lastWidth / 2) / 2 - width / 2;
    }

    node.depth = depth;
    node.isFounder = node.parentId === null;

    if (parent) {
      links.push({ from: parent, to: node });
    }

    nodes.push(node);
  }

  roots.forEach((root) => walk(root));

  const maxDepth = Math.max(...nodes.map((node) => node.depth), 0);

  nodes.forEach((node) => {
    node.y = (maxDepth - node.depth) * (CARD_HEIGHT + V_GAP);
    node.x += PADDING;
    node.y += PADDING;
    if (node.isFounder) {
      node.y += 8;
    }
  });

  const width = Math.max(...nodes.map((node) => node.x + cardSize(node).width), 0) + PADDING;
  const height = Math.max(...nodes.map((node) => node.y + cardSize(node).height), 0) + PADDING;

  return { nodes, links, width, height };
}

function makeLinkPath(from: TreeNode, to: TreeNode): string {
  const fromSize = cardSize(from);
  const toSize = cardSize(to);
  const fromX = from.x + fromSize.width / 2;
  const fromY = from.y;
  const toX = to.x + toSize.width / 2;
  const toY = to.y + toSize.height;
  const midY = fromY - V_GAP / 2;

  return `M ${fromX} ${fromY} V ${midY} H ${toX} V ${toY}`;
}

function getInitial(name = '?'): string {
  return String(name).trim().charAt(0) || '؟';
}

const DEMO_PEOPLE = generateReference81People();

const ARROW_PAN_STEP = 28;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export { BotanicalTree } from './BotanicalTree';

export default function FamilyTreeMap({ people, demoFallback = false }: FamilyTreeMapProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const positionLockedRef = useRef(false);
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });
  const [drag, setDrag] = useState<DragState | null>(null);
  const [isMoveMode, setIsMoveMode] = useState(false);
  const [isPositionLocked, setIsPositionLocked] = useState(false);

  const sourcePeople = useMemo(() => {
    if (people && people.length > 0) return people;
    if (demoFallback) return DEMO_PEOPLE;
    return people ?? [];
  }, [demoFallback, people]);

  const layout = useMemo(() => {
    const roots = buildTree(sourcePeople);
    return layoutTree(roots);
  }, [sourcePeople]);

  const fitToScreen = useCallback((force = false) => {
    if (!force && positionLockedRef.current) return;

    const viewport = viewportRef.current;
    if (!viewport) return;

    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;

    const scaleX = vw / layout.width;
    const scaleY = vh / layout.height;
    const scale = Math.min(scaleX, scaleY, 1.15);

    const x = (vw - layout.width * scale) / 2;
    const y = (vh - layout.height * scale) / 2;

    setTransform({ x, y, scale });
  }, [layout.height, layout.width]);

  useEffect(() => {
    fitToScreen();
    const onResize = () => fitToScreen();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [fitToScreen]);

  useEffect(() => {
    if (!isMoveMode || isPositionLocked) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;

      let dx = 0;
      let dy = 0;

      switch (event.key) {
        case 'ArrowUp':
          dy = ARROW_PAN_STEP;
          break;
        case 'ArrowDown':
          dy = -ARROW_PAN_STEP;
          break;
        case 'ArrowLeft':
          dx = ARROW_PAN_STEP;
          break;
        case 'ArrowRight':
          dx = -ARROW_PAN_STEP;
          break;
        default:
          return;
      }

      event.preventDefault();
      setTransform((current) => ({
        ...current,
        x: current.x + dx,
        y: current.y + dy,
      }));
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMoveMode, isPositionLocked]);

  function zoom(delta: number) {
    setTransform((current) => {
      const nextScale = Math.min(Math.max(current.scale + delta, 0.15), 2.5);
      return { ...current, scale: nextScale };
    });
  }

  function onWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    zoom(event.deltaY > 0 ? -0.08 : 0.08);
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!isMoveMode || isPositionLocked || event.button !== 0) return;

    setDrag({
      startX: event.clientX,
      startY: event.clientY,
      baseX: transform.x,
      baseY: transform.y,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!isMoveMode || isPositionLocked || !drag) return;

    setTransform((current) => ({
      ...current,
      x: drag.baseX + event.clientX - drag.startX,
      y: drag.baseY + event.clientY - drag.startY,
    }));
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (drag && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDrag(null);
  }

  function toggleMoveMode() {
    if (isPositionLocked) return;
    setIsMoveMode((current) => !current);
  }

  function lockPosition() {
    positionLockedRef.current = true;
    setIsPositionLocked(true);
    setIsMoveMode(false);
    setDrag(null);
  }

  function recenter() {
    positionLockedRef.current = false;
    setIsPositionLocked(false);
    setIsMoveMode(false);
    setDrag(null);
    fitToScreen(true);
  }

  if (sourcePeople.length === 0) {
    return (
      <div className="family-map-root family-map-empty" dir="rtl">
        <p>لا يوجد أفراد في شجرة العائلة بعد.</p>
      </div>
    );
  }

  return (
    <div className="family-map-root" dir="rtl">
      <button
        type="button"
        className={`family-map-move-btn${isMoveMode ? ' is-active' : ''}`}
        aria-pressed={isMoveMode}
        disabled={isPositionLocked}
        title="اضغط ثم اسحب الشاشة أو استخدم أسهم الكيبورد"
        onClick={toggleMoveMode}
      >
        تحريك الشاشة
      </button>

      <div
        ref={viewportRef}
        className={`family-map-viewport${isMoveMode ? ' is-move-mode' : ''}${isPositionLocked ? ' is-position-locked' : ''}`}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        tabIndex={isMoveMode && !isPositionLocked ? 0 : -1}
        aria-label="خريطة العائلة"
      >
        <div
          className="family-map-canvas"
          style={{
            width: layout.width,
            height: layout.height,
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          }}
        >
          <svg className="family-map-lines" width={layout.width} height={layout.height}>
            {layout.links.map((link) => (
              <path
                key={`${link.from.id}-${link.to.id}`}
                d={makeLinkPath(link.from, link.to)}
                className="family-map-link"
              />
            ))}
          </svg>

          {layout.nodes.map((node) => {
            const size = cardSize(node);
            return (
              <div
                key={node.id}
                className={`family-card ${node.parentId === null ? 'family-card-root' : ''}`}
                style={{ left: node.x, top: node.y, width: size.width, height: size.height }}
              >
                <div className="family-initial">{getInitial(node.name)}</div>
                <div className="family-name">{node.name}</div>
                {node.parentId === null ? (
                  <div className="family-role">مؤسس العائلة</div>
                ) : null}
                <div className="family-count">
                  أبناء: {node.childrenCount ?? node.children.length ?? 0}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="family-map-toolbar">
        <button type="button" onClick={() => zoom(0.12)}>
          تكبير +
        </button>
        <button type="button" onClick={() => zoom(-0.12)}>
          تصغير −
        </button>
        <button type="button" onClick={recenter}>
          إعادة ضبط
        </button>
        <button
          type="button"
          className={isMoveMode ? 'is-active' : ''}
          aria-pressed={isMoveMode}
          disabled={isPositionLocked}
          title="اضغط ثم اسحب الشاشة أو استخدم أسهم الكيبورد"
          onClick={toggleMoveMode}
        >
          تحريك الشاشة
        </button>
        <button
          type="button"
          className={isPositionLocked ? 'is-active' : ''}
          aria-pressed={isPositionLocked}
          title="تثبيت موقع الخريطة"
          onClick={lockPosition}
        >
          {isPositionLocked ? 'مثبت' : 'تثبيت'}
        </button>
      </div>
    </div>
  );
}

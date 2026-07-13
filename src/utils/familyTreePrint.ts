import type { Node } from '@xyflow/react';
import html2canvas from 'html2canvas';

import { resolveMemberPhotoUrl } from '../assets/avatars/catalog';
import type { FamilyTreeNodeData } from './buildFamilyTreeFlowLayout';
import { buildFamilyTreeFlowLayout } from './buildFamilyTreeFlowLayout';
import { computeMemberBounds } from './familyTreeFlowViewport';
import type { FamilyMemberInput } from './treeLayout/types';

export type PrintPaperSize = 'A4' | 'A3' | 'A2' | 'A1' | 'A0';
export type PrintOrientation = 'landscape' | 'portrait';
export type PrintScaleMode = 'fit-page' | 'fit-width' | '100%' | 'custom';
export type PrintMarginSize = 'none' | 'small' | 'normal';
export type PrintColorMode = 'color' | 'grayscale';

export interface FamilyTreePrintSettings {
  paperSize: PrintPaperSize;
  orientation: PrintOrientation;
  scaleMode: PrintScaleMode;
  customZoom: number;
  margins: PrintMarginSize;
  colorMode: PrintColorMode;
  includeBackground: boolean;
}

export interface PrintPageTile {
  index: number;
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PrintLayoutPlan {
  pagesX: number;
  pagesY: number;
  totalPages: number;
  contentWidth: number;
  contentHeight: number;
  padding: number;
  pageWidthMm: number;
  pageHeightMm: number;
  printableWidthMm: number;
  printableHeightMm: number;
  tiles: PrintPageTile[];
  useVector: boolean;
}

export const DEFAULT_PRINT_SETTINGS: FamilyTreePrintSettings = {
  paperSize: 'A4',
  orientation: 'landscape',
  scaleMode: 'fit-page',
  customZoom: 100,
  margins: 'normal',
  colorMode: 'color',
  includeBackground: true,
};

const MM_TO_CSS_PX = 96 / 25.4;
const PRINT_PADDING = 48;
const HEADER_MM = 11;
const MAX_CANVAS_DIMENSION = 14000;
const TARGET_DPI = 300;

const PAPER_MM: Record<PrintPaperSize, [number, number]> = {
  A4: [210, 297],
  A3: [297, 420],
  A2: [420, 594],
  A1: [594, 841],
  A0: [841, 1189],
};

const MARGIN_MM: Record<PrintMarginSize, number> = {
  none: 0,
  small: 8,
  normal: 15,
};

const GENERATION_PRINT_THEME: Record<string, { bg: string; border: string; badge: string; accent: string }> = {
  g1: { bg: '#fbf3de', border: '#d8c397', badge: '#c9a86a', accent: '#8a6a24' },
  g2: { bg: '#e8f0de', border: '#a8b896', badge: '#56663f', accent: '#4a5836' },
  g3: { bg: '#eaf2e5', border: '#b5c7a8', badge: '#6f8161', accent: '#5f7558' },
  g4: { bg: '#f5ecd8', border: '#d4c4a0', badge: '#b8a882', accent: '#8a7340' },
  g5: { bg: '#f6e8da', border: '#d4b08a', badge: '#a87348', accent: '#84562e' },
  g6: { bg: '#e6edda', border: '#adb89a', badge: '#667657', accent: '#4f5a41' },
  g7: { bg: '#e3eee8', border: '#a8c4b6', badge: '#6a8a7a', accent: '#4f6b5d' },
  g8: { bg: '#ede7dd', border: '#c4b5a4', badge: '#8a7a68', accent: '#6e5f4f' },
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toAbsoluteUrl(url: string): string {
  try {
    return new URL(url, window.location.href).href;
  } catch {
    return url;
  }
}

function getPageSizeMm(settings: FamilyTreePrintSettings): { widthMm: number; heightMm: number } {
  const [shortEdge, longEdge] = PAPER_MM[settings.paperSize];
  if (settings.orientation === 'landscape') {
    return { widthMm: longEdge, heightMm: shortEdge };
  }
  return { widthMm: shortEdge, heightMm: longEdge };
}

function getPrintableAreaMm(settings: FamilyTreePrintSettings) {
  const page = getPageSizeMm(settings);
  const margin = MARGIN_MM[settings.margins];
  return {
    pageWidthMm: page.widthMm,
    pageHeightMm: page.heightMm,
    printableWidthMm: Math.max(20, page.widthMm - margin * 2),
    printableHeightMm: Math.max(20, page.heightMm - margin * 2 - HEADER_MM),
  };
}

function optimizeAxisBreaks(
  contentSize: number,
  tileSize: number,
  boxes: Array<{ start: number; end: number }>,
): number[] {
  if (contentSize <= tileSize || tileSize <= 0) return [];

  const breaks: number[] = [];
  let cursor = 0;

  while (cursor + tileSize < contentSize - 1) {
    let next = cursor + tileSize;
    const crossing = boxes.filter((box) => box.start < next && box.end > next);
    if (crossing.length > 0) {
      const before = Math.max(cursor + tileSize * 0.35, crossing[0].start - 18);
      const after = Math.min(contentSize, crossing[crossing.length - 1].end + 18);
      if (before > cursor + 40 && before < next) {
        next = before;
      } else if (after > next && after - cursor <= tileSize * 1.35) {
        next = after;
      }
    }
    if (next <= cursor) break;
    breaks.push(next);
    cursor = next;
  }

  return breaks;
}

function buildTiles(
  contentWidth: number,
  contentHeight: number,
  tileWidth: number,
  tileHeight: number,
  nodeBoxes: Array<{ x: number; y: number; width: number; height: number }>,
): PrintPageTile[] {
  const xBreaks = optimizeAxisBreaks(
    contentWidth,
    tileWidth,
    nodeBoxes.map((box) => ({ start: box.x, end: box.x + box.width })),
  );
  const yBreaks = optimizeAxisBreaks(
    contentHeight,
    tileHeight,
    nodeBoxes.map((box) => ({ start: box.y, end: box.y + box.height })),
  );

  const xStarts = [0, ...xBreaks.filter((value) => value < contentWidth)];
  const yStarts = [0, ...yBreaks.filter((value) => value < contentHeight)];

  const xEnds = [...xStarts.slice(1), contentWidth];
  const yEnds = [...yStarts.slice(1), contentHeight];

  const tiles: PrintPageTile[] = [];
  let index = 0;
  yStarts.forEach((y, row) => {
    xStarts.forEach((x, col) => {
      const width = xEnds[col] - x;
      const height = yEnds[row] - y;
      tiles.push({ index, row, col, x, y, width, height });
      index += 1;
    });
  });

  return tiles;
}

export function computePrintLayoutPlan(
  members: FamilyMemberInput[],
  settings: FamilyTreePrintSettings,
): PrintLayoutPlan | null {
  const layout = buildFamilyTreeFlowLayout(members, null, []);
  if (layout.nodes.length === 0) return null;

  const bounds = computeMemberBounds(layout.nodes);
  const contentWidth = bounds.width + PRINT_PADDING * 2;
  const contentHeight = bounds.height + PRINT_PADDING * 2;
  const printable = getPrintableAreaMm(settings);
  const printableWidthPx = printable.printableWidthMm * MM_TO_CSS_PX;
  const printableHeightPx = printable.printableHeightMm * MM_TO_CSS_PX;

  const nodeBoxes = layout.nodes.map((node) => ({
    x: (node.position.x - bounds.minX) + PRINT_PADDING,
    y: (node.position.y - bounds.minY) + PRINT_PADDING,
    width: node.width ?? 152,
    height: node.height ?? 108,
  }));

  let tileWidth = contentWidth;
  let tileHeight = contentHeight;

  if (settings.scaleMode === 'fit-page') {
    const scale = Math.min(printableWidthPx / contentWidth, printableHeightPx / contentHeight);
    tileWidth = contentWidth;
    tileHeight = contentHeight;
    if (scale < 1) {
      // Single page — viewBox covers full tree; browser scales down.
      return {
        pagesX: 1,
        pagesY: 1,
        totalPages: 1,
        contentWidth,
        contentHeight,
        padding: PRINT_PADDING,
        ...printable,
        tiles: [{
          index: 0,
          row: 0,
          col: 0,
          x: 0,
          y: 0,
          width: contentWidth,
          height: contentHeight,
        }],
        useVector: contentWidth <= 12000 && contentHeight <= 12000,
      };
    }
  } else if (settings.scaleMode === 'fit-width') {
    const scale = printableWidthPx / contentWidth;
    tileWidth = contentWidth;
    tileHeight = printableHeightPx / scale;
  } else {
    const zoom = settings.scaleMode === 'custom'
      ? Math.max(25, Math.min(300, settings.customZoom)) / 100
      : 1;
    tileWidth = printableWidthPx / zoom;
    tileHeight = printableHeightPx / zoom;
  }

  const tiles = buildTiles(contentWidth, contentHeight, tileWidth, tileHeight, nodeBoxes);
  const pagesX = Math.max(...tiles.map((tile) => tile.col)) + 1;
  const pagesY = Math.max(...tiles.map((tile) => tile.row)) + 1;

  return {
    pagesX,
    pagesY,
    totalPages: tiles.length,
    contentWidth,
    contentHeight,
    padding: PRINT_PADDING,
    ...printable,
    tiles,
    useVector: contentWidth <= 12000 && contentHeight <= 12000,
  };
}

function edgePath(
  parentX: number,
  parentY: number,
  childX: number,
  childY: number,
): string {
  const midY = (parentY + childY) / 2;
  return `M ${parentX.toFixed(1)} ${parentY.toFixed(1)} C ${parentX.toFixed(1)} ${midY.toFixed(1)} ${childX.toFixed(1)} ${midY.toFixed(1)} ${childX.toFixed(1)} ${childY.toFixed(1)}`;
}

function renderNodeSvg(
  node: Node<FamilyTreeNodeData>,
  offsetX: number,
  offsetY: number,
): string {
  const data = node.data;
  const width = node.width ?? 152;
  const height = node.height ?? 108;
  const x = node.position.x - offsetX;
  const y = node.position.y - offsetY;
  const theme = GENERATION_PRINT_THEME[data.generationClass] ?? GENERATION_PRINT_THEME.g1;
  const badgeY = y + 24;
  const nameY = y + 62;
  const childrenY = y + (data.isFounder ? 96 : 88);

  const photo = resolveMemberPhotoUrl(data.photoUrl ?? null);
  const photoMarkup = photo
    ? `<image href="${escapeXml(toAbsoluteUrl(photo))}" x="${x + width / 2 - 21}" y="${badgeY - 21}" width="42" height="42" clip-path="url(#clip-${data.memberId})" preserveAspectRatio="xMidYMid slice" />`
    : `<text x="${x + width / 2}" y="${badgeY + 6}" text-anchor="middle" font-size="18" font-weight="700" fill="#fff">${escapeXml(data.initial)}</text>`;

  return `
    <g class="print-node" data-member-id="${data.memberId}">
      ${photo ? `<clipPath id="clip-${data.memberId}"><circle cx="${x + width / 2}" cy="${badgeY}" r="21" /></clipPath>` : ''}
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${data.isFounder ? 16 : 14}" fill="${theme.bg}" stroke="${theme.border}" stroke-width="${data.isFounder ? 2 : 1.5}" />
      <circle cx="${x + width / 2}" cy="${badgeY}" r="21" fill="${theme.badge}" stroke="#fff" stroke-width="3" />
      ${photoMarkup}
      <text x="${x + width / 2}" y="${nameY}" text-anchor="middle" font-size="${data.isFounder ? 32 : 30}" font-weight="800" fill="#45503a" font-family="'Tajawal', 'Segoe UI', sans-serif">${escapeXml(data.displayName)}</text>
      <text x="${x + width / 2}" y="${childrenY}" text-anchor="middle" font-size="20" font-weight="600" fill="#9a9488" font-family="'Tajawal', 'Segoe UI', sans-serif">أبناء: ${data.childCount}</text>
      ${data.isFounder ? `<text x="${x + width / 2}" y="${y + height - 12}" text-anchor="middle" font-size="19" font-weight="700" fill="${theme.accent}" font-family="'Tajawal', 'Segoe UI', sans-serif">مؤسس العائلة</text>` : ''}
    </g>
  `;
}

export function buildFamilyTreePrintSvg(
  members: FamilyMemberInput[],
  settings: FamilyTreePrintSettings,
  backgroundUrl?: string | null,
): string | null {
  const layout = buildFamilyTreeFlowLayout(members, null, []);
  if (layout.nodes.length === 0) return null;

  const bounds = computeMemberBounds(layout.nodes);
  const width = bounds.width + PRINT_PADDING * 2;
  const height = bounds.height + PRINT_PADDING * 2;
  const offsetX = bounds.minX - PRINT_PADDING;
  const offsetY = bounds.minY - PRINT_PADDING;

  const nodeById = new Map(layout.nodes.map((node) => [node.id, node]));
  const edgePaths = layout.edges.map((edge) => {
    const parent = nodeById.get(edge.source);
    const child = nodeById.get(edge.target);
    if (!parent || !child) return '';
    const parentW = parent.width ?? 152;
    const childW = child.width ?? 152;
    const childH = child.height ?? 108;
    return `<path d="${edgePath(
      parent.position.x - offsetX + parentW / 2,
      parent.position.y - offsetY,
      child.position.x - offsetX + childW / 2,
      child.position.y - offsetY + childH,
    )}" fill="none" stroke="rgba(120, 96, 55, 0.5)" stroke-width="1.8" stroke-linecap="round" />`;
  }).join('');

  const nodesMarkup = layout.nodes
    .filter((node) => node.type === 'familyMember')
    .map((node) => renderNodeSvg(node as Node<FamilyTreeNodeData>, offsetX, offsetY))
    .join('');
  const backgroundMarkup = settings.includeBackground && backgroundUrl
    ? `<image href="${escapeXml(toAbsoluteUrl(backgroundUrl))}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet" opacity="0.34" />`
    : `<rect width="100%" height="100%" fill="#f3efe4" />`;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
      <defs>
        <style>
          text { paint-order: stroke fill; }
        </style>
      </defs>
      ${backgroundMarkup}
      <g class="print-edges">${edgePaths}</g>
      <g class="print-nodes">${nodesMarkup}</g>
    </svg>
  `;
}

async function captureTreeRaster(
  element: HTMLElement,
  plan: PrintLayoutPlan,
  settings: FamilyTreePrintSettings,
): Promise<string | null> {
  const panel = element.querySelector('.member-focus-panel');
  const previousPanelDisplay = panel instanceof HTMLElement ? panel.style.display : null;
  if (panel instanceof HTMLElement) panel.style.display = 'none';

  if (!settings.includeBackground) {
    element.querySelectorAll('.family-tree-flow-fixed-bg, .react-flow__node-treeSvg').forEach((node) => {
      (node as HTMLElement).style.display = 'none';
    });
  }

  const scale = Math.min(
    TARGET_DPI / 96,
    MAX_CANVAS_DIMENSION / Math.max(plan.contentWidth, 1),
    MAX_CANVAS_DIMENSION / Math.max(plan.contentHeight, 1),
  );

  try {
    const canvas = await html2canvas(element, {
      useCORS: true,
      allowTaint: true,
      backgroundColor: settings.includeBackground ? '#f3efe4' : '#ffffff',
      scale,
      logging: false,
      ignoreElements: (node) => (
        (node.classList?.contains('member-focus-panel') ?? false)
        || (node.classList?.contains('reference-toolbar') ?? false)
        || (node.classList?.contains('reference-view-toggle') ?? false)
      ),
    });
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  } finally {
    if (panel instanceof HTMLElement && previousPanelDisplay != null) {
      panel.style.display = previousPanelDisplay;
    }
    if (!settings.includeBackground) {
      element.querySelectorAll('.family-tree-flow-fixed-bg, .react-flow__node-treeSvg').forEach((node) => {
        (node as HTMLElement).style.display = '';
      });
    }
  }
}

function extractSvgInner(svgMarkup: string): string {
  return svgMarkup
    .replace(/^[\s\S]*?<svg[^>]*>/i, '')
    .replace(/<\/svg>\s*$/i, '');
}

function buildPrintHtml(options: {
  familyName: string | null | undefined;
  settings: FamilyTreePrintSettings;
  plan: PrintLayoutPlan;
  svgMarkup: string | null;
  rasterDataUrl: string | null;
}): string {
  const { familyName, settings, plan, svgMarkup, rasterDataUrl } = options;
  const title = familyName?.trim() ? `شجرة عائلة ${familyName.trim()}` : 'شجرة العائلة';
  const pageSize = getPageSizeMm(settings);
  const grayscaleFilter = settings.colorMode === 'grayscale' ? 'filter: grayscale(100%);' : '';
  const fitSinglePage = settings.scaleMode === 'fit-page' && plan.totalPages === 1;

  const pages = plan.tiles.map((tile) => {
    const pageNumber = tile.index + 1;
    const viewBox = `${tile.x} ${tile.y} ${tile.width} ${tile.height}`;
    const content = plan.useVector && svgMarkup
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">${extractSvgInner(svgMarkup)}</svg>`
      : rasterDataUrl
        ? `<div class="print-raster-crop" style="background-image:url('${rasterDataUrl}');background-position:${-tile.x}px ${-tile.y}px;background-size:${plan.contentWidth}px ${plan.contentHeight}px;"></div>`
        : '';

    return `
      <section class="print-page">
        <header class="print-page-header">
          <span class="print-page-title">${escapeXml(title)}</span>
          <span class="print-page-meta">صفحة ${pageNumber} من ${plan.totalPages}</span>
        </header>
        <div class="print-page-body${fitSinglePage ? ' is-fit-page' : ''}" style="${grayscaleFilter}">
          ${content}
        </div>
      </section>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>${escapeXml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@500;700;800&display=swap" rel="stylesheet" />
  <style>
    @page {
      size: ${pageSize.widthMm}mm ${pageSize.heightMm}mm;
      margin: ${MARGIN_MM[settings.margins]}mm;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: 'Tajawal', 'Segoe UI', sans-serif;
      background: #fff;
      color: #45503a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .print-page {
      width: ${plan.printableWidthMm}mm;
      min-height: ${plan.printableHeightMm + HEADER_MM}mm;
      break-after: page;
      page-break-after: always;
      display: flex;
      flex-direction: column;
      gap: 3mm;
    }
    .print-page:last-child {
      break-after: auto;
      page-break-after: auto;
    }
    .print-page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8mm;
      min-height: ${HEADER_MM}mm;
      border-bottom: 0.3mm solid rgba(120, 96, 55, 0.25);
      padding-bottom: 1.5mm;
      font-size: 3.4mm;
      font-weight: 700;
    }
    .print-page-title { font-weight: 800; }
    .print-page-meta { color: #8f8b7c; white-space: nowrap; }
    .print-page-body {
      flex: 1;
      width: 100%;
      height: ${plan.printableHeightMm}mm;
      overflow: hidden;
    }
    .print-page-body.is-fit-page svg,
    .print-page-body.is-fit-page .print-raster-crop {
      width: 100%;
      height: 100%;
    }
    .print-raster-crop {
      width: 100%;
      height: 100%;
      background-repeat: no-repeat;
      image-rendering: -webkit-optimize-contrast;
      image-rendering: crisp-edges;
    }
    svg text {
      font-family: 'Tajawal', 'Segoe UI', sans-serif;
    }
  </style>
</head>
<body>${pages}</body>
</html>`;
}

export async function printFamilyTree(options: {
  members: FamilyMemberInput[];
  familyName?: string | null;
  settings: FamilyTreePrintSettings;
  exportElement: HTMLElement;
  backgroundUrl?: string | null;
  prepareView?: () => Promise<void>;
}): Promise<{ pageCount: number }> {
  const plan = computePrintLayoutPlan(options.members, options.settings);
  if (!plan) throw new Error('لا توجد بيانات للطباعة');

  if (options.prepareView) {
    await options.prepareView();
    await new Promise((resolve) => window.setTimeout(resolve, 900));
  }

  const svgMarkup = buildFamilyTreePrintSvg(
    options.members,
    options.settings,
    options.backgroundUrl,
  );

  let rasterDataUrl: string | null = null;
  if (!plan.useVector || !svgMarkup) {
    rasterDataUrl = await captureTreeRaster(options.exportElement, plan, options.settings);
  }

  const html = buildPrintHtml({
    familyName: options.familyName,
    settings: options.settings,
    plan,
    svgMarkup,
    rasterDataUrl,
  });

  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.setAttribute('aria-hidden', 'true');
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    document.body.removeChild(frame);
    throw new Error('تعذّر فتح معاينة الطباعة');
  }

  doc.open();
  doc.write(html);
  doc.close();

  await new Promise<void>((resolve) => {
    const done = () => resolve();
    if (doc.fonts?.ready) {
      void doc.fonts.ready.then(() => window.setTimeout(done, 350));
    } else {
      window.setTimeout(done, 700);
    }
  });

  win.focus();
  win.print();

  window.setTimeout(() => {
    document.body.removeChild(frame);
  }, 1200);

  return { pageCount: plan.totalPages };
}

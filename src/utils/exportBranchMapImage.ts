import type { Edge, Node } from '@xyflow/react';

import { resolveMemberPhotoUrl } from '../assets/avatars/catalog';
import {
  buildFamilyTreeFlowLayout,
  type FamilyTreeNodeData,
} from './buildFamilyTreeFlowLayout';
import {
  buildBranchFamilyEdgePath,
  type BranchFamilyEdgeData,
} from './branchFamilyEdgePath';
import { prepareBranchSubtreeForFlow } from './familyForest/getBranchSubtreeMembers';
import { computeMemberBounds } from './familyTreeFlowViewport';
import type { FamilyMemberInput } from './treeLayout/types';

const EXPORT_PADDING = 40;
const EDGE_COLOR = '#4a3226';
const EDGE_WIDTH = 2.5;
const BG_COLOR = '#f3ede2';
const EXPORT_SCALE = 2;
const FONT_FAMILY = "'Tajawal', 'Segoe UI', Tahoma, sans-serif";

const BRANCH_MAP_GEN_THEME: Record<string, { top: string; bottom: string; badge: string }> = {
  g1: { top: '#b8944f', bottom: '#7a5c28', badge: '#f0d080' },
  g2: { top: '#5f8a5a', bottom: '#3d5c3a', badge: '#a8d8a0' },
  g3: { top: '#3d8a9e', bottom: '#245a68', badge: '#7ec8dc' },
  g4: { top: '#7d58a0', bottom: '#523870', badge: '#c8a0e0' },
  g5: { top: '#c85a62', bottom: '#8c3840', badge: '#f0a8ae' },
  g6: { top: '#4a5c9a', bottom: '#2e3c6a', badge: '#98aae8' },
  g7: { top: '#c87838', bottom: '#8a5020', badge: '#f0b878' },
  g8: { top: '#5a6878', bottom: '#384450', badge: '#a8b8c8' },
};

export interface BranchMapExportOptions {
  members: FamilyMemberInput[];
  branchHeadId: number;
  familyId?: number;
  layoutMaxWidth: number;
  mapName?: string | null;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w\u0600-\u06FF\s-]+/g, '').trim().replace(/\s+/g, '-') || 'family-map';
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toAbsoluteUrl(url: string): string {
  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
  if (typeof window === 'undefined') return url;
  try {
    return new URL(url, window.location.origin).toString();
  } catch {
    return url;
  }
}

function buildBranchMapLayout(options: BranchMapExportOptions) {
  const branchMembers = prepareBranchSubtreeForFlow(
    options.members,
    options.branchHeadId,
    options.familyId,
  );
  const layout = buildFamilyTreeFlowLayout(branchMembers, null, [], {
    allMembers: branchMembers,
    maxVisibleGenerations: 6,
    childCountMembers: branchMembers,
    thinEdges: true,
    compactVertical: true,
    layoutMaxWidth: options.layoutMaxWidth,
  });

  return { branchMembers, layout };
}

function renderBranchMapNodeSvg(node: Node<FamilyTreeNodeData>): string {
  const data = node.data;
  const width = node.width ?? 152;
  const height = node.height ?? 108;
  const x = node.position.x;
  const y = node.position.y;
  const theme = BRANCH_MAP_GEN_THEME[data.generationClass] ?? BRANCH_MAP_GEN_THEME.g1;
  const gradientId = `node-grad-${data.memberId}`;
  const radius = data.isFounder ? 16 : 14;
  const badgeR = 21;
  const badgeCy = y + 9;
  const badgeCx = x + width / 2;
  const nameSize = data.isFounder ? 26 : 22;
  const nameY = data.isFounder ? y + 58 : y + 54;
  const childrenY = data.isFounder ? y + 88 : y + 78;
  const roleY = y + height - 14;

  const photo = resolveMemberPhotoUrl(data.photoUrl ?? null);
  const photoMarkup = photo
    ? `<clipPath id="clip-${data.memberId}"><circle cx="${badgeCx}" cy="${badgeCy}" r="${badgeR}" /></clipPath>
       <image href="${escapeXml(toAbsoluteUrl(photo))}" x="${badgeCx - badgeR}" y="${badgeCy - badgeR}" width="${badgeR * 2}" height="${badgeR * 2}" clip-path="url(#clip-${data.memberId})" preserveAspectRatio="xMidYMid slice" />`
    : `<text x="${badgeCx}" y="${badgeCy + 7}" text-anchor="middle" font-size="18" font-weight="700" fill="#ffffff" font-family="${FONT_FAMILY}">${escapeXml(data.initial)}</text>`;

  return `
    <g data-member-id="${data.memberId}">
      <defs>
        <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${theme.top}" />
          <stop offset="100%" stop-color="${theme.bottom}" />
        </linearGradient>
        <filter id="shadow-${data.memberId}" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="rgba(30, 30, 20, 0.28)" />
        </filter>
      </defs>
      <rect
        x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}"
        fill="url(#${gradientId})"
        stroke="rgba(255,255,255,0.24)"
        stroke-width="1.5"
        filter="url(#shadow-${data.memberId})"
      />
      <circle cx="${badgeCx}" cy="${badgeCy}" r="${badgeR}" fill="${theme.badge}" stroke="#ffffff" stroke-width="3" />
      ${photoMarkup}
      <text x="${badgeCx}" y="${nameY}" text-anchor="middle" font-size="${nameSize}" font-weight="800" fill="#ffffff" font-family="${FONT_FAMILY}">${escapeXml(data.displayName)}</text>
      <text x="${badgeCx}" y="${childrenY}" text-anchor="middle" font-size="14" font-weight="600" fill="rgba(255,255,255,0.88)" font-family="${FONT_FAMILY}">أبناء: ${data.childCount}</text>
      ${data.isFounder ? `<text x="${badgeCx}" y="${roleY}" text-anchor="middle" font-size="13" font-weight="700" fill="rgba(255,255,255,0.92)" font-family="${FONT_FAMILY}">مؤسس العائلة</text>` : ''}
    </g>
  `;
}

function renderBranchMapEdgeSvg(
  edge: Edge,
  nodeById: Map<string, Node>,
): string {
  const parent = nodeById.get(edge.source);
  const child = nodeById.get(edge.target);
  if (!parent || !child || parent.type !== 'familyMember' || child.type !== 'familyMember') {
    return '';
  }

  const parentW = parent.width ?? 152;
  const parentH = parent.height ?? 108;
  const childW = child.width ?? 152;

  const sourceX = parent.position.x + parentW / 2;
  const sourceY = parent.position.y + parentH;
  const targetX = child.position.x + childW / 2;
  const targetY = child.position.y;

  const path = buildBranchFamilyEdgePath(
    sourceX,
    sourceY,
    targetX,
    targetY,
    edge.data as BranchFamilyEdgeData | undefined,
  );

  return `<path d="${path}" fill="none" stroke="${EDGE_COLOR}" stroke-width="${EDGE_WIDTH}" stroke-linecap="butt" stroke-linejoin="round" />`;
}

function buildBranchMapSvgParts(options: BranchMapExportOptions): {
  svgMarkup: string;
  width: number;
  height: number;
} | null {
  const { layout } = buildBranchMapLayout(options);
  const memberNodes = layout.nodes.filter((node) => node.type === 'familyMember');
  if (memberNodes.length === 0) return null;

  const bounds = computeMemberBounds(memberNodes, EXPORT_PADDING);
  const width = Math.ceil(bounds.width);
  const height = Math.ceil(bounds.height);
  const nodeById = new Map(layout.nodes.map((node) => [node.id, node]));

  const edgesMarkup = layout.edges
    .map((edge) => renderBranchMapEdgeSvg(edge, nodeById))
    .join('');

  const nodesMarkup = memberNodes
    .map((node) => renderBranchMapNodeSvg(node as Node<FamilyTreeNodeData>))
    .join('');

  const svgMarkup = `
    <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${bounds.minX} ${bounds.minY} ${width} ${height}" width="${width}" height="${height}">
      <rect x="${bounds.minX}" y="${bounds.minY}" width="${width}" height="${height}" fill="${BG_COLOR}" />
      <g class="branch-map-edges">${edgesMarkup}</g>
      <g class="branch-map-nodes">${nodesMarkup}</g>
    </svg>
  `;

  return { svgMarkup, width, height };
}

export function buildBranchMapExportSvg(options: BranchMapExportOptions): string | null {
  return buildBranchMapSvgParts(options)?.svgMarkup ?? null;
}

async function rasterizeSvgMarkup(
  svgMarkup: string,
  width: number,
  height: number,
): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * EXPORT_SCALE);
    canvas.height = Math.round(height * EXPORT_SCALE);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('canvas-context-failed'));
      return;
    }

    const img = new Image();
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      ctx.scale(EXPORT_SCALE, EXPORT_SCALE);
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('svg-raster-failed'));
    };

    img.src = url;
  });
}

function triggerPngDownload(canvas: HTMLCanvasElement, filename: string): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

async function renderBranchMapCanvas(options: BranchMapExportOptions): Promise<HTMLCanvasElement> {
  const parts = buildBranchMapSvgParts(options);
  if (!parts) {
    throw new Error('empty-branch-map');
  }

  return rasterizeSvgMarkup(parts.svgMarkup, parts.width, parts.height);
}

export async function downloadBranchMapAsPng(
  options: BranchMapExportOptions,
): Promise<void> {
  const canvas = await renderBranchMapCanvas(options);
  const filename = `${sanitizeFilename(options.mapName ?? 'family-map')}.png`;
  triggerPngDownload(canvas, filename);
}

async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('png-blob-failed'));
    }, 'image/png');
  });
}

export async function shareBranchMapAsPng(
  options: BranchMapExportOptions,
): Promise<'shared' | 'unsupported' | 'cancelled' | 'failed'> {
  const canvas = await renderBranchMapCanvas(options);
  const filename = `${sanitizeFilename(options.mapName ?? 'family-map')}.png`;
  const title = options.mapName?.trim() ? `خريطة عائلة ${options.mapName.trim()}` : 'خريطة العائلة';

  if (navigator.share && navigator.canShare) {
    try {
      const blob = await canvasToPngBlob(canvas);
      const file = new File([blob], filename, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ title, files: [file] });
        return 'shared';
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'cancelled';
      }
    }
  }

  triggerPngDownload(canvas, filename);
  return 'unsupported';
}

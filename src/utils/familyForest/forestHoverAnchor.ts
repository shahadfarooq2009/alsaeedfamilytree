import type { MemberPanelAnchor } from '../computeMemberPanelAnchor';

const PANEL_ESTIMATE_WIDTH = 248;
const PANEL_ESTIMATE_HEIGHT = 340;
const GAP = 14;
const PADDING = 12;
const HEADER_CLEARANCE = 92;
const FOOTER_CLEARANCE = 108;

export function computeForestHoverAnchor(
  cardEl: HTMLElement,
  panelEl?: HTMLElement | null,
): MemberPanelAnchor {
  const cardRect = cardEl.getBoundingClientRect();
  const panelWidth = panelEl?.offsetWidth ?? PANEL_ESTIMATE_WIDTH;
  const panelHeight = panelEl?.offsetHeight ?? PANEL_ESTIMATE_HEIGHT;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const cardCenterY = cardRect.top + cardRect.height / 2;
  let left = cardRect.right + GAP;
  let placement: 'left' | 'right' = 'right';

  if (left + panelWidth > viewportWidth - PADDING) {
    left = cardRect.left - panelWidth - GAP;
    placement = 'left';
  }

  if (left < PADDING) {
    left = cardRect.right + GAP;
    placement = 'right';
  }

  if (left + panelWidth > viewportWidth - PADDING) {
    left = Math.max(PADDING, viewportWidth - panelWidth - PADDING);
  }

  let top = cardCenterY - panelHeight / 2;
  top = Math.max(
    PADDING + HEADER_CLEARANCE,
    Math.min(top, viewportHeight - panelHeight - PADDING - FOOTER_CLEARANCE),
  );

  const arrowTop = Math.max(28, Math.min(cardCenterY - top, panelHeight - 28));

  return { left, top, placement, arrowTop };
}

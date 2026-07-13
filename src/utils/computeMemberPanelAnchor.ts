export interface MemberPanelAnchor {
  left: number;
  top: number;
  placement: 'left' | 'right';
  arrowTop: number;
}

const PANEL_ESTIMATE_WIDTH = 272;
const PANEL_ESTIMATE_HEIGHT = 360;
const GAP = 12;
const PADDING = 10;

export function computeMemberPanelAnchor(
  viewportEl: HTMLElement,
  cardEl: HTMLElement,
  panelEl?: HTMLElement | null,
): MemberPanelAnchor {
  const viewportRect = viewportEl.getBoundingClientRect();
  const cardRect = cardEl.getBoundingClientRect();
  const panelWidth = panelEl?.offsetWidth ?? PANEL_ESTIMATE_WIDTH;
  const panelHeight = panelEl?.offsetHeight ?? PANEL_ESTIMATE_HEIGHT;

  const cardCenterY = cardRect.top + cardRect.height / 2 - viewportRect.top;
  const cardLeft = cardRect.left - viewportRect.left;
  const cardRight = cardRect.right - viewportRect.left;

  let left = cardLeft - panelWidth - GAP;
  let placement: 'left' | 'right' = 'left';

  if (left < PADDING) {
    left = cardRight + GAP;
    placement = 'right';
  }

  if (left + panelWidth > viewportRect.width - PADDING) {
    left = Math.max(PADDING, viewportRect.width - panelWidth - PADDING);
  }

  let top = cardCenterY - panelHeight / 2;
  top = Math.max(PADDING, Math.min(top, viewportRect.height - panelHeight - PADDING));

  const arrowTop = Math.max(28, Math.min(cardCenterY - top, panelHeight - 28));

  return { left, top, placement, arrowTop };
}

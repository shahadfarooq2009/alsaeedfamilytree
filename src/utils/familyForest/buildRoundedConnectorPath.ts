const DEFAULT_CORNER_RADIUS = 10;

export function buildRoundedConnectorPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  midY: number,
  radius = DEFAULT_CORNER_RADIUS,
): string {
  if (Math.abs(sx - tx) < 0.5) {
    return `M ${sx} ${sy} L ${tx} ${ty}`;
  }

  const hDir = tx >= sx ? 1 : -1;
  const vDirToBus = midY >= sy ? 1 : -1;
  const vDirToChild = ty >= midY ? 1 : -1;

  const r = Math.min(
    radius,
    Math.abs(midY - sy) * 0.48,
    Math.abs(ty - midY) * 0.48,
    Math.abs(tx - sx) * 0.48,
  );

  if (r < 2) {
    return `M ${sx} ${sy} L ${sx} ${midY} L ${tx} ${midY} L ${tx} ${ty}`;
  }

  const beforeCorner1Y = midY - vDirToBus * r;
  const afterCorner1X = sx + hDir * r;
  const beforeCorner2X = tx - hDir * r;
  const afterCorner2Y = midY + vDirToChild * r;

  return [
    `M ${sx} ${sy}`,
    `L ${sx} ${beforeCorner1Y}`,
    `Q ${sx} ${midY} ${afterCorner1X} ${midY}`,
    `L ${beforeCorner2X} ${midY}`,
    `Q ${tx} ${midY} ${tx} ${afterCorner2Y}`,
    `L ${tx} ${ty}`,
  ].join(' ');
}

export function buildRoundedVerticalDropPath(
  x: number,
  endY: number,
  cornerSide: 'left' | 'right' | 'none',
  busY: number,
  radius = DEFAULT_CORNER_RADIUS,
): string {
  if (Math.abs(busY - endY) < 1) {
    return `M ${x} ${busY} L ${x} ${endY}`;
  }

  if (cornerSide === 'none') {
    return `M ${x} ${busY} L ${x} ${endY}`;
  }

  const r = Math.min(radius, Math.abs(endY - busY) * 0.48);
  if (r < 2) {
    return `M ${x} ${busY} L ${x} ${endY}`;
  }

  if (cornerSide === 'left') {
    return [
      `M ${x} ${endY}`,
      `L ${x} ${busY + r}`,
      `Q ${x} ${busY} ${x + r} ${busY}`,
    ].join(' ');
  }

  return [
    `M ${x} ${endY}`,
    `L ${x} ${busY + r}`,
    `Q ${x} ${busY} ${x - r} ${busY}`,
  ].join(' ');
}

export function buildRoundedHorizontalBusPath(
  leftX: number,
  rightX: number,
  busY: number,
  radius = DEFAULT_CORNER_RADIUS,
): string {
  if (Math.abs(rightX - leftX) < 1) return '';

  const r = Math.min(radius, Math.abs(rightX - leftX) * 0.48);
  if (r < 2) {
    return `M ${leftX} ${busY} L ${rightX} ${busY}`;
  }

  return `M ${leftX + r} ${busY} L ${rightX - r} ${busY}`;
}

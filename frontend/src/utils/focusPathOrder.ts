/** Ordered connector keys from founder toward selected member, then direct children. */
export function buildFocusPathAnimationOrder(
  focusPathIds: number[],
  selectedId: number | null,
  focusChildIds: number[],
): Map<string, number> {
  const order = new Map<string, number>();
  if (selectedId == null || focusPathIds.length === 0) return order;

  const chain = [...focusPathIds].reverse();
  let index = 0;

  for (let i = 0; i < chain.length - 1; i += 1) {
    order.set(`link-${chain[i]}-${chain[i + 1]}`, index);
    index += 1;
  }

  focusChildIds.forEach((childId) => {
    order.set(`link-${selectedId}-${childId}`, index);
    index += 1;
  });

  return order;
}

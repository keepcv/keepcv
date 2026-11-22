export const SOURCE_WIDTH = 1600;
export const SOURCE_HEIGHT = 900;

export function easeBetween(frame, start, end) {
  const t = Math.max(0, Math.min(1, (frame - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

export function stageAt() {
  return { left: 272, top: 248, scale: 0.86 };
}

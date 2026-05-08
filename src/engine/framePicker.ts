export function pickFrameIndex(delaysMs: number[], cursorMs: number): number {
  if (delaysMs.length === 0) return 0;
  if (cursorMs < 0) return 0;

  const total = delaysMs.reduce((sum, d) => sum + d, 0);
  if (total <= 0) return 0;

  const wrapped = cursorMs % total;
  let acc = 0;
  for (let i = 0; i < delaysMs.length; i++) {
    acc += delaysMs[i];
    if (wrapped < acc) return i;
  }
  return delaysMs.length - 1;
}

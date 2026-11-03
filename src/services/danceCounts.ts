/**
 * Dance counts: the user taps along with the beat ("5, 6, 7, 8...") and each tap is stored as
 * a time. Counts are grouped into phrases (usually 8 counts = "one eight").
 */

export interface CountPosition {
  /** Index of the count in the list. */
  index: number;
  /** 1..countsPerBar */
  count: number;
  /** 1-based phrase number ("eight" number). */
  bar: number;
}

/** Typical time between two counts (median, so a missed or double tap doesn't skew it). */
export function medianInterval(counts: number[]): number | null {
  if (counts.length < 2) return null;
  const gaps: number[] = [];
  for (let i = 1; i < counts.length; i++) {
    const g = counts[i] - counts[i - 1];
    if (g > 0.08) gaps.push(g);
  }
  if (gaps.length === 0) return null;
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

/** The count playing at time `t`, or null before the first count / long after the last one. */
export function countAt(counts: number[], t: number, perBar: number): CountPosition | null {
  if (counts.length === 0 || t < counts[0] - 0.05) return null;
  // Binary search for the last count at or before t.
  let lo = 0;
  let hi = counts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (counts[mid] <= t + 0.03) lo = mid;
    else hi = mid - 1;
  }
  const gap = medianInterval(counts) ?? 0.6;
  if (lo === counts.length - 1 && t - counts[lo] > gap * 1.6) return null;
  return { index: lo, count: (lo % perBar) + 1, bar: Math.floor(lo / perBar) + 1 };
}

/** Adds a count at `t`. A tap right on top of an existing count replaces it. */
export function addCount(counts: number[], t: number): number[] {
  const rounded = +t.toFixed(3);
  const next = counts.filter((c) => Math.abs(c - rounded) > 0.12);
  next.push(rounded);
  next.sort((a, b) => a - b);
  return next;
}

/** Continues the user's tapped beat to the end of the routine. */
export function autoFillCounts(counts: number[], end: number): number[] {
  const gap = medianInterval(counts);
  if (!gap || counts.length < 2) return counts;
  const next = [...counts];
  let t = next[next.length - 1] + gap;
  while (t <= end + 0.01 && next.length < 2000) {
    next.push(+t.toFixed(3));
    t += gap;
  }
  return next;
}

/** Time span of every phrase ("eight"): from its first count to the first count of the next. */
export function barRanges(counts: number[], perBar: number, rangeEnd: number): { start: number; end: number }[] {
  const gap = medianInterval(counts) ?? 0.5;
  const out: { start: number; end: number }[] = [];
  for (let i = 0; i < counts.length; i += perBar) {
    const start = counts[i];
    const nextStart = counts[i + perBar];
    const lastInBar = counts[Math.min(counts.length - 1, i + perBar - 1)];
    const end = nextStart ?? Math.min(rangeEnd, lastInBar + gap);
    if (end - start > 0.2) out.push({ start: +start.toFixed(2), end: +end.toFixed(2) });
  }
  return out;
}

/** Nearest count to `t`, if one is close enough to snap to. */
export function snapToCount(counts: number[], t: number, maxDist = 0.35): number {
  let best = t;
  let bestDist = maxDist;
  for (const c of counts) {
    const d = Math.abs(c - t);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

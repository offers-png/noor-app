import type { QuranWordTiming } from '../../types/quran';

/** Source tuple: [1-based word position, start milliseconds, end milliseconds]. */
export function sourcedWordTimings(segments: unknown): QuranWordTiming[] | undefined {
  if (!Array.isArray(segments)) return undefined;
  const timings: QuranWordTiming[] = [];
  for (const segment of segments) {
    if (!Array.isArray(segment) || segment.length !== 3) continue;
    const [position, startMs, endMs] = segment;
    if (!Number.isSafeInteger(position) || position < 1 || !Number.isFinite(startMs) || startMs < 0 || !Number.isFinite(endMs) || endMs <= startMs) continue;
    timings.push({position, startMs, endMs});
  }
  return timings.length ? timings : undefined;
}

/** Never guess intervals for recordings without publisher-provided timing data. */
export function activeWordPosition(timings: readonly QuranWordTiming[] | undefined, seconds: number): number | undefined {
  if (!Number.isFinite(seconds) || seconds < 0) return undefined;
  const timeMs = seconds * 1000;
  const matches = timings?.filter(timing => timeMs >= timing.startMs && timeMs < timing.endMs) ?? [];
  return matches.length === 1 ? matches[0].position : undefined;
}

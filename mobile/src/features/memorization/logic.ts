import type { RepeatPlanStep } from '../../services/audio/AudioEngine';

export const memorizationLevels = ['listen', 'read', 'repeat', 'hide', 'recite', 'complete'] as const;
export type MemorizationLevel = typeof memorizationLevels[number];
export type MemorizationRating = 'easy' | 'practice' | 'again';

/** Preserve the source objects and order; bound practice ranges to ten consecutive ayahs. */
export function selectAyahRange<T extends { key: string }>(ayahs: T[], startKey: string, endKey?: string): T[] {
  const start = ayahs.findIndex(ayah => ayah.key === startKey);
  if (start < 0) return [];
  const requestedEnd = ayahs.findIndex(ayah => ayah.key === (endKey ?? startKey));
  const end = Math.max(start, Math.min(requestedEnd, start + 9));
  return ayahs.slice(start, end + 1);
}

export function nextMemorizationLevel(level: MemorizationLevel): MemorizationLevel {
  return memorizationLevels[Math.min(memorizationLevels.indexOf(level) + 1, memorizationLevels.length - 1)];
}

export function hiddenWordIndexes(wordCount: number, stage: number): number[] {
  // A presentation mask only. The underlying canonical record is never rewritten.
  const count = Math.ceil(Math.max(0, wordCount) * Math.max(0, Math.min(stage, 3)) / 3);
  return Array.from({ length: count }, (_, index) => index);
}

export interface PlanCursor { step: number; track: number; iteration: number; finished: boolean }
export const initialPlanCursor: PlanCursor = { step: 0, track: 0, iteration: 0, finished: false };

export function advancePlan(plan: RepeatPlanStep[], cursor: PlanCursor): PlanCursor {
  if (cursor.finished || !plan[cursor.step]) return { ...cursor, finished: true };
  const step = plan[cursor.step];
  if (cursor.track + 1 < step.trackIds.length) return { ...cursor, track: cursor.track + 1 };
  if (cursor.iteration + 1 < step.repetitions) return { ...cursor, track: 0, iteration: cursor.iteration + 1 };
  if (cursor.step + 1 < plan.length) return { step: cursor.step + 1, track: 0, iteration: 0, finished: false };
  return { ...cursor, finished: true };
}

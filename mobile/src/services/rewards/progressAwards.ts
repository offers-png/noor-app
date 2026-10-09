import type { Database } from '../database/types';
import { QUIZ_PASS_SCORE, RewardsRepository, type SubmitResult } from './RewardsRepository';

/**
 * App-verified points for saved progress: a passed quiz (80% or more), a finished Salah lesson
 * quiz, or a completed Quran memorization practice (daily revision). Self-marked practice and
 * recitations earn nothing here; recitations are rewarded only after a parent approves the video.
 */
export async function awardForProgress(db: Database, childId: number, lessonId: string, score?: number, repository = new RewardsRepository(db)): Promise<SubmitResult | undefined> {
  if (lessonId.startsWith('quran:memorize:')) return repository.submit({ childId, kind: 'revision', itemRef: lessonId, title: `Quran revision ${lessonId.slice('quran:memorize:'.length)}` });
  if (score === undefined || !Number.isFinite(score) || score < QUIZ_PASS_SCORE) return undefined;
  if (lessonId.startsWith('salah:')) return repository.submit({ childId, kind: 'salah_lesson', itemRef: lessonId, title: `${lessonId.slice('salah:'.length)} Salah lesson` });
  return repository.submit({ childId, kind: 'quiz', itemRef: lessonId, title: lessonId });
}

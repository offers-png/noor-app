import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getDb } from '../../services/database/database';
import { loadStoredLessons } from '../../content/lessons/storage';
import { isPublishedForFamily, lessonFitsAge } from '../../content/lessons/approval';
import { RewardsRepository, type SalahApproach } from '../../services/rewards/RewardsRepository';
import type { EducationLesson } from '../../types/lessons';

export type GuideState = { status: 'loading' } | { status: 'hidden' } | { status: 'error' }
  | { status: 'published' | 'preview'; lesson: EducationLesson; approach: SalahApproach };

/** A guide is shown when the parent has published the reviewed version, or as a labelled preview when they turned on review content. */
export function useGuide(id: 'guide-salah' | 'guide-wudu', developmentContent: boolean, childAge?: number | null): GuideState {
  const [state, setState] = useState<GuideState>({ status: 'loading' });
  useFocusEffect(useCallback(() => {
    let active = true;
    void (async () => {
      const db = await getDb();
      const lesson = (await loadStoredLessons(db)).find(item => item.id === id);
      const approach = (await new RewardsRepository(db).settings()).salahApproach;
      if (!active) return;
      if (lesson && isPublishedForFamily(lesson) && lessonFitsAge(lesson, childAge)) setState({ status: 'published', lesson, approach });
      else if (lesson && developmentContent) setState({ status: 'preview', lesson, approach });
      else setState({ status: 'hidden' });
    })().catch(() => { if (active) setState({ status: 'error' }); });
    return () => { active = false; };
  }, [id, developmentContent, childAge]));
  return state;
}

import type { ContentReview, EducationLesson } from '../../types/lessons';

/** Development preview is an explicit parent setting, never an automatic fallback. */
export function canShowReviewedContent(review: ContentReview, developmentContent: boolean): boolean {
  if (developmentContent && review.developmentOnly) return true;
  return !review.developmentOnly && review.status === 'published' && !!review.reviewer?.trim()
    && !!review.approvedAt && review.approvedVersion === review.version;
}
export function visibleLessons(lessons: readonly EducationLesson[], developmentContent: boolean): EducationLesson[] {
  return lessons.filter(lesson => canShowReviewedContent(lesson.review, developmentContent));
}
export function publishReviewedLesson(lesson: EducationLesson): EducationLesson {
  if (lesson.review.status !== 'approved' || !lesson.review.reviewer?.trim() || !lesson.review.approvedAt
    || lesson.review.approvedVersion !== lesson.review.version || lesson.review.developmentOnly) {
    throw new Error('Publication requires qualified approval of this version and a production content pack.');
  }
  return { ...lesson, review: { ...lesson.review, status: 'published' } };
}

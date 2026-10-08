import type { ContentReview, EducationLesson, LessonAgeRange } from '../../types/lessons';
import { reviewContentHash } from './reviewContent';

// Only these source-backed bundled education drafts have a parent publication path.
// Unknown development/import packs remain preview-only; review cannot grant rights.
const parentReviewableIds = new Set(['hadith-1', 'hadith-6018', 'hadith-13', 'islam-five-pillars', 'islam-wudu', 'islam-salah',
  'islam-story-nuh', 'islam-story-yunus', 'dua-before-eating', 'dua-forgiveness', 'dua-knowledge', 'dua-masjid-entry', 'dua-masjid-exit',
  'islam-prayer-times', 'islam-prayer-ready', 'islam-six-beliefs', 'islam-salam', 'islam-parents',
  'dua-quran-good-both-worlds', 'dua-quran-parents', 'dua-quran-knowledge', 'dua-quran-family']);
export function canParentPublishLesson(lesson: EducationLesson): boolean {
  return !lesson.review.developmentOnly || parentReviewableIds.has(lesson.id);
}
export function validAgeRange(range: LessonAgeRange | undefined): range is LessonAgeRange {
  return !!range && Number.isInteger(range.min) && Number.isInteger(range.max) && range.min >= 5 && range.max <= 15 && range.min <= range.max;
}
export function lessonFitsAge(lesson: EducationLesson, childAge?: number | null): boolean {
  // With no age saved, the range remains visible for an adult to choose together.
  return childAge == null || (validAgeRange(lesson.ageRange) && childAge >= lesson.ageRange.min && childAge <= lesson.ageRange.max);
}
function recordedReview(review: ContentReview): boolean {
  return !!review.reviewer?.trim() && !!review.approvedAt && Number.isFinite(Date.parse(review.approvedAt))
    && review.approvedVersion === review.version && review.attestation?.kind === 'parent-entered'
    && review.attestation.qualificationConfirmed === true && review.attestation.recordedAt === review.approvedAt
    && typeof review.reviewedContentHash === 'string' && /^[a-f0-9]{64}$/.test(review.reviewedContentHash);
}

/** Development preview is an explicit parent setting, never an automatic fallback. */
export function canShowReviewedContent(review: ContentReview, developmentContent: boolean): boolean {
  if (developmentContent && review.developmentOnly) return true;
  const publication = review.publication;
  return review.status === 'published' && recordedReview(review) && publication?.kind === 'parent-local'
    && publication.version === review.version && Number.isFinite(Date.parse(publication.publishedAt))
    && publication.parentSuitabilityConfirmed === true && publication.sourcePermissionConfirmed === true;
}
export function visibleLessons(lessons: readonly EducationLesson[], developmentContent: boolean, childAge?: number | null): EducationLesson[] {
  return lessons.filter(lesson => ((developmentContent && lesson.review.developmentOnly) || isPublishedForFamily(lesson)) && lessonFitsAge(lesson, childAge));
}
export function isPublishedForFamily(lesson: EducationLesson): boolean {
  return canShowReviewedContent(lesson.review, false) && canParentPublishLesson(lesson) && validAgeRange(lesson.ageRange)
    && lesson.review.reviewedContentHash === reviewContentHash(lesson);
}
export interface PublicationConfirmation { parentSuitabilityConfirmed: boolean; sourcePermissionConfirmed: boolean }
export function publishReviewedLesson(lesson: EducationLesson, confirmation?: PublicationConfirmation): EducationLesson {
  if (!canParentPublishLesson(lesson)) throw new Error('This restricted content pack has no parent publication permission.');
  if (lesson.review.status !== 'approved' || !recordedReview(lesson.review)) {
    throw new Error('Publication requires a recorded qualified-reviewer attestation for this exact version.');
  }
  if (lesson.review.reviewedContentHash !== reviewContentHash(lesson)) throw new Error('The teaching or source content changed after review. Request a new review before publication.');
  if (!validAgeRange(lesson.ageRange)) throw new Error('Save an age range from 5 to 15 before review and publication.');
  if (confirmation?.parentSuitabilityConfirmed !== true || confirmation.sourcePermissionConfirmed !== true) throw new Error('Confirm parent suitability for these ages and permission to use the cited sources.');
  return { ...lesson, review: { ...lesson.review, status: 'published', publication: {
    kind: 'parent-local', version: lesson.review.version, publishedAt: new Date().toISOString(),
    parentSuitabilityConfirmed: true, sourcePermissionConfirmed: true,
  } } };
}

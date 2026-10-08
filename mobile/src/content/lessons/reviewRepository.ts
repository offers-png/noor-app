import type { Database } from '../../services/database/types';
import type { EducationLesson, LessonAgeRange } from '../../types/lessons';
import { loadStoredLessons, seedReviewLessons } from './storage';
import { publishReviewedLesson, validAgeRange, type PublicationConfirmation } from './approval';
import { reviewContentHash } from './reviewContent';

export interface EducationEdit { sections: { title: string; body: string }[]; discussion: string; ageRange?: LessonAgeRange }
/** Parent entered review records are attestations, not verified qualifications. */
export class LessonReviewRepository {
  constructor(private readonly db: Database, private readonly parentAuthorized: () => boolean) {}
  private assertParent() { if (!this.parentAuthorized()) throw new Error('Unlock Parent Mode with your PIN before changing content.'); }
  async list(): Promise<EducationLesson[]> {
    this.assertParent();
    await seedReviewLessons(this.db);
    this.assertParent();
    return loadStoredLessons(this.db);
  }
  private async current(id: string, expectedVersion: string) {
    this.assertParent();
    const lessons = await loadStoredLessons(this.db);
    const lesson = lessons.find(item => item.id === id);
    if (!lesson) throw new Error('This lesson is unavailable.');
    if (lesson.review.version !== expectedVersion) throw new Error('The lesson changed. Reload it before editing or approving.');
    return lesson;
  }
  private async persist(previous: EducationLesson, next: EducationLesson): Promise<EducationLesson> {
    this.assertParent();
    if (JSON.stringify(previous.source) !== JSON.stringify(next.source) || previous.review.developmentOnly !== next.review.developmentOnly) throw new Error('Source metadata and content-pack restrictions cannot be edited.');
    await this.db.withTransactionAsync(async tx => {
      this.assertParent();
      const updated = await tx.runAsync('UPDATE lessons SET status=?,payload_json=? WHERE id=? AND payload_json=?', next.review.status, JSON.stringify(next), next.id, JSON.stringify(previous));
      if (updated.changes !== 1) throw new Error('The lesson changed. Reload before saving.');
      if (next.hadithId) await tx.runAsync('UPDATE hadith_lessons SET status=?,payload_json=? WHERE id=?', next.review.status, JSON.stringify(next), next.id);
    });
    return next;
  }
  async edit(id: string, expectedVersion: string, edit: EducationEdit): Promise<EducationLesson> {
    const lesson = await this.current(id, expectedVersion);
    const ageRange = edit?.ageRange ?? lesson.ageRange;
    if (!edit || !Array.isArray(edit.sections) || edit.sections.length !== lesson.sections.length
      || edit.sections.some(section => !section || typeof section.title !== 'string' || !section.title.trim() || section.title.length > 120 || typeof section.body !== 'string' || !section.body.trim() || section.body.length > 5000)
      || typeof edit.discussion !== 'string' || edit.discussion.length > 2000 || !validAgeRange(ageRange)) throw new Error('Use a valid age range from 5 to 15, section titles up to 120 characters, teaching text up to 5,000, and discussion text up to 2,000.');
    const changed = JSON.stringify(ageRange) !== JSON.stringify(lesson.ageRange) || edit.discussion !== lesson.discussion || edit.sections.some((section, index) => section.title !== lesson.sections[index].title || section.body !== lesson.sections[index].body);
    if (!changed) return lesson;
    const revision = /^\d+$/.test(lesson.review.version) ? String(Number(lesson.review.version) + 1) : `${lesson.review.version}.revision-${Date.now()}`;
    return this.persist(lesson, { ...lesson,
      sections: lesson.sections.map((section, index) => ({ ...section, title: edit.sections[index].title, body: edit.sections[index].body })), discussion: edit.discussion, ageRange: { ...ageRange },
      review: { ...lesson.review, version: revision, status: 'draft', reviewer: null, approvedAt: null, approvedVersion: null, reviewedContentHash: undefined, attestation: undefined, publication: undefined } });
  }
  async requestReview(id: string, expectedVersion: string): Promise<EducationLesson> {
    const lesson = await this.current(id, expectedVersion);
    return this.persist(lesson, { ...lesson, review: { ...lesson.review, status: 'needs_review', reviewer: null, approvedAt: null, approvedVersion: null, reviewedContentHash: undefined, attestation: undefined, publication: undefined } });
  }
  async approve(id: string, expectedVersion: string, reviewer: string, qualificationConfirmed: boolean): Promise<EducationLesson> {
    const lesson = await this.current(id, expectedVersion);
    if (lesson.review.status !== 'needs_review') throw new Error('Request review before recording approval.');
    if (!validAgeRange(lesson.ageRange)) throw new Error('Save the intended age range before the reviewer reviews this version.');
    if (typeof reviewer !== 'string' || !reviewer.trim() || reviewer.trim().length > 120 || qualificationConfirmed !== true) throw new Error('Enter the reviewer’s name and confirm that a qualified reviewer reviewed this exact version. The app cannot verify qualifications.');
    const recordedAt = new Date().toISOString();
    return this.persist(lesson, { ...lesson, review: { ...lesson.review, status: 'approved', reviewer: reviewer.trim(), approvedAt: recordedAt,
      approvedVersion: lesson.review.version, reviewedContentHash: reviewContentHash(lesson), publication: undefined, attestation: { kind: 'parent-entered', qualificationConfirmed: true, recordedAt } } });
  }
  async publish(id: string, expectedVersion: string, confirmation?: PublicationConfirmation): Promise<EducationLesson> {
    const lesson = await this.current(id, expectedVersion);
    return this.persist(lesson, publishReviewedLesson(lesson, confirmation));
  }
}

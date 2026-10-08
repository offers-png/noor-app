import type { QuizQuestion } from './quiz';

export type ReviewStatus = 'draft' | 'needs_review' | 'approved' | 'published';
export interface LessonSource {
  readonly sourceName: string;
  readonly sourceReference: string;
  readonly sourceUrl: string;
  readonly translationName: string | null;
  readonly translator: string | null;
  readonly contentVersion: string;
  /** Source/reference checked, not a claim of qualified religious approval. */
  readonly verifiedAt: string;
  readonly license: string;
  readonly licenseUrl: string;
}
export interface ContentReview {
  status: ReviewStatus;
  reviewer: string | null;
  approvedAt: string | null;
  approvedVersion: string | null;
  version: string;
  developmentOnly: boolean;
  attestation?: { kind: 'parent-entered'; qualificationConfirmed: true; recordedAt: string };
}
export interface LessonSection {
  title: string;
  body: string;
  kind: 'source_fact' | 'explanation' | 'activity';
  sourceReference?: string;
  illustration?: 'hands' | 'mouth' | 'face' | 'arms' | 'head' | 'feet' | 'standing' | 'bowing' | 'prostration' | 'sitting' | 'mosque' | 'boat' | 'ocean';
  audioUri?: string;
}
export interface EducationLesson {
  id: string;
  category: 'hadith' | 'islam' | 'duas';
  title: string;
  subtitle: string;
  topic: string;
  source: LessonSource;
  review: ContentReview;
  sections: LessonSection[];
  discussion: string;
  quiz: QuizQuestion[];
  hadithId?: string;
  duaId?: string;
  stepByStep?: boolean;
}
export interface HadithRecord {
  readonly id: string;
  readonly collection: string;
  readonly hadithNumber: string;
  readonly canonicalText: string;
  readonly translation: string;
  readonly narrator: string | null;
  readonly grades: readonly { grade: string; gradedBy: string }[];
  readonly source: LessonSource;
  readonly textScope: 'excerpt' | 'complete-source-record';
  readonly sourceFormat: 'plain-text' | 'source-html';
  readonly developmentOnly: boolean;
}
export interface DuaRecord {
  readonly id: string;
  readonly category: string;
  readonly title: string;
  readonly canonicalText: string;
  readonly transliteration: string;
  readonly translation: string;
  readonly source: LessonSource;
  readonly textScope: 'excerpt' | 'supplication';
  readonly audioUri: string | null;
  readonly review: ContentReview;
}

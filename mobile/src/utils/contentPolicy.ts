export type ReviewStatus = 'draft' | 'needs_review' | 'approved' | 'published';
export interface ReviewRecord { status: ReviewStatus; reviewer?: string; approvedAt?: string }
export function canShowContent(record: ReviewRecord, reviewMode: boolean): boolean {
  return reviewMode || (record.status === 'published' && Boolean(record.reviewer) && Boolean(record.approvedAt));
}
export function textDirection(language: 'ar' | 'en') { return language === 'ar' ? 'rtl' as const : 'ltr' as const; }
export function preserveCanonical(text: string): string { return text; }

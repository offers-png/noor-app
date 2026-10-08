import type { QuizQuestion } from '../../types/quiz';

/** A reviewer must see the actual answer key, including ordered and matched answers. */
export function quizReviewLines(question: QuizQuestion): string[] {
  if ('options' in question) return question.options.map(option => `${option.id === question.correctOptionId ? 'Answer: ' : 'Choice: '}${option.label}`);
  if (question.type === 'true-false') return [`Answer: ${question.answer ? 'True' : 'False'}`];
  if (question.type === 'match') return question.pairs.map(pair => `${pair.left} → ${pair.right}`);
  return question.correctOrder.map((id, index) => `${index + 1}. ${question.items.find(item => item.id === id)?.label ?? 'Missing answer item — review required'}`);
}

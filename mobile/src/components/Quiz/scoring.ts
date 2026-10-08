import type { QuizAnswer, QuizQuestion, QuizResult } from '../../types/quiz';

export function isArabicLabel(label: string): boolean {
  return /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/u.test(label) && !/[A-Za-z]/u.test(label);
}

export function isCorrect(question: QuizQuestion, answer: QuizAnswer | undefined): boolean {
  if (answer === undefined) return false;
  switch (question.type) {
    case 'true-false':
      return typeof answer === 'boolean' && answer === question.answer;
    case 'match':
      return !!answer && typeof answer === 'object' && !Array.isArray(answer)
        && Object.keys(answer).length === question.pairs.length
        && question.pairs.every(pair => answer[pair.id] === pair.id);
    case 'order':
      return Array.isArray(answer) && answer.length === question.correctOrder.length
        && answer.every((id, index) => id === question.correctOrder[index]);
    default:
      return typeof answer === 'string' && answer === question.correctOptionId;
  }
}

/** Answered questions are keyed by stable ID, so repeated taps never add points. */
export function scoreQuiz(questions: QuizQuestion[], answers: Record<string, QuizAnswer>): QuizResult {
  const uniqueQuestions = [...new Map(questions.map(question => [question.id, question])).values()];
  const total = uniqueQuestions.length;
  const answered = uniqueQuestions.filter(question => answerIsReady(question, answers[question.id])).length;
  const correct = uniqueQuestions.filter(question => isCorrect(question, answers[question.id])).length;
  return { total, answered, correct, score: total ? Math.round(correct / total * 100) : 0,
    complete: total > 0 && answered === total };
}

export function answerIsReady(question: QuizQuestion, answer: QuizAnswer | undefined): boolean {
  if (answer === undefined) return false;
  if (question.type === 'order') return Array.isArray(answer) && answer.length === question.items.length
    && new Set(answer).size === question.items.length
    && answer.every(id => question.items.some(item => item.id === id));
  if (question.type === 'match') return typeof answer === 'object' && !Array.isArray(answer)
    && question.pairs.every(pair => typeof answer[pair.id] === 'string')
    && new Set(Object.values(answer)).size === question.pairs.length
    && Object.values(answer).every(id => question.pairs.some(pair => pair.id === id));
  if (question.type === 'true-false') return typeof answer === 'boolean';
  return typeof answer === 'string' && question.options.some(option => option.id === answer);
}

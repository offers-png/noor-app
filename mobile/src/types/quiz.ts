export interface QuizOption { id: string; label: string }

interface QuestionBase {
  id: string;
  prompt: string;
  explanation?: string;
  sourceReference?: string;
}

export type QuizQuestion =
  | (QuestionBase & {
      type: 'multiple-choice' | 'listen-select' | 'letter' | 'meaning';
      options: QuizOption[];
      correctOptionId: string;
      arabic?: string;
      audioUri?: string;
      teachingSpeech?: string;
    })
  | (QuestionBase & { type: 'true-false'; answer: boolean })
  | (QuestionBase & { type: 'match'; pairs: { id: string; left: string; right: string }[] })
  | (QuestionBase & { type: 'order'; items: QuizOption[]; correctOrder: string[] });

export type QuizAnswer = string | boolean | Record<string, string> | string[];
export interface QuizResult {
  correct: number;
  total: number;
  answered: number;
  score: number;
  complete: boolean;
}

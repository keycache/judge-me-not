export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface Evaluation {
  scoreOutOfTen: number;
  strengths: string[];
  improvements: string[];
  summary: string;
  evaluatedAtIso: string;
}

export const ANSWER_EVALUATION_STATUSES = ['draft', 'pending', 'completed'] as const;
export type AnswerEvaluationStatus = (typeof ANSWER_EVALUATION_STATUSES)[number];

export interface Answer {
  id: string;
  questionId: string;
  transcript: string;
  audioFileUri: string | null;
  createdAtIso: string;
  evaluation: Evaluation | null;
  evaluationStatus?: AnswerEvaluationStatus;
  submittedAtIso?: string | null;
  durationSeconds?: number;
}

export interface Question {
  id: string;
  prompt: string;
  difficulty: Difficulty;
  answers: Answer[];
}

export interface QuestionList {
  id: string;
  title: string;
  roleDescription: string;
  createdAtIso: string;
  questions: Question[];
}

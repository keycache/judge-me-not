export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface Evaluation {
  scoreOutOfTen: number;
  strengths: string[];
  improvements: string[];
  summary: string;
  evaluatedAtIso: string;
}

export interface Answer {
  id: string;
  questionId: string;
  transcript: string;
  audioFileUri: string | null;
  createdAtIso: string;
  evaluation: Evaluation | null;
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

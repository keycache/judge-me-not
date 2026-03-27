export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface Evaluation {
  score: number;
  candidate_answer: string;
  feedback: string;
  gaps_identified: string[];
  model_answer: string;
}

export interface Answer {
  audio_file_path: string;
  timestamp: string;
  evaluation?: Evaluation;
}

export interface Question {
  value: string;
  category: string;
  difficulty: Difficulty;
  answer: string;
  answers?: Answer[];
}

export interface QuestionList {
  questions: Question[];
}

export function buildQuestionValueKey(question: Pick<Question, 'category' | 'difficulty' | 'value'>): string {
  return `${question.category}::${question.difficulty}::${question.value}`;
}

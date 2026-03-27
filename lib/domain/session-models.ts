import { QuestionList } from '@/lib/domain/interview-models';

export const MODEL_VARIANTS = ['gemini-2.5-flash-lite-preview', 'gemini-3.1-flash-lite-preview'] as const;
export type ModelVariant = (typeof MODEL_VARIANTS)[number];

export const EVALUATION_STRICTNESS_LEVELS = ['lenient', 'balanced', 'strict'] as const;
export type EvaluationStrictness = (typeof EVALUATION_STRICTNESS_LEVELS)[number];

export interface PromptSettings {
  modelVariant: ModelVariant;
  evaluationStrictness: EvaluationStrictness;
  systemPersona: string;
}

export interface SessionPromptSnapshot extends PromptSettings {
  resolvedPrompt: string;
}

export interface SessionSourceContext {
  inputMode: 'text' | 'image';
  sourceText?: string;
  imageUris?: string[];
}

export interface AudioIndexEntry {
  answerId: string;
  questionId: string;
  uri: string;
  createdAtIso: string;
}

export interface Session {
  id: string;
  title: string;
  createdAtIso: string;
  updatedAtIso: string;
  questionList: QuestionList;
  audioIndex: AudioIndexEntry[];
  promptSnapshot: SessionPromptSnapshot | null;
  sourceContext?: SessionSourceContext;
}

export interface AppSettings {
  activeSessionId: string | null;
  recordingLimitSeconds: number;
  promptSettings: PromptSettings;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  activeSessionId: null,
  recordingLimitSeconds: 120,
  promptSettings: {
    modelVariant: 'gemini-3.1-flash-lite-preview',
    evaluationStrictness: 'balanced',
    systemPersona: 'Direct and constructive interview coach',
  },
};

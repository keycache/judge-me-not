import { QuestionList } from '@/lib/domain/interview-models';

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
}

export interface AppSettings {
  activeSessionId: string | null;
  recordingLimitSeconds: number;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  activeSessionId: null,
  recordingLimitSeconds: 120,
};

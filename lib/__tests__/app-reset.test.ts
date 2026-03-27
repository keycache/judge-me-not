import AsyncStorage from '@react-native-async-storage/async-storage';

import { buildQuestionValueKey } from '@/lib/domain/interview-models';
import { resolveGateTarget } from '@/lib/navigation-gate';
import { clearAllAppData } from '@/lib/repositories/app-reset';
import { appendAttempt, listPendingEvaluations, submitAttemptForEvaluation } from '@/lib/repositories/practice-repository';
import { createSessionFromQuestionList, listSessions, saveSession } from '@/lib/repositories/session-repository';
import { getAppSettings, saveAppSettings } from '@/lib/repositories/settings-repository';
import { clearApiKey, getApiKey, saveApiKey } from '@/lib/settings-store';
import { __resetJsonStorageForTests } from '@/lib/storage/json-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const backingStore = new Map<string, string>();

function buildQuestionList() {
  return {
    questions: [
      {
        value: 'Tell me about a difficult migration you led.',
        category: 'Behavioral',
        difficulty: 'Medium' as const,
        answer: 'Explain context, trade-offs, execution, and measurable outcome.',
        answers: [],
      },
    ],
  };
}

describe('app reset repository', () => {
  beforeEach(async () => {
    backingStore.clear();
    __resetJsonStorageForTests();
    jest.clearAllMocks();

    storage.getItem.mockImplementation(async (key: string) => backingStore.get(key) ?? null);
    storage.setItem.mockImplementation(async (key: string, value: string) => {
      backingStore.set(key, value);
    });
    storage.removeItem.mockImplementation(async (key: string) => {
      backingStore.delete(key);
    });

    await clearApiKey();
  });

  it('clears sessions, pending evaluations, settings, and api key', async () => {
    const session = createSessionFromQuestionList({
      sessionNameFromModel: 'Reset Target Session',
      questionList: buildQuestionList(),
      createdAt: new Date('2026-03-27T09:00:00.000Z'),
    });
    await saveSession(session);

    const questionValueKey = buildQuestionValueKey(session.questionList.questions[0]);
    const attempt = await appendAttempt({
      sessionId: session.id,
      questionValueKey,
      transcript: 'A migration answer',
      audioFilePath: 'file:///attempt-reset.m4a',
    });

    await submitAttemptForEvaluation({
      sessionId: session.id,
      questionValueKey,
      answerTimestamp: attempt.timestamp,
      transcript: 'A migration answer',
      isOnline: false,
    });

    await saveAppSettings({
      activeSessionId: session.id,
      recordingLimitSeconds: 180,
      promptSettings: {
        modelVariant: 'gemini-2.5-flash-lite-preview',
        evaluationStrictness: 'strict',
        systemPersona: 'Strict interviewer',
      },
    });
    await saveApiKey('sk-reset-me');

    await clearAllAppData();

    expect(await listSessions()).toEqual([]);
    expect(await listPendingEvaluations()).toEqual([]);
    expect(await getApiKey()).toBeNull();

    const settings = await getAppSettings();
    expect(settings.activeSessionId).toBeNull();
    expect(settings.recordingLimitSeconds).toBe(120);
    expect(settings.promptSettings.modelVariant).toBe('gemini-3.1-flash-lite-preview');
  });

  it('is idempotent when run multiple times', async () => {
    await clearAllAppData();
    await clearAllAppData();

    expect(await listSessions()).toEqual([]);
    expect(await listPendingEvaluations()).toEqual([]);
    expect(await getApiKey()).toBeNull();
  });

  it('removes persisted answers and evaluations by clearing the session store', async () => {
    const session = createSessionFromQuestionList({
      sessionNameFromModel: 'Evaluated Session',
      questionList: {
        questions: [
          {
            value: 'Tell me about a difficult migration you led.',
            category: 'Behavioral',
            difficulty: 'Medium',
            answer: 'Explain context, trade-offs, execution, and measurable outcome.',
            answers: [
              {
                audio_file_path: 'file:///evaluated-attempt.m4a',
                timestamp: '2026-03-27T09:15:00.000Z',
                evaluation: {
                  score: 9,
                  candidate_answer: 'I handled the migration rollout and rollback plan.',
                  feedback: 'Strong answer with clear ownership.',
                  gaps_identified: ['Add explicit business impact'],
                  model_answer: 'A strong answer should also quantify results.',
                },
              },
            ],
          },
        ],
      },
      createdAt: new Date('2026-03-27T09:10:00.000Z'),
    });

    await saveSession(session);
    await clearAllAppData();

    expect(await listSessions()).toEqual([]);
  });

  it('routes app boot back to setup after clear all removes the api key', async () => {
    await saveApiKey('sk-reset-boot');

    await clearAllAppData();

    const apiKey = await getApiKey();
    expect(resolveGateTarget({ hasHydrated: true, apiKey })).toBe('/setup-api');
  });
});


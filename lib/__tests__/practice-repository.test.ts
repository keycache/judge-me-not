import AsyncStorage from '@react-native-async-storage/async-storage';

import { buildQuestionValueKey } from '@/lib/domain/interview-models';
import { evaluateInterviewAnswer } from '@/lib/genai';
import { createSessionFromQuestionList, getSessionById, saveSession } from '@/lib/repositories/session-repository';
import { getAppSettings } from '@/lib/repositories/settings-repository';
import { __resetJsonStorageForTests } from '@/lib/storage/json-storage';
import {
  appendAttempt,
  listAttempts,
  listPendingEvaluations,
  processPendingEvaluations,
  submitAttemptForEvaluation,
} from '../repositories/practice-repository';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('../genai', () => ({
  evaluateInterviewAnswer: jest.fn(),
}));

jest.mock('@/lib/repositories/settings-repository', () => ({
  getAppSettings: jest.fn(),
}));

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockEvaluateInterviewAnswer = evaluateInterviewAnswer as jest.MockedFunction<typeof evaluateInterviewAnswer>;
const mockGetAppSettings = getAppSettings as jest.MockedFunction<typeof getAppSettings>;
const backingStore = new Map<string, string>();

function buildSessionQuestionList() {
  return {
    questions: [
      {
        value: 'Tell me about a difficult debugging incident.',
        category: 'Practice Questions',
        difficulty: 'Medium' as const,
        answer: 'Use STAR with root cause analysis and measurable outcome.',
        answers: [],
      },
    ],
  };
}

describe('practice repository', () => {
  beforeEach(() => {
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
    mockGetAppSettings.mockResolvedValue({
      activeSessionId: null,
      recordingLimitSeconds: 120,
      promptSettings: {
        modelVariant: 'gemini-3.1-flash-lite-preview',
        evaluationStrictness: 'balanced',
        systemPersona: 'Coach',
      },
    });
    mockEvaluateInterviewAnswer.mockResolvedValue({
      score: 8,
      candidate_answer: 'Candidate answer',
      feedback: 'Solid answer.',
      gaps_identified: ['Add more metrics'],
      model_answer: 'Model answer',
    });
  });

  async function createSession() {
    const session = createSessionFromQuestionList({
      sessionNameFromModel: 'Practice Session',
      questionList: buildSessionQuestionList(),
      createdAt: new Date('2026-03-26T13:00:00.000Z'),
    });

    await saveSession(session);
    return session;
  }

  function getQuestionValueKey() {
    return buildQuestionValueKey(buildSessionQuestionList().questions[0]);
  }

  it('appends attempts without overwriting existing ones', async () => {
    const session = await createSession();

    const first = await appendAttempt({
      sessionId: session.id,
      questionValueKey: getQuestionValueKey(),
      transcript: 'First answer',
      audioFilePath: 'file:///attempt-1.m4a',
    });

    const second = await appendAttempt({
      sessionId: session.id,
      questionValueKey: getQuestionValueKey(),
      transcript: 'Second answer',
      audioFilePath: 'file:///attempt-2.m4a',
    });

    const attempts = await listAttempts(session.id, getQuestionValueKey());

    expect(attempts).toHaveLength(2);
    expect(attempts.map((item: { timestamp: string }) => item.timestamp)).toContain(first.timestamp);
    expect(attempts.map((item: { timestamp: string }) => item.timestamp)).toContain(second.timestamp);
  });

  it('queues evaluation when offline then auto-processes on reconnect', async () => {
    const session = await createSession();

    const attempt = await appendAttempt({
      sessionId: session.id,
      questionValueKey: getQuestionValueKey(),
      transcript: 'Offline submit answer body',
      audioFilePath: 'file:///attempt-offline.m4a',
    });

    const submitResult = await submitAttemptForEvaluation({
      sessionId: session.id,
      questionValueKey: getQuestionValueKey(),
      answerTimestamp: attempt.timestamp,
      transcript: 'Offline submit answer body',
      isOnline: false,
    });

    expect(submitResult).toBe('pending');
    expect((await listPendingEvaluations()).length).toBe(1);

    const processedCount = await processPendingEvaluations(true);
    expect(processedCount).toBe(1);
    expect((await listPendingEvaluations()).length).toBe(0);

    const reloaded = await getSessionById(session.id);
    const answer = reloaded?.questionList.questions[0].answers?.find((item) => item.timestamp === attempt.timestamp);

    expect(answer?.evaluation).toBeDefined();
    expect(answer?.evaluation).not.toBeNull();
    expect(mockEvaluateInterviewAnswer).toHaveBeenCalledTimes(1);
  });

  it('evaluates immediately when online', async () => {
    const session = await createSession();

    const attempt = await appendAttempt({
      sessionId: session.id,
      questionValueKey: getQuestionValueKey(),
      transcript: 'Online submit answer body',
      audioFilePath: 'file:///attempt-online.m4a',
    });

    const result = await submitAttemptForEvaluation({
      sessionId: session.id,
      questionValueKey: getQuestionValueKey(),
      answerTimestamp: attempt.timestamp,
      transcript: 'Online submit answer body',
      isOnline: true,
    });

    expect(result).toBe('completed');
    expect((await listPendingEvaluations()).length).toBe(0);

    const reloaded = await getSessionById(session.id);
    const answer = reloaded?.questionList.questions[0].answers?.find((item) => item.timestamp === attempt.timestamp);
    expect(answer?.evaluation).toBeDefined();
    expect(answer?.evaluation?.score).toBeGreaterThan(0);
  });

  it('queues evaluation when online processing fails', async () => {
    const session = await createSession();

    const attempt = await appendAttempt({
      sessionId: session.id,
      questionValueKey: getQuestionValueKey(),
      transcript: 'Answer body',
      audioFilePath: 'file:///attempt-online-fail.m4a',
    });

    mockEvaluateInterviewAnswer.mockRejectedValueOnce(new Error('service unavailable'));

    const result = await submitAttemptForEvaluation({
      sessionId: session.id,
      questionValueKey: getQuestionValueKey(),
      answerTimestamp: attempt.timestamp,
      transcript: 'Answer body',
      isOnline: true,
    });

    expect(result).toBe('pending');
    expect((await listPendingEvaluations()).length).toBe(1);
  });
});

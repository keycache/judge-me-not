import AsyncStorage from '@react-native-async-storage/async-storage';

import { appendAttempt, listAttempts, listPendingEvaluations, processPendingEvaluations, submitAttemptForEvaluation } from '@/lib/repositories/practice-repository';
import { createSessionFromQuestionList, getSessionById, saveSession } from '@/lib/repositories/session-repository';
import { __resetJsonStorageForTests } from '@/lib/storage/json-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const backingStore = new Map<string, string>();

function buildSessionQuestionList() {
  return {
    id: 'ql-practice',
    title: 'Practice Questions',
    roleDescription: 'React Native role',
    createdAtIso: '2026-03-26T12:00:00.000Z',
    questions: [
      {
        id: 'q-1',
        prompt: 'Tell me about a difficult debugging incident.',
        difficulty: 'Medium' as const,
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

  it('appends attempts without overwriting existing ones', async () => {
    const session = await createSession();

    const first = await appendAttempt({
      sessionId: session.id,
      questionId: 'q-1',
      transcript: 'First answer',
      audioFileUri: 'file:///attempt-1.m4a',
      durationSeconds: 21,
    });

    const second = await appendAttempt({
      sessionId: session.id,
      questionId: 'q-1',
      transcript: 'Second answer',
      audioFileUri: 'file:///attempt-2.m4a',
      durationSeconds: 33,
    });

    const attempts = await listAttempts(session.id, 'q-1');

    expect(attempts).toHaveLength(2);
    expect(attempts.map((item) => item.id)).toContain(first.id);
    expect(attempts.map((item) => item.id)).toContain(second.id);
  });

  it('queues evaluation when offline then auto-processes on reconnect', async () => {
    const session = await createSession();

    const attempt = await appendAttempt({
      sessionId: session.id,
      questionId: 'q-1',
      transcript: 'Offline submit answer body',
      audioFileUri: 'file:///attempt-offline.m4a',
      durationSeconds: 25,
    });

    const submitResult = await submitAttemptForEvaluation({
      sessionId: session.id,
      questionId: 'q-1',
      answerId: attempt.id,
      isOnline: false,
    });

    expect(submitResult).toBe('pending');
    expect((await listPendingEvaluations()).length).toBe(1);

    const processedCount = await processPendingEvaluations(true);
    expect(processedCount).toBe(1);
    expect((await listPendingEvaluations()).length).toBe(0);

    const reloaded = await getSessionById(session.id);
    const answer = reloaded?.questionList.questions[0].answers.find((item) => item.id === attempt.id);

    expect(answer?.evaluationStatus).toBe('completed');
    expect(answer?.evaluation).not.toBeNull();
  });

  it('evaluates immediately when online', async () => {
    const session = await createSession();

    const attempt = await appendAttempt({
      sessionId: session.id,
      questionId: 'q-1',
      transcript: 'Online submit answer body',
      audioFileUri: 'file:///attempt-online.m4a',
      durationSeconds: 18,
    });

    const result = await submitAttemptForEvaluation({
      sessionId: session.id,
      questionId: 'q-1',
      answerId: attempt.id,
      isOnline: true,
    });

    expect(result).toBe('completed');
    expect((await listPendingEvaluations()).length).toBe(0);

    const reloaded = await getSessionById(session.id);
    const answer = reloaded?.questionList.questions[0].answers.find((item) => item.id === attempt.id);
    expect(answer?.evaluationStatus).toBe('completed');
    expect(answer?.evaluation?.scoreOutOfTen).toBeGreaterThan(0);
  });
});

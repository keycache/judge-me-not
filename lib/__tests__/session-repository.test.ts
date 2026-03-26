import AsyncStorage from '@react-native-async-storage/async-storage';

import { QuestionList } from '@/lib/domain/interview-models';
import {
    createSessionFromQuestionList,
    deleteSession,
    getSessionById,
    listSessionAudioFiles,
    listSessions,
    saveSession,
} from '@/lib/repositories/session-repository';
import { __resetJsonStorageForTests } from '@/lib/storage/json-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const backingStore = new Map<string, string>();

function buildQuestionList(): QuestionList {
  return {
    id: 'question-list-1',
    title: 'Mobile System Design',
    roleDescription: 'Senior React Native',
    createdAtIso: '2026-03-26T12:00:00.000Z',
    questions: [
      {
        id: 'q-1',
        prompt: 'How do you optimize bundle size?',
        difficulty: 'Hard',
        answers: [
          {
            id: 'a-1',
            questionId: 'q-1',
            transcript: 'Use Hermes and split bundles where possible.',
            audioFileUri: 'file:///sessions/audio-a1.m4a',
            createdAtIso: '2026-03-26T12:10:00.000Z',
            evaluation: null,
          },
        ],
      },
    ],
  };
}

describe('session repository', () => {
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

  it('creates and persists a session with audio index', async () => {
    const session = createSessionFromQuestionList({
      sessionNameFromModel: 'Senior Mobile Architecture',
      questionList: buildQuestionList(),
      createdAt: new Date('2026-03-26T14:30:45.000Z'),
    });

    const saved = await saveSession(session);
    const sessions = await listSessions();

    expect(saved.id).toMatch(/^senior-mobile-architecture-20260326-\d{6}$/);
    expect(saved.audioIndex).toHaveLength(1);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe(saved.id);
  });

  it('reads back by id and lists local audio files', async () => {
    const session = createSessionFromQuestionList({
      sessionNameFromModel: 'React Native Senior Loop',
      questionList: buildQuestionList(),
      createdAt: new Date('2026-03-26T15:00:00.000Z'),
    });

    await saveSession(session);

    const loaded = await getSessionById(session.id);
    const audioFiles = await listSessionAudioFiles(session.id);

    expect(loaded?.title).toBe('React Native Senior Loop');
    expect(audioFiles).toEqual(['file:///sessions/audio-a1.m4a']);
  });

  it('deletes sessions from repository', async () => {
    const session = createSessionFromQuestionList({
      sessionNameFromModel: 'Delete Me',
      questionList: buildQuestionList(),
      createdAt: new Date('2026-03-26T16:00:00.000Z'),
    });

    await saveSession(session);
    await deleteSession(session.id);

    const sessions = await listSessions();
    expect(sessions).toHaveLength(0);
  });
});

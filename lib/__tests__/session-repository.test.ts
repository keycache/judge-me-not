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
    questions: [
      {
        value: 'How do you optimize bundle size?',
        category: 'Mobile System Design',
        difficulty: 'Hard',
        answer: 'Discuss Hermes, code splitting, dead code elimination, and metrics.',
        answers: [
          {
            audio_file_path: 'file:///sessions/audio-a1.m4a',
            timestamp: '2026-03-26T12:10:00.000Z',
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

  it('persists prompt snapshot exactly as saved for session consistency', async () => {
    const session = createSessionFromQuestionList({
      sessionNameFromModel: 'Prompt Snapshot Session',
      questionList: buildQuestionList(),
      promptSnapshot: {
        modelVariant: 'gpt-4.1-mini',
        evaluationStrictness: 'strict',
        systemPersona: 'Very strict interviewer',
        resolvedPrompt: 'Prompt body v1',
      },
      createdAt: new Date('2026-03-26T15:30:00.000Z'),
    });

    const saved = await saveSession(session);
    const loaded = await getSessionById(saved.id);

    expect(loaded?.promptSnapshot).toEqual({
      modelVariant: 'gpt-4.1-mini',
      evaluationStrictness: 'strict',
      systemPersona: 'Very strict interviewer',
      resolvedPrompt: 'Prompt body v1',
    });
  });

  it('persists source context for text and image sessions', async () => {
    const textSession = createSessionFromQuestionList({
      sessionNameFromModel: 'Text Source Session',
      questionList: buildQuestionList(),
      sourceContext: {
        inputMode: 'text',
        sourceText: 'Senior mobile engineer role focusing on architecture and delivery.',
      },
      createdAt: new Date('2026-03-26T15:35:00.000Z'),
    });

    const imageSession = createSessionFromQuestionList({
      sessionNameFromModel: 'Image Source Session',
      questionList: buildQuestionList(),
      sourceContext: {
        inputMode: 'image',
        imageUris: ['file:///tmp/1.jpg', 'file:///tmp/2.jpg'],
      },
      createdAt: new Date('2026-03-26T15:36:00.000Z'),
    });

    await saveSession(textSession);
    await saveSession(imageSession);

    const loadedText = await getSessionById(textSession.id);
    const loadedImage = await getSessionById(imageSession.id);

    expect(loadedText?.sourceContext?.inputMode).toBe('text');
    expect(loadedText?.sourceContext?.sourceText).toMatch(/architecture/);
    expect(loadedImage?.sourceContext?.inputMode).toBe('image');
    expect(loadedImage?.sourceContext?.imageUris).toEqual(['file:///tmp/1.jpg', 'file:///tmp/2.jpg']);
  });

  it('returns empty audio file list for missing session id', async () => {
    const audioFiles = await listSessionAudioFiles('missing-session-id');
    expect(audioFiles).toEqual([]);
  });

  it('lists sessions sorted by most recent creation date first', async () => {
    const older = createSessionFromQuestionList({
      sessionNameFromModel: 'Older Session',
      questionList: buildQuestionList(),
      createdAt: new Date('2026-03-26T09:00:00.000Z'),
    });

    const newer = createSessionFromQuestionList({
      sessionNameFromModel: 'Newer Session',
      questionList: buildQuestionList(),
      createdAt: new Date('2026-03-26T18:00:00.000Z'),
    });

    await saveSession(older);
    await saveSession(newer);

    const sessions = await listSessions();
    expect(sessions).toHaveLength(2);
    expect(sessions[0].title).toBe('Newer Session');
    expect(sessions[1].title).toBe('Older Session');
  });

  it('rejects saving invalid sessions', async () => {
    const invalid = createSessionFromQuestionList({
      sessionNameFromModel: 'Broken Session',
      questionList: buildQuestionList(),
      createdAt: new Date('2026-03-26T17:00:00.000Z'),
    });

    invalid.questionList.questions = [];

    await expect(saveSession(invalid)).rejects.toThrow(/at least one question/i);
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

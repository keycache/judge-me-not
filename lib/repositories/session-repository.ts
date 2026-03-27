import { QuestionList } from '@/lib/domain/interview-models';
import { AudioIndexEntry, Session, SessionPromptSnapshot, SessionSourceContext } from '@/lib/domain/session-models';
import { validateSession } from '@/lib/domain/validators';
import { buildSessionIdentity } from '@/lib/session-identity';
import { readJsonValue, removeJsonValue, writeJsonValue } from '@/lib/storage/json-storage';

const SESSIONS_STORAGE_KEY = 'judge-me-not.sessions.json';

export function buildAudioIndex(questionList: QuestionList): AudioIndexEntry[] {
  const index: AudioIndexEntry[] = [];

  for (const question of questionList.questions) {
    for (const answer of question.answers ?? []) {
      if (!answer.audio_file_path) {
        continue;
      }

      index.push({
        answerId: `${question.value}::${answer.timestamp}`,
        questionId: question.value,
        uri: answer.audio_file_path,
        createdAtIso: answer.timestamp,
      });
    }
  }

  return index;
}

export function createSessionFromQuestionList(input: {
  sessionNameFromModel: string;
  questionList: QuestionList;
  promptSnapshot?: SessionPromptSnapshot | null;
  sourceContext?: SessionSourceContext;
  createdAt?: Date;
}): Session {
  const timestamp = input.createdAt ?? new Date();
  const identity = buildSessionIdentity(input.sessionNameFromModel, timestamp);
  const iso = timestamp.toISOString();

  return {
    id: identity.id,
    title: identity.title,
    createdAtIso: iso,
    updatedAtIso: iso,
    questionList: input.questionList,
    audioIndex: buildAudioIndex(input.questionList),
    promptSnapshot: input.promptSnapshot ?? null,
    sourceContext: input.sourceContext,
  };
}

export async function listSessions(): Promise<Session[]> {
  const sessions = await readJsonValue<Session[]>(SESSIONS_STORAGE_KEY, []);
  return [...sessions].sort((a, b) => (a.createdAtIso < b.createdAtIso ? 1 : -1));
}

export async function getSessionById(sessionId: string): Promise<Session | null> {
  const sessions = await listSessions();
  return sessions.find((session) => session.id === sessionId) ?? null;
}

export async function saveSession(session: Session): Promise<Session> {
  const normalized: Session = {
    ...session,
    updatedAtIso: new Date().toISOString(),
    audioIndex: buildAudioIndex(session.questionList),
  };

  const validation = validateSession(normalized);
  if (!validation.ok) {
    throw new Error(validation.errors.join(' '));
  }

  const sessions = await listSessions();
  const index = sessions.findIndex((item) => item.id === normalized.id);

  if (index >= 0) {
    sessions[index] = normalized;
  } else {
    sessions.unshift(normalized);
  }

  await writeJsonValue(SESSIONS_STORAGE_KEY, sessions);
  return normalized;
}

export async function deleteSession(sessionId: string): Promise<void> {
  const sessions = await listSessions();
  const filtered = sessions.filter((item) => item.id !== sessionId);

  if (filtered.length === 0) {
    await removeJsonValue(SESSIONS_STORAGE_KEY);
    return;
  }

  await writeJsonValue(SESSIONS_STORAGE_KEY, filtered);
}

export async function listSessionAudioFiles(sessionId: string): Promise<string[]> {
  const session = await getSessionById(sessionId);
  if (!session) {
    return [];
  }

  return session.audioIndex.map((item) => item.uri);
}

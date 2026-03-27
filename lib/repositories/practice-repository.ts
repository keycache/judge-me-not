import { Answer, buildQuestionValueKey } from '@/lib/domain/interview-models';
import { Session } from '@/lib/domain/session-models';
import { evaluateInterviewAnswer } from '@/lib/genai';
import { getSessionById, saveSession } from '@/lib/repositories/session-repository';
import { getAppSettings } from '@/lib/repositories/settings-repository';
import { readJsonValue, writeJsonValue } from '@/lib/storage/json-storage';

const PENDING_EVALS_STORAGE_KEY = 'judge-me-not.pending-evals.json';

export interface PendingEvaluationItem {
  sessionId: string;
  questionValueKey: string;
  answerTimestamp: string;
  queuedAtIso: string;
}

function findQuestion(session: Session, questionValueKey: string) {
  return session.questionList.questions.find((item) => buildQuestionValueKey(item) === questionValueKey) ?? null;
}

function findAnswer(session: Session, questionValueKey: string, answerTimestamp: string): Answer | null {
  const question = findQuestion(session, questionValueKey);
  if (!question || !question.answers) {
    return null;
  }

  return question.answers.find((item) => item.timestamp === answerTimestamp) ?? null;
}

export async function appendAttempt(input: {
  sessionId: string;
  questionValueKey: string;
  transcript: string;
  audioFilePath: string;
}): Promise<Answer> {
  const session = await getSessionById(input.sessionId);
  if (!session) {
    throw new Error('Session not found.');
  }

  const question = findQuestion(session, input.questionValueKey);
  if (!question) {
    throw new Error('Question not found for session.');
  }

  const timestamp = new Date().toISOString();
  const attempt: Answer = {
    audio_file_path: input.audioFilePath,
    timestamp,
  };

  question.answers = question.answers ?? [];
  question.answers.push(attempt);
  await saveSession(session);
  return attempt;
}

export async function listAttempts(sessionId: string, questionValueKey: string): Promise<Answer[]> {
  const session = await getSessionById(sessionId);
  if (!session) {
    return [];
  }

  const question = findQuestion(session, questionValueKey);
  return question && question.answers ? [...question.answers].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)) : [];
}

export async function deleteAttempt(input: {
  sessionId: string;
  questionValueKey: string;
  answerTimestamp: string;
}): Promise<boolean> {
  const session = await getSessionById(input.sessionId);
  if (!session) {
    return false;
  }

  const question = findQuestion(session, input.questionValueKey);
  if (!question || !question.answers) {
    return false;
  }

  const beforeCount = question.answers.length;
  question.answers = question.answers.filter((item) => item.timestamp !== input.answerTimestamp);
  const wasDeleted = question.answers.length < beforeCount;

  if (!wasDeleted) {
    return false;
  }

  await saveSession(session);

  const queue = await getPendingQueue();
  const nextQueue = queue.filter(
    (item) =>
      !(
        item.sessionId === input.sessionId &&
        item.questionValueKey === input.questionValueKey &&
        item.answerTimestamp === input.answerTimestamp
      )
  );

  if (nextQueue.length !== queue.length) {
    await savePendingQueue(nextQueue);
  }

  return true;
}

async function getPendingQueue(): Promise<PendingEvaluationItem[]> {
  return readJsonValue<PendingEvaluationItem[]>(PENDING_EVALS_STORAGE_KEY, []);
}

async function savePendingQueue(items: PendingEvaluationItem[]): Promise<void> {
  await writeJsonValue(PENDING_EVALS_STORAGE_KEY, items);
}

export async function listPendingEvaluations(): Promise<PendingEvaluationItem[]> {
  return getPendingQueue();
}

export async function submitAttemptForEvaluation(input: {
  sessionId: string;
  questionValueKey: string;
  answerTimestamp: string;
  transcript: string;
  isOnline: boolean;
}): Promise<'pending' | 'completed'> {
  const session = await getSessionById(input.sessionId);
  if (!session) {
    throw new Error('Session not found.');
  }

  const answer = findAnswer(session, input.questionValueKey, input.answerTimestamp);
  if (!answer) {
    throw new Error('Attempt not found.');
  }

  if (!input.isOnline) {
    await saveSession(session);

    const queue = await getPendingQueue();
    const alreadyQueued = queue.some(
      (item) =>
        item.sessionId === input.sessionId &&
        item.questionValueKey === input.questionValueKey &&
        item.answerTimestamp === input.answerTimestamp
    );

    if (!alreadyQueued) {
      queue.push({
        sessionId: input.sessionId,
        questionValueKey: input.questionValueKey,
        answerTimestamp: input.answerTimestamp,
        queuedAtIso: new Date().toISOString(),
      });
      await savePendingQueue(queue);
    }

    return 'pending';
  }

  const question = findQuestion(session, input.questionValueKey);
  if (!question) {
    throw new Error('Question not found for evaluation.');
  }

  try {
    const appSettings = await getAppSettings();
    answer.evaluation = await evaluateInterviewAnswer({
      question: question.value,
      idealAnswer: question.answer,
      audioFilePath: answer.audio_file_path,
      promptSettings: appSettings.promptSettings,
    });
    await saveSession(session);
    return 'completed';
  } catch {
    const queue = await getPendingQueue();
    const alreadyQueued = queue.some(
      (item) =>
        item.sessionId === input.sessionId &&
        item.questionValueKey === input.questionValueKey &&
        item.answerTimestamp === input.answerTimestamp
    );

    if (!alreadyQueued) {
      queue.push({
        sessionId: input.sessionId,
        questionValueKey: input.questionValueKey,
        answerTimestamp: input.answerTimestamp,
        queuedAtIso: new Date().toISOString(),
      });
      await savePendingQueue(queue);
    }

    await saveSession(session);
    return 'pending';
  }
}

export async function processPendingEvaluations(isOnline: boolean): Promise<number> {
  if (!isOnline) {
    return 0;
  }

  const queue = await getPendingQueue();
  if (queue.length === 0) {
    return 0;
  }

  const remaining: PendingEvaluationItem[] = [];
  let processed = 0;

  for (const item of queue) {
    const session = await getSessionById(item.sessionId);
    if (!session) {
      continue;
    }

    const answer = findAnswer(session, item.questionValueKey, item.answerTimestamp);
    if (!answer) {
      continue;
    }

    if (answer.evaluation) {
      continue;
    }

    try {
      const question = findQuestion(session, item.questionValueKey);
      if (!question) {
        continue;
      }

      const appSettings = await getAppSettings();
      answer.evaluation = await evaluateInterviewAnswer({
        question: question.value,
        idealAnswer: question.answer,
        audioFilePath: answer.audio_file_path,
        promptSettings: appSettings.promptSettings,
      });
      await saveSession(session);
      processed += 1;
    } catch {
      remaining.push(item);
    }
  }

  await savePendingQueue(remaining);
  return processed;
}
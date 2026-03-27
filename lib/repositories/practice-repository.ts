import { Answer } from '@/lib/domain/interview-models';
import { Session } from '@/lib/domain/session-models';
import { evaluateTranscript } from '@/lib/practice-engine';
import { getSessionById, saveSession } from '@/lib/repositories/session-repository';
import { readJsonValue, writeJsonValue } from '@/lib/storage/json-storage';

const PENDING_EVALS_STORAGE_KEY = 'judge-me-not.pending-evals.json';

interface PendingEvaluationItem {
  sessionId: string;
  questionId: string;
  answerId: string;
  queuedAtIso: string;
}

function findAnswer(session: Session, questionId: string, answerId: string): Answer | null {
  const question = session.questionList.questions.find((item) => item.id === questionId);
  if (!question) {
    return null;
  }

  return question.answers.find((item) => item.id === answerId) ?? null;
}

function createAnswerId(questionId: string): string {
  return `ans-${questionId}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export async function appendAttempt(input: {
  sessionId: string;
  questionId: string;
  transcript: string;
  audioFileUri: string;
  durationSeconds: number;
}): Promise<Answer> {
  const session = await getSessionById(input.sessionId);
  if (!session) {
    throw new Error('Session not found.');
  }

  const question = session.questionList.questions.find((item) => item.id === input.questionId);
  if (!question) {
    throw new Error('Question not found for session.');
  }

  const attempt: Answer = {
    id: createAnswerId(input.questionId),
    questionId: input.questionId,
    transcript: input.transcript,
    audioFileUri: input.audioFileUri,
    createdAtIso: new Date().toISOString(),
    evaluation: null,
    evaluationStatus: 'draft',
    submittedAtIso: null,
    durationSeconds: input.durationSeconds,
  };

  question.answers.push(attempt);
  await saveSession(session);
  return attempt;
}

export async function listAttempts(sessionId: string, questionId: string): Promise<Answer[]> {
  const session = await getSessionById(sessionId);
  if (!session) {
    return [];
  }

  const question = session.questionList.questions.find((item) => item.id === questionId);
  return question ? [...question.answers].sort((a, b) => (a.createdAtIso < b.createdAtIso ? 1 : -1)) : [];
}

export async function deleteAttempt(input: {
  sessionId: string;
  questionId: string;
  answerId: string;
}): Promise<boolean> {
  const session = await getSessionById(input.sessionId);
  if (!session) {
    return false;
  }

  const question = session.questionList.questions.find((item) => item.id === input.questionId);
  if (!question) {
    return false;
  }

  const beforeCount = question.answers.length;
  question.answers = question.answers.filter((item) => item.id !== input.answerId);
  const wasDeleted = question.answers.length < beforeCount;

  if (!wasDeleted) {
    return false;
  }

  await saveSession(session);

  const queue = await getPendingQueue();
  const nextQueue = queue.filter(
    (item) =>
      !(item.sessionId === input.sessionId && item.questionId === input.questionId && item.answerId === input.answerId)
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
  questionId: string;
  answerId: string;
  isOnline: boolean;
}): Promise<'pending' | 'completed'> {
  const session = await getSessionById(input.sessionId);
  if (!session) {
    throw new Error('Session not found.');
  }

  const answer = findAnswer(session, input.questionId, input.answerId);
  if (!answer) {
    throw new Error('Attempt not found.');
  }

  answer.submittedAtIso = new Date().toISOString();

  if (!input.isOnline) {
    answer.evaluationStatus = 'pending';
    await saveSession(session);

    const queue = await getPendingQueue();
    queue.push({
      sessionId: input.sessionId,
      questionId: input.questionId,
      answerId: input.answerId,
      queuedAtIso: new Date().toISOString(),
    });
    await savePendingQueue(queue);
    return 'pending';
  }

  answer.evaluation = evaluateTranscript(answer.transcript);
  answer.evaluationStatus = 'completed';
  await saveSession(session);
  return 'completed';
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

    const answer = findAnswer(session, item.questionId, item.answerId);
    if (!answer) {
      continue;
    }

    if (answer.evaluationStatus !== 'pending') {
      continue;
    }

    try {
      answer.evaluation = evaluateTranscript(answer.transcript);
      answer.evaluationStatus = 'completed';
      await saveSession(session);
      processed += 1;
    } catch {
      remaining.push(item);
    }
  }

  await savePendingQueue(remaining);
  return processed;
}

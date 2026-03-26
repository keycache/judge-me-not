import { Answer, Difficulty, Evaluation, Question, QuestionList } from '@/lib/domain/interview-models';
import { EVALUATION_STRICTNESS_LEVELS, MODEL_VARIANTS, Session } from '@/lib/domain/session-models';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

function isIsoDate(input: string): boolean {
  return !Number.isNaN(Date.parse(input));
}

export function isDifficulty(input: string): input is Difficulty {
  return input === 'Easy' || input === 'Medium' || input === 'Hard';
}

export function validateEvaluation(evaluation: Evaluation): ValidationResult {
  const errors: string[] = [];

  if (evaluation.scoreOutOfTen < 0 || evaluation.scoreOutOfTen > 10) {
    errors.push('Evaluation score must be in range 0..10.');
  }

  if (!isIsoDate(evaluation.evaluatedAtIso)) {
    errors.push('Evaluation timestamp must be a valid ISO date string.');
  }

  if (evaluation.summary.trim().length === 0) {
    errors.push('Evaluation summary cannot be empty.');
  }

  return { ok: errors.length === 0, errors };
}

export function validateAnswer(answer: Answer): ValidationResult {
  const errors: string[] = [];

  if (answer.id.trim().length === 0) {
    errors.push('Answer id is required.');
  }

  if (answer.questionId.trim().length === 0) {
    errors.push('Answer questionId is required.');
  }

  if (answer.transcript.trim().length === 0) {
    errors.push('Answer transcript is required.');
  }

  if (!isIsoDate(answer.createdAtIso)) {
    errors.push('Answer createdAtIso must be a valid ISO date string.');
  }

  if (answer.evaluation) {
    const evaluationResult = validateEvaluation(answer.evaluation);
    errors.push(...evaluationResult.errors);
  }

  return { ok: errors.length === 0, errors };
}

export function validateQuestion(question: Question): ValidationResult {
  const errors: string[] = [];

  if (question.id.trim().length === 0) {
    errors.push('Question id is required.');
  }

  if (question.prompt.trim().length === 0) {
    errors.push('Question prompt is required.');
  }

  if (!isDifficulty(question.difficulty)) {
    errors.push('Question difficulty must be Easy, Medium, or Hard.');
  }

  for (const answer of question.answers) {
    const answerResult = validateAnswer(answer);
    errors.push(...answerResult.errors);
  }

  return { ok: errors.length === 0, errors };
}

export function validateQuestionList(questionList: QuestionList): ValidationResult {
  const errors: string[] = [];

  if (questionList.id.trim().length === 0) {
    errors.push('QuestionList id is required.');
  }

  if (questionList.title.trim().length === 0) {
    errors.push('QuestionList title is required.');
  }

  if (questionList.roleDescription.trim().length === 0) {
    errors.push('QuestionList roleDescription is required.');
  }

  if (!isIsoDate(questionList.createdAtIso)) {
    errors.push('QuestionList createdAtIso must be a valid ISO date string.');
  }

  if (questionList.questions.length === 0) {
    errors.push('QuestionList must contain at least one question.');
  }

  for (const question of questionList.questions) {
    const questionResult = validateQuestion(question);
    errors.push(...questionResult.errors);
  }

  return { ok: errors.length === 0, errors };
}

export function validateSession(session: Session): ValidationResult {
  const errors: string[] = [];

  if (session.id.trim().length === 0) {
    errors.push('Session id is required.');
  }

  if (session.title.trim().length === 0) {
    errors.push('Session title is required.');
  }

  if (!isIsoDate(session.createdAtIso) || !isIsoDate(session.updatedAtIso)) {
    errors.push('Session createdAtIso and updatedAtIso must be valid ISO date strings.');
  }

  const questionListResult = validateQuestionList(session.questionList);
  errors.push(...questionListResult.errors);

  if (session.promptSnapshot) {
    if (!MODEL_VARIANTS.includes(session.promptSnapshot.modelVariant)) {
      errors.push('Session prompt snapshot model variant is invalid.');
    }

    if (!EVALUATION_STRICTNESS_LEVELS.includes(session.promptSnapshot.evaluationStrictness)) {
      errors.push('Session prompt snapshot strictness is invalid.');
    }

    if (session.promptSnapshot.systemPersona.trim().length === 0) {
      errors.push('Session prompt snapshot persona cannot be empty.');
    }

    if (session.promptSnapshot.resolvedPrompt.trim().length === 0) {
      errors.push('Session prompt snapshot resolved prompt cannot be empty.');
    }
  }

  return { ok: errors.length === 0, errors };
}

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

  if (evaluation.score < 0 || evaluation.score > 10) {
    errors.push('Evaluation score must be in range 0..10.');
  }

  if (evaluation.candidate_answer.trim().length === 0) {
    errors.push('Evaluation candidate_answer is required.');
  }

  if (evaluation.feedback.trim().length === 0) {
    errors.push('Evaluation feedback is required.');
  }

  if (!Array.isArray(evaluation.gaps_identified)) {
    errors.push('Evaluation gaps_identified must be an array.');
  }

  if (evaluation.model_answer.trim().length === 0) {
    errors.push('Evaluation model_answer is required.');
  }

  return { ok: errors.length === 0, errors };
}

export function validateAnswer(answer: Answer): ValidationResult {
  const errors: string[] = [];

  if (answer.audio_file_path.trim().length === 0) {
    errors.push('Answer audio_file_path is required.');
  }

  if (!isIsoDate(answer.timestamp)) {
    errors.push('Answer timestamp must be a valid ISO date string.');
  }

  if (typeof answer.evaluation !== 'undefined') {
    const evaluationResult = validateEvaluation(answer.evaluation);
    errors.push(...evaluationResult.errors);
  }

  return { ok: errors.length === 0, errors };
}

export function validateQuestion(question: Question): ValidationResult {
  const errors: string[] = [];

  if (question.value.trim().length === 0) {
    errors.push('Question value is required.');
  }

  if (question.category.trim().length === 0) {
    errors.push('Question category is required.');
  }

  if (!isDifficulty(question.difficulty)) {
    errors.push('Question difficulty must be Easy, Medium, or Hard.');
  }

  if (question.answer.trim().length === 0) {
    errors.push('Question answer is required.');
  }

  if (typeof question.answers !== 'undefined') {
    for (const answer of question.answers) {
      const answerResult = validateAnswer(answer);
      errors.push(...answerResult.errors);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function validateQuestionList(questionList: QuestionList): ValidationResult {
  const errors: string[] = [];

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

import type { Content, GenerateContentParameters, Part } from '@google/genai';
import { GoogleGenAI } from '@google/genai';

import { Evaluation, QuestionList } from '@/lib/domain/interview-models';
import { PromptSettings } from '@/lib/domain/session-models';
import { validateEvaluation, validateQuestionList } from '@/lib/domain/validators';
import { buildEvaluatorSystemPrompt, mapModelVariantToBackendModel } from '@/lib/prompt-template';
import { MAX_SESSION_TITLE_CHARS } from '@/lib/session-title';

export interface UploadedFileReference {
  uri: string;
  mimeType: string;
}

export interface QuestionGenerationInput {
  roleDescription: string;
  inputMode: 'text' | 'image';
  selectedDifficulties: string[];
  questionCountPerDifficulty: number;
  promptSettings: PromptSettings;
  uploadedImages?: UploadedFileReference[];
}

export interface QuestionGenerationResult {
  proposedSessionName?: string;
  questionList: QuestionList;
}

export interface EvaluationInput {
  question: string;
  idealAnswer: string;
  promptSettings: PromptSettings;
  uploadedAudio?: UploadedFileReference;
}

const QUESTION_LIST_SCHEMA_REQUIREMENT = {
  proposed_session_name: 'string',
  questions: [
    {
      value: 'string',
      category: 'string',
      difficulty: 'Easy | Medium | Hard',
      answer: 'string',
      answers: 'optional Answer[]',
    },
  ],
};

function getQuestionListSchemaJson(): string {
  return JSON.stringify(QUESTION_LIST_SCHEMA_REQUIREMENT, null, 2);
}

function stripMarkdownCodeFence(input: string): string {
  const trimmed = input.trim();

  if (!trimmed.startsWith('```')) {
    return trimmed;
  }

  return trimmed.replace(/^```[a-zA-Z0-9_-]*\s*/, '').replace(/```$/, '').trim();
}

function parseJsonPayload(input: string): unknown {
  try {
    return JSON.parse(stripMarkdownCodeFence(input));
  } catch {
    throw new Error('Model response was not valid JSON.');
  }
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === 'object' && !Array.isArray(input);
}

function toStringArray(input: unknown): string[] | undefined {
  if (typeof input === 'undefined') {
    return undefined;
  }

  if (!Array.isArray(input) || input.some((item) => typeof item !== 'string')) {
    throw new Error('Expected a string array in model response.');
  }

  return input;
}

function coerceQuestionList(input: unknown): QuestionList {
  if (!isRecord(input) || !Array.isArray(input.questions)) {
    throw new Error('Question generation response must contain a questions array.');
  }

  const questionList: QuestionList = {
    questions: input.questions.map((question) => {
      if (!isRecord(question)) {
        throw new Error('Each generated question must be an object.');
      }

      return {
        value: String(question.value ?? ''),
        category: String(question.category ?? ''),
        difficulty: String(question.difficulty ?? '') as 'Easy' | 'Medium' | 'Hard',
        answer: String(question.answer ?? ''),
        answers: typeof question.answers === 'undefined' ? undefined : [],
      };
    }),
  };

  const validation = validateQuestionList(questionList);
  if (!validation.ok) {
    throw new Error(validation.errors.join(' '));
  }

  return questionList;
}

function coerceQuestionGenerationResult(input: unknown): QuestionGenerationResult {
  if (!isRecord(input)) {
    throw new Error('Question generation response must be an object.');
  }

  const questionList = coerceQuestionList(input);
  const proposedSessionNameRaw = typeof input.proposed_session_name === 'string' ? input.proposed_session_name.trim() : '';

  return {
    proposedSessionName: proposedSessionNameRaw.length > 0 ? proposedSessionNameRaw : undefined,
    questionList,
  };
}

function coerceEvaluation(input: unknown): Evaluation {
  if (!isRecord(input)) {
    throw new Error('Evaluation response must be an object.');
  }

  const evaluation: Evaluation = {
    score: Number(input.score),
    candidate_answer: String(input.candidate_answer ?? ''),
    feedback: String(input.feedback ?? ''),
    gaps_identified: toStringArray(input.gaps_identified) ?? [],
    model_answer: String(input.model_answer ?? ''),
  };

  const validation = validateEvaluation(evaluation);
  if (!validation.ok) {
    throw new Error(validation.errors.join(' '));
  }

  return evaluation;
}

function inferMimeTypeFromUri(uri: string): string {
  const normalized = uri.toLowerCase();

  if (normalized.endsWith('.png')) {
    return 'image/png';
  }
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (normalized.endsWith('.webp')) {
    return 'image/webp';
  }
  if (normalized.endsWith('.heic')) {
    return 'image/heic';
  }
  if (normalized.endsWith('.m4a')) {
    return 'audio/mp4';
  }
  if (normalized.endsWith('.wav')) {
    return 'audio/wav';
  }
  if (normalized.endsWith('.mp3')) {
    return 'audio/mpeg';
  }

  return 'application/octet-stream';
}

async function getGenAIClient(): Promise<GoogleGenAI> {
  const [{ hasValidApiKey }, { getApiKey }] = await Promise.all([import('@/lib/api-key'), import('@/lib/settings-store')]);
  const apiKey = await getApiKey();
  if (!hasValidApiKey(apiKey)) {
    throw new Error('Gemini API key is not configured.');
  }

  return new GoogleGenAI({ apiKey: apiKey ?? undefined });
}

async function uploadUri(ai: GoogleGenAI, uri: string, mimeType?: string): Promise<UploadedFileReference> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(`Failed to read local file for upload: ${uri}`);
  }

  const blob = await response.blob();
  const resolvedMimeType = mimeType ?? inferMimeTypeFromUri(uri);
  const uploaded = await ai.files.upload({
    file: blob,
    config: {
      mimeType: resolvedMimeType,
      displayName: uri.split('/').pop(),
    },
  });

  if (!uploaded.uri) {
    throw new Error('Uploaded file did not return a URI.');
  }

  return {
    uri: uploaded.uri,
    mimeType: uploaded.mimeType ?? resolvedMimeType,
  };
}

function buildQuestionGenerationPrompt(input: QuestionGenerationInput): string {
  const sourceContext =
    input.inputMode === 'text'
      ? `Role context:\n${input.roleDescription}`
      : 'Use the uploaded images as the primary role/interview context.';

  return [
    'Generate interview questions and return JSON only.',
    sourceContext,
    `Difficulties: ${input.selectedDifficulties.join(', ')}`,
    `Questions per difficulty: ${input.questionCountPerDifficulty}`,
    `Also propose a concise, user-friendly session title in proposed_session_name (max ${MAX_SESSION_TITLE_CHARS} chars, no timestamp).`,
    'Each question must include value, category, difficulty, and answer.',
    '[QUESTION_LIST_SCHEMA_JSON]',
    getQuestionListSchemaJson(),
  ].join('\n');
}

export function buildQuestionGenerationRequest(input: QuestionGenerationInput): GenerateContentParameters {
  const parts: Part[] = [{ text: buildQuestionGenerationPrompt(input) }];

  for (const image of input.uploadedImages ?? []) {
    parts.push({
      fileData: {
        fileUri: image.uri,
        mimeType: image.mimeType,
      },
    });
  }

  return {
    model: mapModelVariantToBackendModel(input.promptSettings.modelVariant),
    config: {
      responseMimeType: 'application/json',
    },
    contents: [{ role: 'user', parts } satisfies Content],
  };
}

export function buildEvaluationRequest(input: EvaluationInput): GenerateContentParameters {
  const parts: Part[] = [
    {
      text: [
        buildEvaluatorSystemPrompt({
          strictness: input.promptSettings.evaluationStrictness,
          profilePromptText: input.promptSettings.systemPersona,
        }),
        '[QUESTION]',
        input.question,
        '[IDEAL_ANSWER]',
        input.idealAnswer,
        'Evaluate the attached audio answer and return JSON only.',
      ].join('\n'),
    },
  ];

  if (input.uploadedAudio) {
    parts.push({
      fileData: {
        fileUri: input.uploadedAudio.uri,
        mimeType: input.uploadedAudio.mimeType,
      },
    });
  }

  return {
    model: mapModelVariantToBackendModel(input.promptSettings.modelVariant),
    config: {
      responseMimeType: 'application/json',
    },
    contents: [{ role: 'user', parts } satisfies Content],
  };
}

export function parseQuestionListResponse(text: string): QuestionList {
  return coerceQuestionGenerationResult(parseJsonPayload(text)).questionList;
}

export function parseQuestionGenerationResponse(text: string): QuestionGenerationResult {
  return coerceQuestionGenerationResult(parseJsonPayload(text));
}

export function parseEvaluationResponse(text: string): Evaluation {
  return coerceEvaluation(parseJsonPayload(text));
}

export async function generateInterviewQuestions(
  input: Omit<QuestionGenerationInput, 'uploadedImages'> & { imageUris?: string[] }
): Promise<QuestionGenerationResult> {
  const ai = await getGenAIClient();
  const uploadedImages =
    input.inputMode === 'image'
      ? await Promise.all((input.imageUris ?? []).map((uri) => uploadUri(ai, uri)))
      : [];

  const response = await ai.models.generateContent(buildQuestionGenerationRequest({
    ...input,
    uploadedImages,
  }));

  if (!response.text) {
    throw new Error('Question generation returned an empty response.');
  }

  return parseQuestionGenerationResponse(response.text);
}

export async function evaluateInterviewAnswer(input: {
  question: string;
  idealAnswer: string;
  audioFilePath: string;
  promptSettings: PromptSettings;
}): Promise<Evaluation> {
  const ai = await getGenAIClient();
  const uploadedAudio = await uploadUri(ai, input.audioFilePath);

  const response = await ai.models.generateContent(
    buildEvaluationRequest({
      question: input.question,
      idealAnswer: input.idealAnswer,
      promptSettings: input.promptSettings,
      uploadedAudio,
    })
  );

  if (!response.text) {
    throw new Error('Evaluation returned an empty response.');
  }

  return parseEvaluationResponse(response.text);
}
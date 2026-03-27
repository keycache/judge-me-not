import {
  EvaluationStrictness,
  ModelVariant,
  PromptSettings,
  SessionPromptSnapshot,
} from '@/lib/domain/session-models';
import { Difficulty, InputMode } from '@/lib/interview-rules';

const MODEL_VARIANT_MAP: Record<ModelVariant, string> = {
  'gemini-2.5-flash-lite-preview': 'gemini-2.5-flash-lite-preview',
  'gemini-3.1-flash-lite-preview': 'gemini-3.1-flash-lite-preview',
};

const STRICTNESS_INSTRUCTION_MAP: Record<EvaluationStrictness, string> = {
  lenient: 'Focus on confidence building and highlight what worked before criticizing gaps.',
  balanced: 'Balance strengths and improvement points with clear, practical coaching.',
  strict: 'Use a high hiring-bar lens and call out weak reasoning, clarity, and structure directly.',
};

const EVALUATION_SCHEMA_REQUIREMENT = {
  score: 'number (0..10)',
  candidate_answer: 'string',
  feedback: 'string',
  gaps_identified: 'string[]',
  model_answer: 'string',
};

const EVALUATOR_CORE_INSTRUCTIONS = [
  'You are an interview evaluator. Return JSON only.',
  'Evaluate against clarity, completeness, correctness, and communication quality.',
  'Keep feedback concise, specific, and actionable.',
].join('\n');

function normalizePersona(persona: string): string {
  const trimmed = persona.trim();
  return trimmed.length > 0 ? trimmed : 'Direct and constructive interview coach';
}

export function mapModelVariantToBackendModel(modelVariant: ModelVariant): string {
  return MODEL_VARIANT_MAP[modelVariant];
}

export function mapStrictnessToInstruction(strictness: EvaluationStrictness): string {
  return STRICTNESS_INSTRUCTION_MAP[strictness];
}

export function getEvaluationSchemaJson(): string {
  return JSON.stringify(EVALUATION_SCHEMA_REQUIREMENT, null, 2);
}

export function buildEvaluatorSystemPrompt(input: {
  strictness: EvaluationStrictness;
  profilePromptText: string;
}): string {
  const strictnessInstruction = mapStrictnessToInstruction(input.strictness);
  const profilePromptText = input.profilePromptText.trim();

  const blocks = [
    '[CORE]',
    EVALUATOR_CORE_INSTRUCTIONS,
    '[STRICTNESS]',
    strictnessInstruction,
    '[SCHEMA_JSON]',
    getEvaluationSchemaJson(),
  ];

  if (profilePromptText.length > 0) {
    blocks.push('[PROFILE_APPEND]');
    blocks.push(profilePromptText);
  }

  return blocks.join('\n');
}

export function resolvePromptTemplate(input: {
  roleDescription: string;
  inputMode: InputMode;
  selectedDifficulties: Difficulty[];
  questionCountPerDifficulty: number;
  promptSettings: PromptSettings;
}): string {
  const persona = normalizePersona(input.promptSettings.systemPersona);
  const strictnessInstruction = mapStrictnessToInstruction(input.promptSettings.evaluationStrictness);
  const model = mapModelVariantToBackendModel(input.promptSettings.modelVariant);
  const difficulties = input.selectedDifficulties.join(', ');
  const evaluatorPrompt = buildEvaluatorSystemPrompt({
    strictness: input.promptSettings.evaluationStrictness,
    profilePromptText: input.promptSettings.systemPersona,
  });

  return [
    `Model Variant: ${model}`,
    `Persona: ${persona}`,
    `Input Mode: ${input.inputMode}`,
    `Difficulties: ${difficulties}`,
    `Questions Per Difficulty: ${input.questionCountPerDifficulty}`,
    `Role Context: ${input.roleDescription}`,
    `Evaluation Strictness Guidance: ${strictnessInstruction}`,
    'Evaluator Prompt:',
    evaluatorPrompt,
    'Output Requirement: Generate interview questions grouped by difficulty with concise rationale.',
  ].join('\n');
}

export function buildSessionPromptSnapshot(input: {
  roleDescription: string;
  inputMode: InputMode;
  selectedDifficulties: Difficulty[];
  questionCountPerDifficulty: number;
  promptSettings: PromptSettings;
}): SessionPromptSnapshot {
  const normalizedSettings: PromptSettings = {
    ...input.promptSettings,
    systemPersona: normalizePersona(input.promptSettings.systemPersona),
  };

  return {
    ...normalizedSettings,
    resolvedPrompt: resolvePromptTemplate({
      ...input,
      promptSettings: normalizedSettings,
    }),
  };
}

import {
    EvaluationStrictness,
    ModelVariant,
    PromptSettings,
    SessionPromptSnapshot,
} from '@/lib/domain/session-models';
import { Difficulty, InputMode } from '@/lib/interview-rules';

const MODEL_VARIANT_MAP: Record<ModelVariant, string> = {
  'gpt-4.1-mini': 'gpt-4.1-mini',
  'gpt-4.1': 'gpt-4.1',
  'gpt-4o-mini': 'gpt-4o-mini',
};

const STRICTNESS_INSTRUCTION_MAP: Record<EvaluationStrictness, string> = {
  lenient: 'Focus on confidence building and highlight what worked before criticizing gaps.',
  balanced: 'Balance strengths and improvement points with clear, practical coaching.',
  strict: 'Use a high hiring-bar lens and call out weak reasoning, clarity, and structure directly.',
};

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

  return [
    `Model Variant: ${model}`,
    `Persona: ${persona}`,
    `Input Mode: ${input.inputMode}`,
    `Difficulties: ${difficulties}`,
    `Questions Per Difficulty: ${input.questionCountPerDifficulty}`,
    `Role Context: ${input.roleDescription}`,
    `Evaluation Strictness Guidance: ${strictnessInstruction}`,
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

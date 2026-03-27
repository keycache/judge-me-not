import {
    buildEvaluatorSystemPrompt,
    buildSessionPromptSnapshot,
    getEvaluationSchemaJson,
    mapModelVariantToBackendModel,
    mapStrictnessToInstruction,
    resolvePromptTemplate,
} from '@/lib/prompt-template';

describe('prompt template', () => {
  it('interpolates prompt values into resolved template', () => {
    const resolved = resolvePromptTemplate({
      roleDescription: 'Senior mobile architect role',
      inputMode: 'text',
      selectedDifficulties: ['Easy', 'Hard'],
      questionCountPerDifficulty: 12,
      promptSettings: {
        modelVariant: 'gpt-4.1-mini',
        evaluationStrictness: 'strict',
        systemPersona: 'Tough but fair interviewer',
      },
    });

    expect(resolved).toMatch(/Senior mobile architect role/);
    expect(resolved).toMatch(/Input Mode: text/);
    expect(resolved).toMatch(/Difficulties: Easy, Hard/);
    expect(resolved).toMatch(/Questions Per Difficulty: 12/);
    expect(resolved).toMatch(/Tough but fair interviewer/);
  });

  it('maps model variants and strictness values deterministically', () => {
    expect(mapModelVariantToBackendModel('gpt-4.1-mini')).toBe('gpt-4.1-mini');
    expect(mapModelVariantToBackendModel('gpt-4.1')).toBe('gpt-4.1');
    expect(mapStrictnessToInstruction('lenient')).toMatch(/confidence/i);
    expect(mapStrictnessToInstruction('balanced')).toMatch(/balance/i);
    expect(mapStrictnessToInstruction('strict')).toMatch(/high hiring-bar/i);
  });

  it('builds prompt snapshot with normalized persona fallback', () => {
    const snapshot = buildSessionPromptSnapshot({
      roleDescription: 'Backend + mobile hybrid role',
      inputMode: 'image',
      selectedDifficulties: ['Medium'],
      questionCountPerDifficulty: 8,
      promptSettings: {
        modelVariant: 'gpt-4o-mini',
        evaluationStrictness: 'balanced',
        systemPersona: '   ',
      },
    });

    expect(snapshot.systemPersona).toBe('Direct and constructive interview coach');
    expect(snapshot.resolvedPrompt).toMatch(/Input Mode: image/);
  });

  it('builds evaluator prompt with core, strictness, schema, and profile append blocks', () => {
    const prompt = buildEvaluatorSystemPrompt({
      strictness: 'strict',
      profilePromptText: 'Prefer concise bullet feedback.',
    });

    expect(prompt).toMatch(/\[CORE\]/);
    expect(prompt).toMatch(/\[STRICTNESS\]/);
    expect(prompt).toMatch(/high hiring-bar/i);
    expect(prompt).toMatch(/\[SCHEMA_JSON\]/);
    expect(prompt).toMatch(/candidate_answer/);
    expect(prompt).toMatch(/\[PROFILE_APPEND\]/);
    expect(prompt).toMatch(/Prefer concise bullet feedback\./);
  });

  it('exposes deterministic schema json helper', () => {
    const schemaJson = getEvaluationSchemaJson();
    expect(schemaJson).toMatch(/score/);
    expect(schemaJson).toMatch(/gaps_identified/);
    expect(schemaJson).toMatch(/model_answer/);
  });
});

import {
    buildEvaluationRequest,
    buildQuestionGenerationRequest,
    parseEvaluationResponse,
    parseQuestionGenerationResponse,
    parseQuestionListResponse,
} from '../genai';

describe('genai helpers', () => {
  const promptSettings = {
    modelVariant: 'gemini-2.5-flash-lite-preview' as const,
    evaluationStrictness: 'balanced' as const,
    systemPersona: 'Coach',
  };

  it('builds expected text-mode question generation request', () => {
    const request = buildQuestionGenerationRequest({
      roleDescription: 'Senior backend engineer role.',
      inputMode: 'text',
      selectedDifficulties: ['Easy', 'Hard'],
      questionCountPerDifficulty: 2,
      promptSettings,
    });

    expect(request.model).toBe('gemini-2.5-flash-lite-preview');
    expect(request.config).toEqual({ responseMimeType: 'application/json' });
    expect(JSON.stringify(request.contents)).toContain('Senior backend engineer role.');
    expect(JSON.stringify(request.contents)).toContain('proposed_session_name');
    expect(JSON.stringify(request.contents)).not.toContain('fileUri');
  });

  it('builds expected image-mode question generation request', () => {
    const request = buildQuestionGenerationRequest({
      roleDescription: 'Image based role context',
      inputMode: 'image',
      selectedDifficulties: ['Medium'],
      questionCountPerDifficulty: 1,
      promptSettings,
      uploadedImages: [{ uri: 'gs://bucket/interview-image.png', mimeType: 'image/png' }],
    });

    expect(JSON.stringify(request.contents)).toContain('gs://bucket/interview-image.png');
    expect(JSON.stringify(request.contents)).toContain('image/png');
  });

  it('builds evaluation request with question, model answer, and audio file', () => {
    const request = buildEvaluationRequest({
      question: 'Tell me about a difficult launch.',
      idealAnswer: 'Discuss trade-offs, rollout, and impact.',
      promptSettings,
      uploadedAudio: { uri: 'gs://bucket/answer.m4a', mimeType: 'audio/mp4' },
    });

    expect(request.model).toBe('gemini-2.5-flash-lite-preview');
    expect(JSON.stringify(request.contents)).toContain('Tell me about a difficult launch.');
    expect(JSON.stringify(request.contents)).toContain('Discuss trade-offs, rollout, and impact.');
    expect(JSON.stringify(request.contents)).toContain('gs://bucket/answer.m4a');
  });

  it('rejects non-json model text', () => {
    expect(() => parseQuestionListResponse('not json')).toThrow(/valid json/i);
  });

  it('accepts schema-conformant question json', () => {
    const result = parseQuestionListResponse(JSON.stringify({
      proposed_session_name: 'Incident Response Loop',
      questions: [
        {
          value: 'How do you handle incident response?',
          category: 'Behavioral',
          difficulty: 'Medium',
          answer: 'Use STAR and discuss communication plus remediation.',
        },
      ],
    }));

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].difficulty).toBe('Medium');
  });

  it('parses proposed session title from generation json', () => {
    const result = parseQuestionGenerationResponse(JSON.stringify({
      proposed_session_name: 'Staff Platform Interview',
      questions: [
        {
          value: 'How do you handle incident response?',
          category: 'Behavioral',
          difficulty: 'Medium',
          answer: 'Use STAR and discuss communication plus remediation.',
        },
      ],
    }));

    expect(result.proposedSessionName).toBe('Staff Platform Interview');
    expect(result.questionList.questions).toHaveLength(1);
  });

  it('accepts schema-conformant evaluation json', () => {
    const result = parseEvaluationResponse(JSON.stringify({
      score: 8,
      candidate_answer: 'I led the response and stabilized the system.',
      feedback: 'Strong structure with clear ownership.',
      gaps_identified: ['Include more metrics'],
      model_answer: 'A strong answer should cover impact, trade-offs, and follow-up actions.',
    }));

    expect(result.score).toBe(8);
    expect(result.gaps_identified).toEqual(['Include more metrics']);
  });
});
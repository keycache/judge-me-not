import { QuestionList } from '@/lib/domain/interview-models';
import { validateQuestionList } from '@/lib/domain/validators';

function buildValidQuestionList(): QuestionList {
  return {
    questions: [
      {
        value: 'Explain React reconciliation.',
        category: 'Frontend Interview Basics',
        difficulty: 'Medium',
        answer: 'Compare tree diffing, keys, and render scheduling trade-offs.',
        answers: [
          {
            audio_file_path: 'file:///tmp/a1.m4a',
            timestamp: new Date('2026-03-26T10:05:00.000Z').toISOString(),
            evaluation: {
              score: 8,
              candidate_answer: 'React compares virtual DOM trees.',
              feedback: 'Good answer with room for depth.',
              gaps_identified: ['Add implementation detail'],
              model_answer: 'Explain diffing with keys and scheduling.',
            },
          },
        ],
      },
    ],
  };
}

describe('domain validators', () => {
  it('accepts a valid question list', () => {
    const result = validateQuestionList(buildValidQuestionList());
    expect(result.ok).toBe(true);
  });

  it('rejects invalid difficulty values', () => {
    const invalid = buildValidQuestionList();
    invalid.questions[0].difficulty = 'Impossible' as never;

    const result = validateQuestionList(invalid);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/difficulty/i);
  });

  it('rejects empty answer transcript', () => {
    const invalid = buildValidQuestionList();
    if (invalid.questions[0].answers) {
      invalid.questions[0].answers[0].audio_file_path = '  ';
    }

    const result = validateQuestionList(invalid);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/audio_file_path/i);
  });
});

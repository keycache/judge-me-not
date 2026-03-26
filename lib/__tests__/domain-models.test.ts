import { QuestionList } from '@/lib/domain/interview-models';
import { validateQuestionList } from '@/lib/domain/validators';

function buildValidQuestionList(): QuestionList {
  return {
    id: 'ql-1',
    title: 'Frontend Interview Basics',
    roleDescription: 'Senior React Native engineer role',
    createdAtIso: new Date('2026-03-26T10:00:00.000Z').toISOString(),
    questions: [
      {
        id: 'q-1',
        prompt: 'Explain React reconciliation.',
        difficulty: 'Medium',
        answers: [
          {
            id: 'a-1',
            questionId: 'q-1',
            transcript: 'React compares virtual DOM trees.',
            audioFileUri: 'file:///tmp/a1.m4a',
            createdAtIso: new Date('2026-03-26T10:05:00.000Z').toISOString(),
            evaluation: {
              scoreOutOfTen: 8,
              strengths: ['Clear structure'],
              improvements: ['Add implementation detail'],
              summary: 'Good answer with room for depth.',
              evaluatedAtIso: new Date('2026-03-26T10:06:00.000Z').toISOString(),
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
    invalid.questions[0].answers[0].transcript = '  ';

    const result = validateQuestionList(invalid);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/transcript/i);
  });
});

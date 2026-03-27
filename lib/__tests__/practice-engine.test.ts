import { enforceRecordingLimit, evaluateTranscript } from '@/lib/practice-engine';

describe('practice engine', () => {
  it('enforces recording cap boundaries', () => {
    expect(enforceRecordingLimit(30, 60)).toBe(true);
    expect(enforceRecordingLimit(60, 60)).toBe(true);
    expect(enforceRecordingLimit(61, 60)).toBe(false);
    expect(enforceRecordingLimit(0, 60)).toBe(false);
  });

  it('creates deterministic evaluation payload', () => {
    const evaluation = evaluateTranscript('I would optimize rendering using memoization and list virtualization.');

    expect(evaluation.score).toBeGreaterThan(0);
    expect(evaluation.score).toBeLessThanOrEqual(10);
    expect(evaluation.feedback.length).toBeGreaterThan(0);
    expect(Array.isArray(evaluation.gaps_identified)).toBe(true);
    expect(evaluation.candidate_answer.length).toBeGreaterThan(0);
  });
});

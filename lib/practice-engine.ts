import { Evaluation } from '@/lib/domain/interview-models';

export function enforceRecordingLimit(durationSeconds: number, limitSeconds: number): boolean {
  return durationSeconds > 0 && durationSeconds <= limitSeconds;
}

export function evaluateTranscript(transcript: string): Evaluation {
  const lengthScore = Math.min(10, Math.max(1, Math.round(transcript.trim().length / 24)));

  return {
    scoreOutOfTen: lengthScore,
    strengths: ['Clear response structure', 'Covered key talking points'],
    improvements: ['Add specific examples', 'Tighten final summary'],
    summary:
      lengthScore >= 7
        ? 'Strong response with clear communication and reasonable depth.'
        : 'Response is understandable but needs stronger depth and examples.',
    evaluatedAtIso: new Date().toISOString(),
  };
}

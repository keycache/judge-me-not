import { Evaluation } from '@/lib/domain/interview-models';

export function enforceRecordingLimit(durationSeconds: number, limitSeconds: number): boolean {
  return durationSeconds > 0 && durationSeconds <= limitSeconds;
}

export function evaluateTranscript(transcript: string): Evaluation {
  const lengthScore = Math.min(10, Math.max(1, Math.round(transcript.trim().length / 24)));

  return {
    score: lengthScore,
    candidate_answer: transcript,
    feedback:
      lengthScore >= 7
        ? 'Strong response with clear communication and reasonable depth. Add one concise impact metric to stand out.'
        : 'Response is understandable but needs stronger depth, concrete examples, and tighter structure.',
    gaps_identified: ['Add specific examples', 'Tighten final summary'],
    model_answer: 'A strong answer should explain the approach, trade-offs, metrics, and outcome in a concise STAR format.',
  };
}

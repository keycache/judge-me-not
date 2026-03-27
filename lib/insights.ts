import { Session } from '@/lib/domain/session-models';

export interface InsightsSummary {
  totalSessions: number;
  totalQuestions: number;
  totalAttempts: number;
  evaluatedAttempts: number;
  readinessPercent: number;
  averageScore: number;
  strongestCategory: string | null;
  topGap: string | null;
}

export function buildInsightsSummary(sessions: Session[]): InsightsSummary {
  let totalQuestions = 0;
  let totalAttempts = 0;
  let evaluatedAttempts = 0;
  let totalScore = 0;
  const categoryScores = new Map<string, { total: number; count: number }>();
  const gapCounts = new Map<string, number>();

  for (const session of sessions) {
    totalQuestions += session.questionList.questions.length;

    for (const question of session.questionList.questions) {
      const answers = question.answers ?? [];
      totalAttempts += answers.length;

      for (const answer of answers) {
        if (!answer.evaluation) {
          continue;
        }

        evaluatedAttempts += 1;
        totalScore += answer.evaluation.score;

        const currentCategory = categoryScores.get(question.category) ?? { total: 0, count: 0 };
        currentCategory.total += answer.evaluation.score;
        currentCategory.count += 1;
        categoryScores.set(question.category, currentCategory);

        for (const gap of answer.evaluation.gaps_identified) {
          const normalizedGap = gap.trim();
          if (!normalizedGap) {
            continue;
          }

          gapCounts.set(normalizedGap, (gapCounts.get(normalizedGap) ?? 0) + 1);
        }
      }
    }
  }

  const averageScore = evaluatedAttempts > 0 ? totalScore / evaluatedAttempts : 0;

  let strongestCategory: string | null = null;
  let strongestCategoryAverage = -1;
  for (const [category, aggregate] of categoryScores) {
    const categoryAverage = aggregate.total / aggregate.count;
    if (categoryAverage > strongestCategoryAverage) {
      strongestCategoryAverage = categoryAverage;
      strongestCategory = category;
    }
  }

  let topGap: string | null = null;
  let topGapCount = 0;
  for (const [gap, count] of gapCounts) {
    if (count > topGapCount) {
      topGapCount = count;
      topGap = gap;
    }
  }

  return {
    totalSessions: sessions.length,
    totalQuestions,
    totalAttempts,
    evaluatedAttempts,
    readinessPercent: Math.round(averageScore * 10),
    averageScore: Number(averageScore.toFixed(1)),
    strongestCategory,
    topGap,
  };
}

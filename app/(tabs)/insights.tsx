import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppCard } from '@/components/ui/app-card';
import { AppScreen } from '@/components/ui/app-screen';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SelectorDropdown } from '@/components/ui/selector-dropdown';
import { AppTheme } from '@/constants/app-theme';
import { Session } from '@/lib/domain/session-models';
import { buildInsightsSummary, InsightsSummary } from '@/lib/insights';
import { listSessions } from '@/lib/repositories/session-repository';

function toOneLinePreview(input: string, maxLength = 60): string {
  const normalized = input.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

export default function InsightsScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const contentBottomPadding = tabBarHeight;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [summary, setSummary] = useState<InsightsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSessionKey, setSelectedSessionKey] = useState('all');
  const [isSessionDropdownOpen, setIsSessionDropdownOpen] = useState(false);

  useEffect(() => {
    async function loadInsights() {
      const nextSessions = await listSessions();
      setSessions(nextSessions);
      setIsLoading(false);
    }

    void loadInsights();
  }, []);

  useEffect(() => {
    const filteredSessions =
      selectedSessionKey === 'all' ? sessions : sessions.filter((session) => session.id === selectedSessionKey);

    setSummary(buildInsightsSummary(filteredSessions));
  }, [selectedSessionKey, sessions]);

  useEffect(() => {
    if (selectedSessionKey !== 'all' && !sessions.some((session) => session.id === selectedSessionKey)) {
      setSelectedSessionKey('all');
    }
  }, [selectedSessionKey, sessions]);

  const selectedSession = selectedSessionKey === 'all' ? null : sessions.find((session) => session.id === selectedSessionKey) ?? null;
  const hasEvaluations = (summary?.evaluatedAttempts ?? 0) > 0;
  const sessionOptions: { key: string; label: string }[] = [
    { key: 'all', label: 'All Sessions' },
    ...sessions.map((session) => ({ key: session.id, label: toOneLinePreview(session.title, 72) })),
  ];
  const selectorLabel = selectedSession ? toOneLinePreview(selectedSession.title, 72) : 'All Sessions';

  return (
    <AppScreen
      title="Insights"
      subtitle="Readiness and evaluation trends derived from saved interview sessions."
      excludeBottomSafeArea
      contentBottomPadding={contentBottomPadding}>
      {isLoading ? <Text style={styles.bodyText}>Loading insights...</Text> : null}

      {!isLoading ? (
        <AppCard title="Session Scope">
          <Text style={styles.metaText}>Viewing</Text>
          <Pressable testID="insights-session-dropdown-trigger" style={styles.dropdownTrigger} onPress={() => setIsSessionDropdownOpen(true)}>
            <Text style={styles.dropdownTriggerText}>{selectorLabel}</Text>
            <IconSymbol name="chevron.down" size={14} color={AppTheme.colors.textMuted} />
          </Pressable>
          <Text style={styles.metaText} testID="insights-session-scope-copy">
            {selectedSession ? `Filtered to ${selectedSession.title}` : `Aggregated across ${sessions.length} sessions`}
          </Text>
        </AppCard>
      ) : null}

      <SelectorDropdown
        visible={isSessionDropdownOpen}
        title="Select Session Scope"
        options={sessionOptions}
        selectedKey={selectedSessionKey}
        onSelect={setSelectedSessionKey}
        onClose={() => setIsSessionDropdownOpen(false)}
        backdropTestID="insights-dropdown-backdrop"
        optionTestIDPrefix="insights-dropdown"
      />

      {!isLoading && !hasEvaluations ? (
        <AppCard title="No Insights Yet">
          <Text style={styles.bodyText} testID="insights-empty-state">
            Complete and evaluate at least one practice attempt to unlock readiness and coaching trends.
          </Text>
          <Text style={styles.metaText}>Sessions tracked: {summary?.totalSessions ?? 0}</Text>
          <Text style={styles.metaText}>Attempts tracked: {summary?.totalAttempts ?? 0}</Text>
        </AppCard>
      ) : null}

      {!isLoading && hasEvaluations ? (
        <>
          <View style={styles.metricRow}>
            <View style={styles.metricColumn}>
              <AppCard title="Readiness">
                <Text style={styles.metric} testID="insights-readiness-metric">{summary?.readinessPercent}%</Text>
                <Text style={styles.metaText} testID="insights-average-score">Average score {summary?.averageScore}/10</Text>
              </AppCard>
            </View>
            <View style={styles.metricColumn}>
              <AppCard title="Evaluations">
                <Text style={styles.metric} testID="insights-evaluated-attempts">{summary?.evaluatedAttempts}</Text>
                <Text style={styles.metaText}>Across {summary?.totalSessions} sessions</Text>
              </AppCard>
            </View>
          </View>

          <AppCard title="Focus Area">
            <Text style={styles.bodyText}>Strongest category: {summary?.strongestCategory ?? 'N/A'}</Text>
            <Text style={styles.bodyText}>Most frequent gap: {summary?.topGap ?? 'N/A'}</Text>
          </AppCard>
        </>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  metricRow: {
    flexDirection: 'row',
    gap: AppTheme.spacing.sm,
  },
  dropdownTrigger: {
    borderWidth: 1,
    borderColor: AppTheme.colors.borderStrong,
    backgroundColor: AppTheme.colors.surfaceSecondary,
    paddingHorizontal: AppTheme.spacing.sm,
    paddingVertical: AppTheme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownTriggerText: {
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.typography.bodyFamily,
    fontSize: 14,
    flex: 1,
    marginRight: AppTheme.spacing.sm,
  },
  metricColumn: {
    flex: 1,
  },
  metric: {
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.typography.monoFamily,
    fontSize: 24,
  },
  bodyText: {
    color: AppTheme.colors.textSecondary,
    fontFamily: AppTheme.typography.bodyFamily,
    fontSize: 15,
    lineHeight: 22,
  },
  metaText: {
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.typography.monoFamily,
    fontSize: 12,
  },
});


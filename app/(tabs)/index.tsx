import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppCard } from '@/components/ui/app-card';
import { AppScreen } from '@/components/ui/app-screen';
import { AppTheme } from '@/constants/app-theme';
import { QuestionList } from '@/lib/domain/interview-models';
import { Session } from '@/lib/domain/session-models';
import { createSessionFromQuestionList, listSessions, saveSession } from '@/lib/repositories/session-repository';

function buildStubQuestionList(): QuestionList {
  const nowIso = new Date().toISOString();

  return {
    id: `ql-${Date.now()}`,
    title: 'Frontend System Loop',
    roleDescription: 'Senior React Native engineer',
    createdAtIso: nowIso,
    questions: [
      {
        id: `q-${Date.now()}`,
        prompt: 'How would you optimize rendering in a large list?',
        difficulty: 'Medium',
        answers: [],
      },
    ],
  };
}

export default function PrepareScreen() {
  const [sessions, setSessions] = useState<Session[]>([]);

  const loadPersistedSessions = useCallback(async () => {
    const stored = await listSessions();
    setSessions(stored);
  }, []);

  useEffect(() => {
    void loadPersistedSessions();
  }, [loadPersistedSessions]);

  const onCreateTestSession = useCallback(async () => {
    const questionList = buildStubQuestionList();
    const session = createSessionFromQuestionList({
      sessionNameFromModel: questionList.roleDescription,
      questionList,
    });

    await saveSession(session);
    await loadPersistedSessions();
  }, [loadPersistedSessions]);

  return (
    <AppScreen
      title="Prepare"
      subtitle="Generate interview questions by role context, then track session progress by difficulty tier.">
      <AppCard title="Input Mode">
        <Text style={styles.bodyText}>Text Description and Image Upload controls will be combined in Phase 3.</Text>
      </AppCard>

      <View style={styles.row}>
        <View style={styles.pill}>
          <Text style={styles.pillLabel}>Easy</Text>
        </View>
        <View style={styles.pill}>
          <Text style={styles.pillLabel}>Medium</Text>
        </View>
        <View style={styles.pill}>
          <Text style={styles.pillLabel}>Hard</Text>
        </View>
      </View>

      <AppCard title="Generation Queue">
        <Text style={styles.bodyText}>No active generation jobs yet.</Text>
      </AppCard>

      <AppCard title="Past Sessions">
        <AppButton label="Create Test Session" onPress={onCreateTestSession} />
        {sessions.length === 0 ? <Text style={styles.bodyText}>No sessions yet.</Text> : null}
        {sessions.map((session) => (
          <Pressable key={session.id} style={styles.sessionRow}>
            <Text style={styles.sessionTitle}>{session.title}</Text>
            <Text style={styles.sessionMeta}>{session.id}</Text>
          </Pressable>
        ))}
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: AppTheme.spacing.sm,
  },
  pill: {
    borderWidth: 1,
    borderColor: AppTheme.colors.borderStrong,
    backgroundColor: AppTheme.colors.surfaceTertiary,
    borderRadius: AppTheme.radius.none,
    paddingVertical: AppTheme.spacing.xs,
    paddingHorizontal: AppTheme.spacing.md,
  },
  pillLabel: {
    color: AppTheme.colors.textSecondary,
    fontFamily: AppTheme.typography.monoFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  bodyText: {
    color: AppTheme.colors.textSecondary,
    fontFamily: AppTheme.typography.bodyFamily,
    fontSize: 15,
    lineHeight: 22,
  },
  sessionRow: {
    borderColor: AppTheme.colors.borderSubtle,
    borderWidth: 1,
    backgroundColor: AppTheme.colors.surfaceSecondary,
    paddingHorizontal: AppTheme.spacing.md,
    paddingVertical: AppTheme.spacing.sm,
    borderRadius: AppTheme.radius.none,
    gap: AppTheme.spacing.xs,
  },
  sessionTitle: {
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.typography.bodyFamily,
    fontSize: 15,
  },
  sessionMeta: {
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.typography.monoFamily,
    fontSize: 12,
  },
});

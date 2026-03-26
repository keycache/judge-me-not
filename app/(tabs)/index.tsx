import { StyleSheet, Text, View } from 'react-native';

import { AppCard } from '@/components/ui/app-card';
import { AppScreen } from '@/components/ui/app-screen';
import { AppTheme } from '@/constants/app-theme';

export default function PrepareScreen() {
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
        <Text style={styles.bodyText}>Your generated sessions will appear here.</Text>
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
});

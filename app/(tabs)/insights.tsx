import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { StyleSheet, Text, View } from 'react-native';

import { AppCard } from '@/components/ui/app-card';
import { AppScreen } from '@/components/ui/app-screen';
import { AppTheme } from '@/constants/app-theme';

export default function InsightsScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const contentBottomPadding = tabBarHeight;

  return (
    <AppScreen
      title="Insights"
      subtitle="Session analytics dashboard shell with readiness and performance placeholders."
      excludeBottomSafeArea
      contentBottomPadding={contentBottomPadding}>
      <View style={styles.metricRow}>
        <AppCard title="Readiness">
          <Text style={styles.metric}>--</Text>
        </AppCard>
        <AppCard title="Trend">
          <Text style={styles.metric}>--</Text>
        </AppCard>
      </View>

      <AppCard title="Recommendations">
        <Text style={styles.bodyText}>Actionable recommendations will appear after evaluated attempts.</Text>
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  metricRow: {
    flexDirection: 'row',
    gap: AppTheme.spacing.sm,
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
});

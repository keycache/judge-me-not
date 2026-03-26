import { StyleSheet, Text } from 'react-native';

import { AppCard } from '@/components/ui/app-card';
import { AppScreen } from '@/components/ui/app-screen';
import { AppTheme } from '@/constants/app-theme';

export default function PracticeScreen() {
  return (
    <AppScreen title="Practice" subtitle="Run mock interview questions and capture answer attempts with recording controls.">
      <AppCard title="Question Runner">
        <Text style={styles.bodyText}>Practice flow scaffolding is ready for Phase 5 implementation.</Text>
      </AppCard>

      <AppCard title="Attempt History">
        <Text style={styles.bodyText}>Attempt timelines and statuses will be shown here.</Text>
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  bodyText: {
    color: AppTheme.colors.textSecondary,
    fontFamily: AppTheme.typography.bodyFamily,
    fontSize: 15,
    lineHeight: 22,
  },
});

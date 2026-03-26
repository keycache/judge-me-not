import { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppTheme } from '@/constants/app-theme';

interface AppScreenProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function AppScreen({ title, subtitle, children }: AppScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.contentContainer} style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <View style={styles.body}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AppTheme.colors.background,
  },
  scrollView: {
    flex: 1,
    backgroundColor: AppTheme.colors.background,
  },
  contentContainer: {
    paddingHorizontal: AppTheme.spacing.lg,
    paddingBottom: AppTheme.spacing.xxl,
    paddingTop: AppTheme.spacing.xl,
    gap: AppTheme.spacing.lg,
  },
  header: {
    gap: AppTheme.spacing.xs,
  },
  title: {
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.typography.headingFamily,
    fontSize: 34,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  subtitle: {
    color: AppTheme.colors.textSecondary,
    fontFamily: AppTheme.typography.bodyFamily,
    fontSize: 15,
    lineHeight: 22,
  },
  body: {
    gap: AppTheme.spacing.md,
  },
});

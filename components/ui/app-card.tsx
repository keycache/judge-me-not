import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppTheme } from '@/constants/app-theme';

interface AppCardProps {
  title?: string;
  children?: ReactNode;
}

export function AppCard({ title, children }: AppCardProps) {
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: AppTheme.colors.surfacePrimary,
    borderColor: AppTheme.colors.borderSubtle,
    borderWidth: 1,
    borderRadius: AppTheme.radius.none,
    padding: AppTheme.spacing.md,
    gap: AppTheme.spacing.sm,
  },
  title: {
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.typography.headingFamily,
    fontSize: 18,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
});

import { Pressable, StyleSheet, Text } from 'react-native';

import { AppTheme } from '@/constants/app-theme';

interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost';
}

export function AppButton({ label, onPress, variant = 'primary' }: AppButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' ? styles.primary : styles.ghost,
        pressed ? styles.pressed : null,
      ]}>
      <Text style={[styles.text, variant === 'primary' ? styles.primaryText : styles.ghostText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: AppTheme.radius.none,
    borderWidth: 1,
    minHeight: 48,
    paddingHorizontal: AppTheme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: AppTheme.colors.accent,
    borderColor: AppTheme.colors.accent,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: AppTheme.colors.borderStrong,
  },
  text: {
    fontFamily: AppTheme.typography.headingFamily,
    fontSize: 15,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  primaryText: {
    color: '#151515',
  },
  ghostText: {
    color: AppTheme.colors.textPrimary,
  },
  pressed: {
    opacity: 0.85,
  },
});

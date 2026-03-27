import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppTheme } from '@/constants/app-theme';

interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost';
  testID?: string;
  disabled?: boolean;
  loading?: boolean;
}

export function AppButton({ label, onPress, variant = 'primary', testID, disabled = false, loading = false }: AppButtonProps) {
  const isDisabled = disabled || loading;
  const spinnerColor = variant === 'primary' ? '#151515' : AppTheme.colors.textPrimary;

  return (
    <Pressable
      testID={testID}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' ? styles.primary : styles.ghost,
        isDisabled ? styles.disabled : null,
        pressed && !isDisabled ? styles.pressed : null,
      ]}>
      <View style={styles.contentRow}>
        {loading ? <ActivityIndicator color={spinnerColor} size="small" testID={testID ? `${testID}-spinner` : undefined} /> : null}
        <Text style={[styles.text, variant === 'primary' ? styles.primaryText : styles.ghostText, isDisabled ? styles.disabledText : null]}>
          {label}
        </Text>
      </View>
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
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppTheme.spacing.xs,
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
  disabled: {
    opacity: 0.55,
  },
  disabledText: {
    opacity: 0.9,
  },
});

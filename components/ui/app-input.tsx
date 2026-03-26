import { StyleSheet, TextInput, TextInputProps } from 'react-native';

import { AppTheme } from '@/constants/app-theme';

export function AppInput(props: TextInputProps) {
  return <TextInput placeholderTextColor={AppTheme.colors.textMuted} style={styles.input} {...props} />;
}

const styles = StyleSheet.create({
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: AppTheme.colors.borderStrong,
    borderRadius: AppTheme.radius.none,
    color: AppTheme.colors.textPrimary,
    backgroundColor: AppTheme.colors.surfaceSecondary,
    paddingHorizontal: AppTheme.spacing.md,
    fontFamily: AppTheme.typography.monoFamily,
    fontSize: 15,
  },
});

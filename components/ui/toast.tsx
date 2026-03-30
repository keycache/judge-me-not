import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppTheme } from '@/constants/app-theme';

export type ToastVariant = 'info' | 'success' | 'warning';

export interface ToastState {
  message: string;
  variant: ToastVariant;
  visible: boolean;
}

export interface ToastHandle {
  showToast: (message: string, variant?: ToastVariant) => void;
  toastState: ToastState;
}

const DISMISS_DURATION: Record<ToastVariant, number> = {
  info: 3000,
  success: 3000,
  warning: 5000,
};

export function useToast(): ToastHandle {
  const [toastState, setToastState] = useState<ToastState>({
    message: '',
    variant: 'info',
    visible: false,
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, variant: ToastVariant = 'info') => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setToastState({ message, variant, visible: true });
    timerRef.current = setTimeout(() => {
      setToastState((prev) => ({ ...prev, visible: false }));
    }, DISMISS_DURATION[variant]);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { showToast, toastState };
}

export function ToastContainer({ toastState }: { toastState: ToastState }) {
  if (!toastState.visible || !toastState.message) {
    return null;
  }

  const borderColor =
    toastState.variant === 'success'
      ? AppTheme.colors.success
      : toastState.variant === 'warning'
        ? AppTheme.colors.warning
        : AppTheme.colors.borderStrong;

  const textColor =
    toastState.variant === 'success'
      ? AppTheme.colors.success
      : toastState.variant === 'warning'
        ? AppTheme.colors.warning
        : AppTheme.colors.textSecondary;

  return (
    <View testID="toast-container" style={[styles.container, { borderColor }]} pointerEvents="none">
      <Text testID="toast-message" style={[styles.message, { color: textColor }]}>
        {toastState.message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: AppTheme.spacing.xl,
    left: AppTheme.spacing.lg,
    right: AppTheme.spacing.lg,
    backgroundColor: AppTheme.colors.surfacePrimary,
    borderWidth: 1,
    padding: AppTheme.spacing.sm,
    zIndex: 100,
    elevation: 10,
  },
  message: {
    fontFamily: AppTheme.typography.bodyFamily,
    fontSize: 14,
    lineHeight: 20,
  },
});

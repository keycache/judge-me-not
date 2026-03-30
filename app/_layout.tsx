import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import 'react-native-reanimated';

import { AppTheme } from '@/constants/app-theme';
import { ApiKeyProvider, useApiKey } from '@/hooks/use-api-key';
import { resolveGateTarget } from '@/lib/navigation-gate';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
    <ApiKeyProvider>
      <RootNavigator />
    </ApiKeyProvider>
  );
}

function RootNavigator() {
  const { apiKey, isLoading } = useApiKey();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const target = resolveGateTarget({ hasHydrated: !isLoading, apiKey });

    if (target === 'loading') {
      return;
    }

    const inSetupRoute = segments[0] === 'setup-api';

    if (target === '/setup-api' && !inSetupRoute) {
      router.replace('/setup-api');
    }

    if (target === '/(tabs)' && inSetupRoute) {
      router.replace('/(tabs)');
    }
  }, [apiKey, isLoading, router, segments]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={AppTheme.colors.accent} size="large" />
      </View>
    );
  }

  return (
    <ThemeProvider value={DarkTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="setup-api" options={{ headerShown: false }} />

      </Stack>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppTheme.colors.background,
  },
});

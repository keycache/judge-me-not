import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppCard } from '@/components/ui/app-card';
import { AppInput } from '@/components/ui/app-input';
import { AppScreen } from '@/components/ui/app-screen';
import { AppTheme } from '@/constants/app-theme';
import { useApiKey } from '@/hooks/use-api-key';
import { hasValidApiKey } from '@/lib/api-key';

export default function SetupApiScreen() {
  const { apiKey, isLoading, persistApiKey } = useApiKey();
  const [draftKey, setDraftKey] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && hasValidApiKey(apiKey)) {
      router.replace('/(tabs)');
    }
  }, [apiKey, isLoading, router]);

  async function onContinue() {
    if (draftKey.trim().length === 0) {
      setError('Please enter an API key to continue.');
      return;
    }

    await persistApiKey(draftKey);
    router.replace('/(tabs)');
  }

  return (
    <AppScreen
      title="API Setup"
      subtitle="Add your API key once to unlock the app shell. You can edit this later in Profile.">
      <AppCard title="Connect Model API">
        <Text style={styles.label}>API key</Text>
        <AppInput
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isLoading}
          onChangeText={(value) => {
            setDraftKey(value);
            if (error) {
              setError('');
            }
          }}
          placeholder="sk-..."
          value={draftKey}
        />
        <AppButton label="Save And Continue" onPress={onContinue} />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  label: {
    color: AppTheme.colors.textSecondary,
    fontFamily: AppTheme.typography.bodyFamily,
    fontSize: 14,
  },
  errorText: {
    color: AppTheme.colors.warning,
    fontFamily: AppTheme.typography.monoFamily,
    fontSize: 13,
    letterSpacing: 0.3,
  },
});

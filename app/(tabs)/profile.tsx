import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppCard } from '@/components/ui/app-card';
import { AppInput } from '@/components/ui/app-input';
import { AppScreen } from '@/components/ui/app-screen';
import { AppTheme } from '@/constants/app-theme';
import { useApiKey } from '@/hooks/use-api-key';

export default function ProfileScreen() {
  const { apiKey, isLoading, persistApiKey, removeApiKey } = useApiKey();
  const [draftKey, setDraftKey] = useState(apiKey ?? '');
  const [status, setStatus] = useState('');

  useEffect(() => {
    setDraftKey(apiKey ?? '');
  }, [apiKey]);

  async function onSave() {
    if (draftKey.trim().length === 0) {
      setStatus('API key cannot be empty.');
      return;
    }

    await persistApiKey(draftKey);
    setStatus('API key updated.');
  }

  async function onClear() {
    await removeApiKey();
    setDraftKey('');
    setStatus('API key removed.');
  }

  return (
    <AppScreen
      title="Profile"
      subtitle="Manage account-level settings. API key editing is available here and on first-run setup.">
      <AppCard title="API Settings">
        <Text style={styles.label}>OpenAI-compatible API key</Text>
        <AppInput
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isLoading}
          onChangeText={setDraftKey}
          placeholder="sk-..."
          value={draftKey}
        />
        <View style={styles.buttonRow}>
          <AppButton label="Save Key" onPress={onSave} />
          <AppButton label="Clear" onPress={onClear} variant="ghost" />
        </View>
        {status ? <Text style={styles.statusText}>{status}</Text> : null}
      </AppCard>

      <AppCard title="App State">
        <Text style={styles.bodyText}>Current key status: {apiKey ? 'Configured' : 'Not Configured'}</Text>
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
  bodyText: {
    color: AppTheme.colors.textSecondary,
    fontFamily: AppTheme.typography.bodyFamily,
    fontSize: 15,
    lineHeight: 22,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: AppTheme.spacing.sm,
  },
  statusText: {
    color: AppTheme.colors.warning,
    fontFamily: AppTheme.typography.monoFamily,
    fontSize: 13,
    letterSpacing: 0.3,
  },
});

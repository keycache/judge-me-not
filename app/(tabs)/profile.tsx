import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppCard } from '@/components/ui/app-card';
import { AppInput } from '@/components/ui/app-input';
import { AppScreen } from '@/components/ui/app-screen';
import { AppTheme } from '@/constants/app-theme';
import { useApiKey } from '@/hooks/use-api-key';
import {
  DEFAULT_APP_SETTINGS,
  EVALUATION_STRICTNESS_LEVELS,
  EvaluationStrictness,
  MODEL_VARIANTS,
  ModelVariant,
} from '@/lib/domain/session-models';
import { resolvePromptTemplate } from '@/lib/prompt-template';
import { getAppSettings, patchAppSettings } from '@/lib/repositories/settings-repository';
import { clearAllAppData } from '../../lib/repositories/app-reset';

export default function ProfileScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const contentBottomPadding = tabBarHeight;
  const { apiKey, isLoading, loadApiKey, persistApiKey, removeApiKey } = useApiKey();
  const [draftKey, setDraftKey] = useState(apiKey ?? '');
  const [status, setStatus] = useState('');
  const [modelVariant, setModelVariant] = useState<ModelVariant>('gemini-3.1-flash-lite-preview');
  const [strictness, setStrictness] = useState<EvaluationStrictness>('balanced');
  const [systemPersona, setSystemPersona] = useState('Direct and constructive interview coach');
  const [recordingLimitSeconds, setRecordingLimitSeconds] = useState(
    DEFAULT_APP_SETTINGS.recordingLimitSeconds.toString()
  );
  const [promptStatus, setPromptStatus] = useState('');
  const [resetStatus, setResetStatus] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    setDraftKey(apiKey ?? '');
  }, [apiKey]);

  useEffect(() => {
    async function loadPromptSettings() {
      const settings = await getAppSettings();
      setModelVariant(settings.promptSettings.modelVariant);
      setStrictness(settings.promptSettings.evaluationStrictness);
      setSystemPersona(settings.promptSettings.systemPersona);
      setRecordingLimitSeconds(settings.recordingLimitSeconds.toString());
    }

    void loadPromptSettings();
  }, []);

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

  async function onSavePromptSettings() {
    const limit = Number(recordingLimitSeconds);
    if (!Number.isInteger(limit) || limit < 10 || limit > 600) {
      setPromptStatus('Recording limit must be an integer between 10 and 600 seconds.');
      return;
    }

    await patchAppSettings({
      recordingLimitSeconds: limit,
      promptSettings: {
        modelVariant,
        evaluationStrictness: strictness,
        systemPersona,
      },
    });
    setPromptStatus('Prompt and practice settings updated.');
  }

  async function executeClearAllData() {
    setIsResetting(true);

    try {
      await clearAllAppData();
      await loadApiKey();
      setDraftKey('');
      setModelVariant(DEFAULT_APP_SETTINGS.promptSettings.modelVariant);
      setStrictness(DEFAULT_APP_SETTINGS.promptSettings.evaluationStrictness);
      setSystemPersona(DEFAULT_APP_SETTINGS.promptSettings.systemPersona);
      setRecordingLimitSeconds(DEFAULT_APP_SETTINGS.recordingLimitSeconds.toString());
      setStatus('');
      setPromptStatus('');
      setResetStatus('All local app data cleared. Returning to setup.');
    } catch (error) {
      setResetStatus(error instanceof Error ? error.message : 'Failed to clear local app data.');
    } finally {
      setIsResetting(false);
    }
  }

  function onConfirmClearAll() {
    Alert.alert(
      'Clear all app data?',
      'This removes sessions, attempts, pending evaluations, saved settings, and the Gemini API key from this device.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            void executeClearAllData();
          },
        },
      ]
    );
  }

  const promptPreview = resolvePromptTemplate({
    roleDescription: 'Senior React Native engineer role with architecture and behavioral rounds.',
    inputMode: 'text',
    selectedDifficulties: ['Easy', 'Medium', 'Hard'],
    questionCountPerDifficulty: 20,
    promptSettings: {
      modelVariant,
      evaluationStrictness: strictness,
      systemPersona,
    },
  });

  return (
    <AppScreen
      title="Profile"
      subtitle="Manage account-level settings. API key editing is available here and on first-run setup."
      excludeBottomSafeArea
      contentBottomPadding={contentBottomPadding}>
      <AppCard title="API Settings">
        <Text style={styles.label}>Gemini API key</Text>
        <AppInput
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isLoading}
          onChangeText={setDraftKey}
          placeholder="sk-..."
          secureTextEntry
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

      <AppCard title="Danger Zone">
        <Text style={styles.bodyText}>
          Clear every local session, attempt, pending evaluation, saved prompt setting, and the Gemini API key.
        </Text>
        <AppButton
          label={isResetting ? 'Clearing...' : 'Clear All Data'}
          onPress={onConfirmClearAll}
          variant="ghost"
          disabled={isResetting}
          testID="profile-clear-all-data"
        />
        {resetStatus ? <Text style={styles.statusText}>{resetStatus}</Text> : null}
      </AppCard>

      <AppCard title="Prompt Settings">
        <Text style={styles.label}>Model Variant</Text>
        <View style={styles.choiceRow}>
          {MODEL_VARIANTS.map((variant) => {
            const selected = modelVariant === variant;
            return (
              <Pressable
                key={variant}
                onPress={() => setModelVariant(variant)}
                style={[styles.choiceChip, selected ? styles.choiceChipSelected : null]}>
                <Text style={[styles.choiceText, selected ? styles.choiceTextSelected : null]}>{variant}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Evaluation Strictness</Text>
        <View style={styles.choiceRow}>
          {EVALUATION_STRICTNESS_LEVELS.map((option) => {
            const selected = strictness === option;
            return (
              <Pressable
                key={option}
                onPress={() => setStrictness(option)}
                style={[styles.choiceChip, selected ? styles.choiceChipSelected : null]}>
                <Text style={[styles.choiceText, selected ? styles.choiceTextSelected : null]}>{option}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>System Persona</Text>
        <AppInput multiline numberOfLines={3} onChangeText={setSystemPersona} value={systemPersona} />

        <Text style={styles.label}>Recording Cap (seconds)</Text>
        <AppInput keyboardType="number-pad" onChangeText={setRecordingLimitSeconds} value={recordingLimitSeconds} />

        <AppButton label="Save Prompt + Practice Settings" onPress={onSavePromptSettings} />
        {promptStatus ? <Text style={styles.statusText}>{promptStatus}</Text> : null}
      </AppCard>

      <AppCard title="Prompt Preview">
        <Text style={styles.previewText}>{promptPreview}</Text>
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
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: AppTheme.spacing.xs,
  },
  choiceChip: {
    borderWidth: 1,
    borderColor: AppTheme.colors.borderStrong,
    backgroundColor: AppTheme.colors.surfaceSecondary,
    paddingHorizontal: AppTheme.spacing.sm,
    paddingVertical: AppTheme.spacing.xs,
    borderRadius: AppTheme.radius.none,
  },
  choiceChipSelected: {
    borderColor: AppTheme.colors.accent,
  },
  choiceText: {
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.typography.bodyFamily,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  choiceTextSelected: {
    color: AppTheme.colors.textPrimary,
  },
  previewText: {
    color: AppTheme.colors.textSecondary,
    fontFamily: AppTheme.typography.monoFamily,
    fontSize: 12,
    lineHeight: 18,
  },
  statusText: {
    color: AppTheme.colors.warning,
    fontFamily: AppTheme.typography.monoFamily,
    fontSize: 13,
    letterSpacing: 0.3,
  },
});

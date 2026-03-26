import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppCard } from '@/components/ui/app-card';
import { AppInput } from '@/components/ui/app-input';
import { AppScreen } from '@/components/ui/app-screen';
import { AppTheme } from '@/constants/app-theme';
import { useApiKey } from '@/hooks/use-api-key';
import {
    EVALUATION_STRICTNESS_LEVELS,
    EvaluationStrictness,
    MODEL_VARIANTS,
    ModelVariant,
} from '@/lib/domain/session-models';
import { resolvePromptTemplate } from '@/lib/prompt-template';
import { getAppSettings, patchPromptSettings } from '@/lib/repositories/settings-repository';

export default function ProfileScreen() {
  const { apiKey, isLoading, persistApiKey, removeApiKey } = useApiKey();
  const [draftKey, setDraftKey] = useState(apiKey ?? '');
  const [status, setStatus] = useState('');
  const [modelVariant, setModelVariant] = useState<ModelVariant>('gpt-4.1-mini');
  const [strictness, setStrictness] = useState<EvaluationStrictness>('balanced');
  const [systemPersona, setSystemPersona] = useState('Direct and constructive interview coach');
  const [promptStatus, setPromptStatus] = useState('');

  useEffect(() => {
    setDraftKey(apiKey ?? '');
  }, [apiKey]);

  useEffect(() => {
    async function loadPromptSettings() {
      const settings = await getAppSettings();
      setModelVariant(settings.promptSettings.modelVariant);
      setStrictness(settings.promptSettings.evaluationStrictness);
      setSystemPersona(settings.promptSettings.systemPersona);
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
    await patchPromptSettings({
      modelVariant,
      evaluationStrictness: strictness,
      systemPersona,
    });
    setPromptStatus('Prompt settings updated.');
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

        <AppButton label="Save Prompt Settings" onPress={onSavePromptSettings} />
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

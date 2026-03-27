import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppCard } from '@/components/ui/app-card';
import { AppInput } from '@/components/ui/app-input';
import { AppScreen } from '@/components/ui/app-screen';
import { AppTheme } from '@/constants/app-theme';
import { Difficulty, QuestionList } from '@/lib/domain/interview-models';
import { Session } from '@/lib/domain/session-models';
import {
  ImageInput,
  InputMode,
  MAX_IMAGES,
  MAX_IMAGE_SIZE_BYTES,
  MAX_QUESTIONS_PER_BATCH,
  validateImageSelection,
  validateInputMode,
  validateQuestionsPerBatch,
} from '@/lib/interview-rules';
import { buildSessionPromptSnapshot } from '@/lib/prompt-template';
import { createSessionFromQuestionList, listSessions, saveSession } from '@/lib/repositories/session-repository';
import { getAppSettings } from '@/lib/repositories/settings-repository';

function buildQuestionListFromGeneration(input: {
  titleHint: string;
  textDescription: string;
  mode: InputMode;
  selectedDifficulties: Difficulty[];
  questionCountPerDifficulty: number;
}): QuestionList {
  const nowIso = new Date().toISOString();
  const questions = input.selectedDifficulties.flatMap((difficulty) =>
    Array.from({ length: input.questionCountPerDifficulty }, (_, index) => ({
      id: `q-${difficulty}-${Date.now()}-${index}`,
      prompt:
        input.mode === 'text'
          ? `[${difficulty}] ${input.textDescription || 'Behavioral interview'} (#${index + 1})`
          : `[${difficulty}] Image-derived question (#${index + 1})`,
      difficulty,
      answers: [],
    }))
  );

  return {
    id: `ql-${Date.now()}`,
    title: input.titleHint,
    roleDescription: input.textDescription || 'Image based role context',
    createdAtIso: nowIso,
    questions,
  };
}

export default function PrepareScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const contentBottomPadding = tabBarHeight;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [mode, setMode] = useState<InputMode>('text');
  const [textDescription, setTextDescription] = useState('');
  const [images, setImages] = useState<ImageInput[]>([]);
  const [questionCount, setQuestionCount] = useState('20');
  const [selectedDifficulties, setSelectedDifficulties] = useState<Difficulty[]>(['Easy', 'Medium', 'Hard']);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [progressByDifficulty, setProgressByDifficulty] = useState<Record<Difficulty, number>>({
    Easy: 0,
    Medium: 0,
    Hard: 0,
  });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadPersistedSessions = useCallback(async () => {
    const stored = await listSessions();
    setSessions(stored);
  }, []);

  useEffect(() => {
    void loadPersistedSessions();
  }, [loadPersistedSessions]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const activeDifficulties = useMemo(
    () => ['Easy', 'Medium', 'Hard'].filter((difficulty) => selectedDifficulties.includes(difficulty as Difficulty)) as Difficulty[],
    [selectedDifficulties]
  );

  const toggleDifficulty = useCallback((difficulty: Difficulty) => {
    setSelectedDifficulties((current) => {
      if (current.includes(difficulty)) {
        if (current.length === 1) {
          return current;
        }

        return current.filter((item) => item !== difficulty);
      }

      return [...current, difficulty];
    });
  }, []);

  const onSwitchMode = useCallback((nextMode: InputMode) => {
    setMode(nextMode);
    setValidationErrors([]);

    if (nextMode === 'text') {
      setImages([]);
    } else {
      setTextDescription('');
    }
  }, []);

  const addPickedAsset = useCallback(
    (asset: ImagePicker.ImagePickerAsset) => {
      const nextImage: ImageInput = {
        uri: asset.uri,
        fileSizeBytes: asset.fileSize ?? 0,
      };

      const nextImages = [...images, nextImage];
      const validation = validateImageSelection(nextImages);
      if (!validation.ok) {
        setValidationErrors(validation.errors);
        return;
      }

      setImages(nextImages);
      setValidationErrors([]);
    },
    [images]
  );

  const onPickFromGallery = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setValidationErrors(['Gallery permission is required to pick images.']);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    addPickedAsset(result.assets[0]);
  }, [addPickedAsset]);

  const onTakePhoto = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setValidationErrors(['Camera permission is required to capture images.']);
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 1,
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    addPickedAsset(result.assets[0]);
  }, [addPickedAsset]);

  const onGenerate = useCallback(async () => {
    const count = Number(questionCount);
    const countValidation = validateQuestionsPerBatch(count);
    const modeValidation = validateInputMode(mode, textDescription, images);
    const imageValidation = mode === 'image' ? validateImageSelection(images) : { ok: true, errors: [] };

    const aggregatedErrors = [
      ...countValidation.errors,
      ...modeValidation.errors,
      ...imageValidation.errors,
      ...(activeDifficulties.length === 0 ? ['At least one difficulty must be selected.'] : []),
    ];

    if (aggregatedErrors.length > 0) {
      setValidationErrors(aggregatedErrors);
      return;
    }

    setValidationErrors([]);
    setProgressByDifficulty({ Easy: 0, Medium: 0, Hard: 0 });

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      setProgressByDifficulty((current) => {
        const next = { ...current };

        for (const difficulty of activeDifficulties) {
          next[difficulty] = Math.min(100, current[difficulty] + 20);
        }

        const finished = activeDifficulties.every((difficulty) => next[difficulty] >= 100);
        if (finished && timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        return next;
      });
    }, 250);

    const questionList = buildQuestionListFromGeneration({
      titleHint: mode === 'text' ? 'Text Generated Session' : 'Image Generated Session',
      textDescription,
      mode,
      selectedDifficulties: activeDifficulties,
      questionCountPerDifficulty: count,
    });

    const appSettings = await getAppSettings();
    const promptSnapshot = buildSessionPromptSnapshot({
      roleDescription: questionList.roleDescription,
      inputMode: mode,
      selectedDifficulties: activeDifficulties,
      questionCountPerDifficulty: count,
      promptSettings: appSettings.promptSettings,
    });

    const session = createSessionFromQuestionList({
      sessionNameFromModel: questionList.roleDescription,
      questionList,
      promptSnapshot,
    });

    await saveSession(session);
    await loadPersistedSessions();
  }, [activeDifficulties, images, loadPersistedSessions, mode, questionCount, textDescription]);

  return (
    <AppScreen
      title="Prepare"
      subtitle="Generate interview questions by role context, then track session progress by difficulty tier."
      excludeBottomSafeArea
      contentBottomPadding={contentBottomPadding}>
      <AppCard title="Input Mode">
        <View style={styles.toggleRow}>
          <Pressable
            testID="prepare-mode-text"
            style={[styles.toggleButton, mode === 'text' ? styles.toggleButtonActive : null]}
            onPress={() => onSwitchMode('text')}>
            <Text style={[styles.toggleText, mode === 'text' ? styles.toggleTextActive : null]}>Text Description</Text>
          </Pressable>
          <Pressable
            testID="prepare-mode-image"
            style={[styles.toggleButton, mode === 'image' ? styles.toggleButtonActive : null]}
            onPress={() => onSwitchMode('image')}>
            <Text style={[styles.toggleText, mode === 'image' ? styles.toggleTextActive : null]}>Image Upload</Text>
          </Pressable>
        </View>

        {mode === 'text' ? (
          <AppInput
            testID="prepare-text-description"
            multiline
            numberOfLines={4}
            onChangeText={setTextDescription}
            placeholder="Paste role description and interview context"
            value={textDescription}
          />
        ) : (
          <View style={styles.imageComposer}>
            <View style={styles.row}>
              <View style={styles.flexButton}>
                <AppButton testID="prepare-pick-gallery" label="Pick From Gallery" onPress={onPickFromGallery} />
              </View>
              <View style={styles.flexButton}>
                <AppButton testID="prepare-open-camera" label="Take Photo" onPress={onTakePhoto} variant="ghost" />
              </View>
            </View>
            <Text style={styles.hintText}>Max {MAX_IMAGES} images, each up to {Math.round(MAX_IMAGE_SIZE_BYTES / (1024 * 1024))}MB.</Text>
            {images.map((image, index) => (
              <View testID={`prepare-image-row-${index.toString()}`} key={image.uri + image.fileSizeBytes.toString()} style={styles.imageRow}>
                <Text style={styles.sessionTitle}>{image.uri}</Text>
                <Text style={styles.sessionMeta}>
                  {image.fileSizeBytes > 0 ? `${(image.fileSizeBytes / (1024 * 1024)).toFixed(2)}MB` : 'Size unavailable'}
                </Text>
              </View>
            ))}
          </View>
        )}
      </AppCard>

      <AppCard title="Difficulty Tiers">
        <View style={styles.row}>
          {(['Easy', 'Medium', 'Hard'] as Difficulty[]).map((difficulty) => {
            const isSelected = selectedDifficulties.includes(difficulty);
            return (
              <Pressable
                testID={`prepare-difficulty-${difficulty.toLowerCase()}`}
                key={difficulty}
                onPress={() => toggleDifficulty(difficulty)}
                style={[styles.pill, isSelected ? styles.pillActive : null]}>
                <Text style={[styles.pillLabel, isSelected ? styles.pillLabelActive : null]}>{difficulty}</Text>
              </Pressable>
            );
          })}
        </View>
      </AppCard>

      <AppCard title="Batch Size">
        <AppInput
          testID="prepare-batch-size"
          keyboardType="number-pad"
          onChangeText={setQuestionCount}
          placeholder={`1-${MAX_QUESTIONS_PER_BATCH}`}
          value={questionCount}
        />
      </AppCard>

      <AppCard title="Generation Queue">
        <AppButton testID="prepare-generate-session" label="Generate Session" onPress={onGenerate} />
        <View style={styles.progressColumn}>
          {(['Easy', 'Medium', 'Hard'] as Difficulty[]).map((difficulty) => {
            const progress = progressByDifficulty[difficulty];
            return (
              <View key={difficulty} testID={`prepare-progress-${difficulty.toLowerCase()}`} style={styles.progressRow}>
                <Text style={styles.progressLabel}>{difficulty}</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progress}%` }]} />
                </View>
                <Text style={styles.progressValue}>{progress}%</Text>
              </View>
            );
          })}
        </View>
        {validationErrors.length > 0 ? (
          <View testID="prepare-validation-errors" style={styles.errorList}>
            {validationErrors.map((error, index) => (
              <Text key={`${error}-${index.toString()}`} style={styles.errorText}>
                {error}
              </Text>
            ))}
          </View>
        ) : null}
      </AppCard>

      <AppCard title="Past Sessions">
        {sessions.length === 0 ? <Text testID="prepare-no-sessions" style={styles.bodyText}>No sessions yet.</Text> : null}
        {sessions.map((session, index) => (
          <Pressable testID={`prepare-session-row-${index.toString()}`} key={session.id} style={styles.sessionRow}>
            <Text style={styles.sessionTitle}>{session.title}</Text>
            <Text style={styles.sessionMeta}>{session.id}</Text>
          </Pressable>
        ))}
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: AppTheme.spacing.sm,
    flexWrap: 'wrap',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: AppTheme.spacing.sm,
  },
  toggleButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: AppTheme.colors.borderStrong,
    backgroundColor: AppTheme.colors.surfaceSecondary,
    paddingVertical: AppTheme.spacing.sm,
    paddingHorizontal: AppTheme.spacing.md,
    borderRadius: AppTheme.radius.none,
  },
  toggleButtonActive: {
    borderColor: AppTheme.colors.accent,
    backgroundColor: AppTheme.colors.surfaceTertiary,
  },
  toggleText: {
    color: AppTheme.colors.textMuted,
    textAlign: 'center',
    fontFamily: AppTheme.typography.bodyFamily,
    fontSize: 13,
  },
  toggleTextActive: {
    color: AppTheme.colors.textPrimary,
  },
  pill: {
    borderWidth: 1,
    borderColor: AppTheme.colors.borderStrong,
    backgroundColor: AppTheme.colors.surfaceTertiary,
    borderRadius: AppTheme.radius.none,
    paddingVertical: AppTheme.spacing.xs,
    paddingHorizontal: AppTheme.spacing.md,
  },
  pillActive: {
    borderColor: AppTheme.colors.accent,
  },
  pillLabel: {
    color: AppTheme.colors.textSecondary,
    fontFamily: AppTheme.typography.monoFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  pillLabelActive: {
    color: AppTheme.colors.textPrimary,
  },
  bodyText: {
    color: AppTheme.colors.textSecondary,
    fontFamily: AppTheme.typography.bodyFamily,
    fontSize: 15,
    lineHeight: 22,
  },
  imageComposer: {
    gap: AppTheme.spacing.sm,
  },
  flexButton: {
    flex: 1,
  },
  imageRow: {
    borderColor: AppTheme.colors.borderSubtle,
    borderWidth: 1,
    backgroundColor: AppTheme.colors.surfaceSecondary,
    paddingHorizontal: AppTheme.spacing.md,
    paddingVertical: AppTheme.spacing.sm,
    gap: AppTheme.spacing.xs,
  },
  hintText: {
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.typography.monoFamily,
    fontSize: 12,
  },
  progressColumn: {
    gap: AppTheme.spacing.xs,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppTheme.spacing.sm,
  },
  progressLabel: {
    width: 56,
    color: AppTheme.colors.textSecondary,
    fontFamily: AppTheme.typography.bodyFamily,
    fontSize: 13,
  },
  progressTrack: {
    flex: 1,
    height: 10,
    borderWidth: 1,
    borderColor: AppTheme.colors.borderStrong,
    backgroundColor: AppTheme.colors.surfaceSecondary,
  },
  progressFill: {
    height: '100%',
    backgroundColor: AppTheme.colors.accent,
  },
  progressValue: {
    width: 44,
    textAlign: 'right',
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.typography.monoFamily,
    fontSize: 12,
  },
  errorList: {
    borderWidth: 1,
    borderColor: AppTheme.colors.warning,
    backgroundColor: AppTheme.colors.surfaceSecondary,
    padding: AppTheme.spacing.sm,
    gap: AppTheme.spacing.xs,
  },
  errorText: {
    color: AppTheme.colors.warning,
    fontFamily: AppTheme.typography.bodyFamily,
    fontSize: 13,
  },
  sessionRow: {
    borderColor: AppTheme.colors.borderSubtle,
    borderWidth: 1,
    backgroundColor: AppTheme.colors.surfaceSecondary,
    paddingHorizontal: AppTheme.spacing.md,
    paddingVertical: AppTheme.spacing.sm,
    borderRadius: AppTheme.radius.none,
    gap: AppTheme.spacing.xs,
  },
  sessionTitle: {
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.typography.bodyFamily,
    fontSize: 15,
  },
  sessionMeta: {
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.typography.monoFamily,
    fontSize: 12,
  },
});

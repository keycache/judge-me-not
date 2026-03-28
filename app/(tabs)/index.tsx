import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppCard } from '@/components/ui/app-card';
import { AppInput } from '@/components/ui/app-input';
import { AppScreen } from '@/components/ui/app-screen';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppTheme } from '@/constants/app-theme';
import { Difficulty } from '@/lib/domain/interview-models';
import { Session } from '@/lib/domain/session-models';
import { generateInterviewQuestions } from '@/lib/genai';
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
import { createSessionFromQuestionList, deleteSession, listSessions, saveSession } from '@/lib/repositories/session-repository';
import { getAppSettings } from '@/lib/repositories/settings-repository';
import { resolveSessionTitle } from '@/lib/session-title';

export default function PrepareScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const { width: windowWidth } = useWindowDimensions();
  const carouselPageWidth = Math.max(220, windowWidth - AppTheme.spacing.md * 4);
  const imagePreviewGap = AppTheme.spacing.xs;
  const imagePreviewSize = Math.max(
    44,
    Math.floor(
      (windowWidth - AppTheme.spacing.lg * 2 - AppTheme.spacing.md * 2 - imagePreviewGap * (MAX_IMAGES - 1)) / MAX_IMAGES
    )
  );
  const contentBottomPadding = tabBarHeight;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [mode, setMode] = useState<InputMode>('text');
  const [textDescription, setTextDescription] = useState('');
  const [images, setImages] = useState<ImageInput[]>([]);
  const [questionCount, setQuestionCount] = useState('20');
  const [selectedDifficulties, setSelectedDifficulties] = useState<Difficulty[]>(['Easy', 'Medium', 'Hard']);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isGeneratingSession, setIsGeneratingSession] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const [pendingSessionTitle, setPendingSessionTitle] = useState<string | null>(null);

  const loadPersistedSessions = useCallback(async () => {
    const stored = await listSessions();
    setSessions(stored);
  }, []);

  useEffect(() => {
    void loadPersistedSessions();
  }, [loadPersistedSessions]);

  useEffect(() => {
    return undefined;
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

  const onRemoveImage = useCallback((imageUri: string) => {
    setImages((current) => current.filter((image) => image.uri !== imageUri));
    setValidationErrors([]);
  }, []);

  const onGenerate = useCallback(async () => {
    if (isGeneratingSession) {
      return;
    }

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
    setIsGeneratingSession(true);
    setPendingSessionTitle(null);
    setGenerationStatus(mode === 'image' ? 'Analyzing images and drafting questions...' : 'Reading role context and drafting questions...');

    try {
      const appSettings = await getAppSettings();
      const promptSnapshot = buildSessionPromptSnapshot({
        roleDescription: textDescription || 'Image based role context',
        inputMode: mode,
        selectedDifficulties: activeDifficulties,
        questionCountPerDifficulty: count,
        promptSettings: appSettings.promptSettings,
      });

      const generationResult = await generateInterviewQuestions({
        roleDescription: textDescription || 'Image based role context',
        inputMode: mode,
        selectedDifficulties: activeDifficulties,
        questionCountPerDifficulty: count,
        promptSettings: appSettings.promptSettings,
        imageUris: mode === 'image' ? images.map((image) => image.uri) : undefined,
      });

      const sessionNameFromModel = resolveSessionTitle({
        proposedTitle: generationResult.proposedSessionName,
        mode,
        sourceText: textDescription,
        imageCount: images.length,
        fallback: mode === 'text' ? 'Interview Session' : 'Image Interview Session',
      });

      setPendingSessionTitle(sessionNameFromModel);
      setGenerationStatus(`Creating "${sessionNameFromModel}"...`);

      const session = createSessionFromQuestionList({
        sessionNameFromModel,
        questionList: generationResult.questionList,
        promptSnapshot,
        sourceContext: {
          inputMode: mode,
          sourceText: mode === 'text' ? textDescription : undefined,
          imageUris: mode === 'image' ? images.map((image) => image.uri) : undefined,
        },
      });

      await saveSession(session);
      setTextDescription('');
      setImages([]);
      await loadPersistedSessions();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Session generation failed.';
      setValidationErrors([message]);
    } finally {
      setIsGeneratingSession(false);
      setGenerationStatus('');
      setPendingSessionTitle(null);
    }
  }, [activeDifficulties, images, isGeneratingSession, loadPersistedSessions, mode, questionCount, textDescription]);

  const onOpenSessionDetails = useCallback((session: Session) => {
    setSelectedSession(session);
    setSelectedImageIndex(0);
  }, []);

  const onCloseSessionDetails = useCallback(() => {
    setSelectedSession(null);
  }, []);

  const onDeleteSession = useCallback((session: Session) => {
    Alert.alert('Delete Session', `Delete "${session.title}"? This cannot be undone.`, [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await deleteSession(session.id);
            await loadPersistedSessions();
            setSelectedSession((current) => (current?.id === session.id ? null : current));
          })();
        },
      },
    ]);
  }, [loadPersistedSessions]);

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
                <AppButton testID="prepare-pick-gallery" label="Gallery" onPress={onPickFromGallery} />
              </View>
              <View style={styles.flexButton}>
                <AppButton testID="prepare-open-camera" label="Take Photo" onPress={onTakePhoto} variant="ghost" />
              </View>
            </View>
            <Text style={styles.hintText}>Max {MAX_IMAGES} images, each up to {Math.round(MAX_IMAGE_SIZE_BYTES / (1024 * 1024))}MB.</Text>
            {images.length > 0 ? (
              <View style={styles.imagePreviewStrip} testID="prepare-image-preview-strip">
                {images.map((image, index) => (
                  <View
                    testID={`prepare-image-preview-${index.toString()}`}
                    key={image.uri + image.fileSizeBytes.toString()}
                    style={[styles.imagePreviewCard, { width: imagePreviewSize }]}>
                    <Image source={{ uri: image.uri }} style={[styles.imagePreview, { width: imagePreviewSize, height: imagePreviewSize }]} resizeMode="cover" />
                    <Pressable
                      accessibilityLabel={`Remove selected image ${index + 1}`}
                      hitSlop={8}
                      onPress={() => onRemoveImage(image.uri)}
                      style={styles.imagePreviewRemoveButton}
                      testID={`prepare-remove-image-${index.toString()}`}>
                      <Text style={styles.imagePreviewRemoveText}>x</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        )}

        <AppButton
          testID="prepare-generate-session"
          label={isGeneratingSession ? 'Generating Session...' : 'Generate Session'}
          onPress={onGenerate}
          disabled={isGeneratingSession}
        />
        {isGeneratingSession ? (
          <View testID="prepare-generation-loading" style={styles.loadingStateCard}>
            <ActivityIndicator color={AppTheme.colors.accent} size="small" />
            <View style={styles.loadingCopyColumn}>
              <Text style={styles.loadingTitle}>{pendingSessionTitle ?? 'Generating session draft...'}</Text>
              <Text style={styles.loadingText}>{generationStatus}</Text>
            </View>
          </View>
        ) : null}
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

      <AppCard title="Past Sessions">
        {sessions.length === 0 ? <Text testID="prepare-no-sessions" style={styles.bodyText}>No sessions yet.</Text> : null}
        {sessions.map((session, index) => (
          <Pressable key={session.id} testID={`prepare-session-row-${index.toString()}`} style={styles.sessionRow} onPress={() => onOpenSessionDetails(session)}>
            <Pressable
              accessibilityLabel={`Delete ${session.title}`}
              hitSlop={10}
              onPress={() => onDeleteSession(session)}
              style={styles.deleteIconButton}
              testID={`prepare-delete-session-${index.toString()}`}>
              <IconSymbol color={AppTheme.colors.warning} name="trash.fill" size={18} />
            </Pressable>
              <Text style={styles.sessionTitle}>{session.title}</Text>
              <Text style={styles.sessionMeta}>{new Date(session.createdAtIso).toLocaleString()}</Text>
              <Text style={styles.sessionMeta}>{session.questionList.questions.length} questions</Text>
          </Pressable>
        ))}
      </AppCard>

      <Modal animationType="slide" transparent visible={Boolean(selectedSession)} onRequestClose={onCloseSessionDetails}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalPanel} testID="prepare-session-details-modal">
            <Text style={styles.modalTitle}>{selectedSession?.title ?? 'Session Details'}</Text>
            <Text style={styles.sessionMeta} testID="prepare-session-details-mode">
              Mode: {selectedSession?.sourceContext?.inputMode ?? 'unknown'}
            </Text>
            <Text style={styles.sessionMeta} testID="prepare-session-details-question-count">
              Questions: {selectedSession?.questionList.questions.length ?? 0}
            </Text>
            <Text style={styles.sectionTitle}>Generation Settings</Text>
            <Text style={styles.sessionMeta} testID="prepare-session-details-model">
              Model: {selectedSession?.promptSnapshot?.modelVariant ?? 'unknown'}
            </Text>
            <Text style={styles.sessionMeta} testID="prepare-session-details-strictness">
              Strictness: {selectedSession?.promptSnapshot?.evaluationStrictness ?? 'unknown'}
            </Text>
            <Text style={styles.sessionMeta} testID="prepare-session-details-persona">
              Persona: {selectedSession?.promptSnapshot?.systemPersona ?? 'unknown'}
            </Text>
            {selectedSession?.sourceContext?.inputMode === 'text' ? (
              <ScrollView style={styles.detailsScrollArea}>
                <Text style={styles.sectionTitle}>Source Description</Text>
                <Text style={styles.bodyText} testID="prepare-session-details-source-text">
                  {selectedSession.sourceContext.sourceText || 'No text context found.'}
                </Text>
              </ScrollView>
            ) : (
              <View style={styles.carouselArea}>
                {selectedSession?.sourceContext?.imageUris && selectedSession.sourceContext.imageUris.length > 0 ? (
                  <>
                    <Text style={styles.sessionMeta} testID="prepare-session-details-image-count">
                      Image {selectedImageIndex + 1} of {selectedSession.sourceContext.imageUris.length}
                    </Text>
                    <ScrollView
                      horizontal
                      pagingEnabled
                      showsHorizontalScrollIndicator={false}
                      onMomentumScrollEnd={(event) => {
                        const nextIndex = Math.round(event.nativeEvent.contentOffset.x / carouselPageWidth);
                        setSelectedImageIndex(nextIndex);
                      }}>
                    {selectedSession.sourceContext.imageUris.map((uri) => (
                      <View key={uri} style={[styles.carouselPage, { width: carouselPageWidth }]}>
                        <Image source={{ uri }} style={styles.carouselImage} resizeMode="cover" />
                        <Text style={styles.sessionMeta}>{uri}</Text>
                      </View>
                    ))}
                    </ScrollView>
                    <View style={styles.dotsRow}>
                      {selectedSession.sourceContext.imageUris.map((uri, index) => (
                        <View key={`${uri}-${index.toString()}`} style={[styles.dot, index === selectedImageIndex ? styles.dotActive : null]} />
                      ))}
                    </View>
                  </>
                ) : (
                  <Text style={styles.bodyText}>No image context found for this session.</Text>
                )}
              </View>
            )}
            <AppButton label="Close" onPress={onCloseSessionDetails} variant="ghost" />
          </View>
        </View>
      </Modal>
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
  imagePreviewStrip: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: AppTheme.spacing.xs,
    alignItems: 'flex-start',
  },
  imagePreviewCard: {
    position: 'relative',
    borderWidth: 1,
    borderColor: AppTheme.colors.borderSubtle,
    backgroundColor: AppTheme.colors.surfaceSecondary,
    overflow: 'hidden',
  },
  imagePreview: {
    backgroundColor: AppTheme.colors.surfaceTertiary,
  },
  imagePreviewRemoveButton: {
    position: 'absolute',
    top: AppTheme.spacing.xxs,
    right: AppTheme.spacing.xxs,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(13, 17, 23, 0.88)',
    borderWidth: 1,
    borderColor: AppTheme.colors.borderStrong,
  },
  imagePreviewRemoveText: {
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.typography.headingFamily,
    fontSize: 12,
    lineHeight: 12,
    textTransform: 'uppercase',
  },
  hintText: {
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.typography.monoFamily,
    fontSize: 12,
  },
  loadingStateCard: {
    borderWidth: 1,
    borderColor: AppTheme.colors.borderStrong,
    backgroundColor: AppTheme.colors.surfaceSecondary,
    padding: AppTheme.spacing.sm,
    gap: AppTheme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingCopyColumn: {
    flex: 1,
    gap: AppTheme.spacing.xs,
  },
  loadingTitle: {
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.typography.headingFamily,
    fontSize: 14,
    textTransform: 'uppercase',
  },
  loadingText: {
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.typography.bodyFamily,
    fontSize: 13,
    lineHeight: 18,
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
    position: 'relative',
    paddingRight: AppTheme.spacing.xl * 2,
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
  deleteIconButton: {
    position: 'absolute',
    top: AppTheme.spacing.sm,
    right: AppTheme.spacing.sm,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: AppTheme.spacing.md,
  },
  modalPanel: {
    backgroundColor: AppTheme.colors.surfacePrimary,
    borderWidth: 1,
    borderColor: AppTheme.colors.borderStrong,
    padding: AppTheme.spacing.md,
    gap: AppTheme.spacing.sm,
    maxHeight: '80%',
  },
  modalTitle: {
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.typography.headingFamily,
    fontSize: 16,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.typography.monoFamily,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  detailsScrollArea: {
    maxHeight: 300,
  },
  carouselArea: {
    minHeight: 240,
  },
  carouselPage: {
    gap: AppTheme.spacing.xs,
    marginRight: AppTheme.spacing.sm,
  },
  carouselImage: {
    width: '100%',
    height: 220,
    borderWidth: 1,
    borderColor: AppTheme.colors.borderStrong,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: AppTheme.spacing.xs,
    alignSelf: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    backgroundColor: AppTheme.colors.borderStrong,
  },
  dotActive: {
    backgroundColor: AppTheme.colors.accent,
  },
});

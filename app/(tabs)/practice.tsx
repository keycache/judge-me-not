import Slider from '@react-native-community/slider';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { Audio } from 'expo-av';
import * as Network from 'expo-network';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppCard } from '@/components/ui/app-card';
import { AppInput } from '@/components/ui/app-input';
import { AppScreen } from '@/components/ui/app-screen';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SelectorDropdown } from '@/components/ui/selector-dropdown';
import { ToastContainer, useToast } from '@/components/ui/toast';
import { AppTheme } from '@/constants/app-theme';
import { Answer, buildQuestionValueKey } from '@/lib/domain/interview-models';
import { DEFAULT_APP_SETTINGS, Session } from '@/lib/domain/session-models';
import { enforceRecordingLimit } from '@/lib/practice-engine';
import {
    appendAttempt,
    deleteAttempt,
    listAttempts,
    listPendingEvaluations,
    processPendingEvaluations,
    submitAttemptForEvaluation,
} from '@/lib/repositories/practice-repository';
import { listSessions } from '@/lib/repositories/session-repository';
import { getAppSettings, patchAppSettings } from '@/lib/repositories/settings-repository';

type AttemptEvaluationTabKey = 'candidate_answer' | 'feedback' | 'gaps_identified' | 'model_answer';

const ATTEMPT_EVALUATION_TABS: { key: AttemptEvaluationTabKey; label: string }[] = [
  { key: 'candidate_answer', label: 'Answer' },
  { key: 'feedback', label: 'Feedback' },
  { key: 'gaps_identified', label: 'Gaps' },
  { key: 'model_answer', label: 'Ideal' },
];

function getAttemptStatusIconName(status: 'completed' | 'pending' | 'draft'): 'checkmark.circle.fill' | 'clock.fill' | 'pencil' {
  if (status === 'completed') {
    return 'checkmark.circle.fill';
  }

  if (status === 'pending') {
    return 'clock.fill';
  }

  return 'pencil';
}

function getAttemptStatusColor(status: 'completed' | 'pending' | 'draft'): string {
  if (status === 'completed') {
    return AppTheme.colors.success;
  }

  if (status === 'pending') {
    return AppTheme.colors.warning;
  }

  return AppTheme.colors.textMuted;
}

function getAttemptPlaybackIconName(isActive: boolean): 'play.fill' | 'pause.fill' {
  return isActive ? 'pause.fill' : 'play.fill';
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function toOneLinePreview(input: string, maxLength = 64): string {
  const normalized = input.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function formatAttemptTimestamp(input: string): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return input;
  }

  return date.toLocaleString();
}

function formatSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export default function PracticeScreen() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const contentBottomPadding = tabBarHeight;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeQuestionValueKey, setActiveQuestionValueKey] = useState<string | null>(null);
  const [randomCycleBySession, setRandomCycleBySession] = useState<Record<string, string[]>>({});
  const [attempts, setAttempts] = useState<Answer[]>([]);
  const [transcriptDraft, setTranscriptDraft] = useState('');
  const { showToast, toastState } = useToast();
  const [recordingLimitSeconds, setRecordingLimitSeconds] = useState(DEFAULT_APP_SETTINGS.recordingLimitSeconds);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCompositeKeys, setPendingCompositeKeys] = useState<Set<string>>(new Set());
  const [micLevel, setMicLevel] = useState(0);
  const [micDb, setMicDb] = useState<number | null>(null);
  const [activePlaybackAttemptTimestamp, setActivePlaybackAttemptTimestamp] = useState<string | null>(null);
  const [playbackPositionMillis, setPlaybackPositionMillis] = useState(0);
  const [playbackDurationMillis, setPlaybackDurationMillis] = useState(0);
  const [isPlaybackActive, setIsPlaybackActive] = useState(false);
  const [isSessionDropdownOpen, setIsSessionDropdownOpen] = useState(false);
  const [isQuestionDropdownOpen, setIsQuestionDropdownOpen] = useState(false);
  const [showPastAnswers, setShowPastAnswers] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [activeAttemptTabs, setActiveAttemptTabs] = useState<Record<string, AttemptEvaluationTabKey>>({});
  const [submittingAttemptTimestamps, setSubmittingAttemptTimestamps] = useState<Set<string>>(new Set());

  const recordingRef = useRef<Audio.Recording | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const loopbackWarnedRef = useRef(false);
  const saturatedCountRef = useRef(0);
  const abortDueToSaturationRef = useRef(false);
  const hadUsableMicInputRef = useRef(false);
  const lastUsableInputMsRef = useRef(0);
  const usableSampleStreakRef = useRef(0);
  const lastMeterDurationMsRef = useRef(0);

  const formatMillis = useCallback((value: number) => {
    const totalSeconds = Math.max(0, Math.floor(value / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  const useMetering = true;

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [activeSessionId, sessions]
  );

  const activeQuestions = useMemo(() => activeSession?.questionList.questions ?? [], [activeSession]);

  const activeQuestion = useMemo(() => {
    if (!activeQuestionValueKey) {
      return null;
    }

    return activeQuestions.find((question) => buildQuestionValueKey(question) === activeQuestionValueKey) ?? null;
  }, [activeQuestionValueKey, activeQuestions]);

  const sessionDropdownOptions = useMemo(
    () =>
      sessions.map((session) => ({
        key: session.id,
        label: toOneLinePreview(session.title, 72),
      })),
    [sessions]
  );

  const questionDropdownOptions = useMemo(
    () =>
      activeQuestions.map((question) => ({
        key: buildQuestionValueKey(question),
        label: `[${question.difficulty}][${question.category}] ${toOneLinePreview(question.value, 88)}`,
      })),
    [activeQuestions]
  );

  const getAttemptCompositeKey = useCallback(
    (attempt: Answer) => `${activeSessionId ?? ''}::${activeQuestionValueKey ?? ''}::${attempt.timestamp}`,
    [activeQuestionValueKey, activeSessionId]
  );

  const isAttemptPending = useCallback(
    (attempt: Answer) => pendingCompositeKeys.has(getAttemptCompositeKey(attempt)),
    [getAttemptCompositeKey, pendingCompositeKeys]
  );

  const refreshAttempts = useCallback(async () => {
    if (!activeSession || !activeQuestion) {
      setAttempts([]);
      return;
    }

    const nextAttempts = await listAttempts(activeSession.id, buildQuestionValueKey(activeQuestion));
    setAttempts(nextAttempts);
  }, [activeQuestion, activeSession]);

  const refreshPendingCount = useCallback(async () => {
    const items = await listPendingEvaluations();

    const next = new Set<string>();
    for (const item of items) {
      next.add(`${item.sessionId}::${item.questionValueKey}::${item.answerTimestamp}`);
    }
    setPendingCompositeKeys(next);
  }, []);

  const reloadPracticeState = useCallback(async () => {
    const [nextSessions, settings] = await Promise.all([listSessions(), getAppSettings()]);
    setSessions(nextSessions);
    setRecordingLimitSeconds(settings.recordingLimitSeconds);

    const preferredSessionId =
      activeSessionId && nextSessions.some((session) => session.id === activeSessionId)
        ? activeSessionId
        : settings.activeSessionId;

    const nextSessionId =
      preferredSessionId && nextSessions.some((session) => session.id === preferredSessionId)
        ? preferredSessionId
        : nextSessions[0]?.id ?? null;
    setActiveSessionId(nextSessionId);

    if (!nextSessionId) {
      setActiveQuestionValueKey(null);
      return;
    }

    const nextSession = nextSessions.find((session) => session.id === nextSessionId);
    if (!nextSession || nextSession.questionList.questions.length === 0) {
      setActiveQuestionValueKey(null);
      return;
    }

    const currentIsValid = nextSession.questionList.questions.some(
      (question) => buildQuestionValueKey(question) === activeQuestionValueKey
    );

    if (!currentIsValid) {
      setActiveQuestionValueKey(buildQuestionValueKey(nextSession.questionList.questions[0]));
    }
  }, [activeQuestionValueKey, activeSessionId]);

  useEffect(() => {
    void reloadPracticeState();
    void refreshPendingCount();
  }, [reloadPracticeState, refreshPendingCount]);

  useFocusEffect(
    useCallback(() => {
      void reloadPracticeState();
      void refreshPendingCount();
      return undefined;
    }, [reloadPracticeState, refreshPendingCount])
  );

  useEffect(() => {
    void refreshAttempts();
  }, [refreshAttempts]);

  useEffect(() => {
    let mounted = true;

    async function hydrateNetwork() {
      const state = await Network.getNetworkStateAsync();
      if (mounted) {
        setIsOnline(Boolean(state.isConnected));
      }
    }

    void hydrateNetwork();

    const subscription = Network.addNetworkStateListener((nextState) => {
      setIsOnline(Boolean(nextState.isConnected));
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    async function retryPending() {
      const processed = await processPendingEvaluations(isOnline);
      if (processed > 0) {
        showToast(`Auto-evaluated ${processed} pending attempt(s) after reconnect.`, 'success');
        await reloadPracticeState();
        await refreshAttempts();
      }
      await refreshPendingCount();
    }

    void retryPending();
  }, [isOnline, refreshAttempts, refreshPendingCount, reloadPracticeState]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (soundRef.current) {
        void soundRef.current.unloadAsync();
      }
    };
  }, []);

  const stopRecording = useCallback(async () => {
    const recording = recordingRef.current;
    if (!recording || !activeSession || !activeQuestion) {
      setIsRecording(false);
      setMicLevel(0);
      setMicDb(null);
      abortDueToSaturationRef.current = false;
      return;
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    recording.setOnRecordingStatusUpdate(null);
    await recording.stopAndUnloadAsync();
    recordingRef.current = null;

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });

    const uri = recording.getURI();
    const latestMicDb = micDb;
    const hadUsableInput = hadUsableMicInputRef.current;
    const saturatedSampleCount = saturatedCountRef.current;
    const shouldDiscardSaturated =
      useMetering &&
      !hadUsableInput &&
      recordingSeconds >= 2 &&
      (saturatedSampleCount >= 4 || (typeof latestMicDb === 'number' && latestMicDb > -2));

    setIsRecording(false);
    setMicLevel(0);
    setMicDb(null);
    loopbackWarnedRef.current = false;

    if (!uri) {
      showToast('Recording failed to produce an audio file.', 'warning');
      return;
    }

    if (abortDueToSaturationRef.current || shouldDiscardSaturated) {
      abortDueToSaturationRef.current = false;
      showToast('Recording discarded due to saturated mic input (beep/loopback detected).', 'warning');
      setRecordingSeconds(0);
      saturatedCountRef.current = 0;
      hadUsableMicInputRef.current = false;
      lastUsableInputMsRef.current = 0;
      usableSampleStreakRef.current = 0;
      lastMeterDurationMsRef.current = 0;
      return;
    }

    if (!enforceRecordingLimit(recordingSeconds, recordingLimitSeconds)) {
      showToast(`Recording exceeded limit of ${recordingLimitSeconds} seconds and was discarded.`, 'warning');
      setRecordingSeconds(0);
      return;
    }

    await appendAttempt({
      sessionId: activeSession.id,
      questionValueKey: buildQuestionValueKey(activeQuestion),
      transcript: transcriptDraft.trim() || `Attempt recorded at ${new Date().toLocaleTimeString()}`,
      audioFilePath: uri,
    });

    showToast(`Attempt saved locally (${recordingSeconds}s). Submit to evaluate.`, 'success');
    saturatedCountRef.current = 0;
    hadUsableMicInputRef.current = false;
    lastUsableInputMsRef.current = 0;
    usableSampleStreakRef.current = 0;
    lastMeterDurationMsRef.current = 0;
    setRecordingSeconds(0);
    await reloadPracticeState();
    await refreshAttempts();
  }, [
    activeQuestion,
    activeSession,
    micDb,
    recordingLimitSeconds,
    recordingSeconds,
    reloadPracticeState,
    refreshAttempts,
    transcriptDraft,
    useMetering,
  ]);

  const startRecording = useCallback(async () => {
    if (!activeSession || !activeQuestion) {
      showToast('Create a session in Prepare first.', 'warning');
      return;
    }

    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) {
      showToast('Microphone permission is required to record attempts.', 'warning');
      return;
    }

    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
      setActivePlaybackAttemptTimestamp(null);
      setPlaybackPositionMillis(0);
      setPlaybackDurationMillis(0);
      setIsPlaybackActive(false);
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: false,
    });

    const recording = new Audio.Recording();
    const recordingOptions = {
      ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
      ios: {
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY.ios,
        isMeteringEnabled: useMetering,
      },
      android: {
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
        keepAudioActiveHint: true,
        isMeteringEnabled: useMetering,
      },
    };

    recording.setProgressUpdateInterval(200);

    await recording.prepareToRecordAsync(recordingOptions);
    await recording.startAsync();
    recordingRef.current = recording;
    setRecordingSeconds(0);
    setMicLevel(0);
    setMicDb(null);
    saturatedCountRef.current = 0;
    abortDueToSaturationRef.current = false;
    hadUsableMicInputRef.current = false;
    lastUsableInputMsRef.current = 0;
    usableSampleStreakRef.current = 0;
    lastMeterDurationMsRef.current = 0;
    loopbackWarnedRef.current = false;
    setIsRecording(true);
    showToast(`Recording... cap ${recordingLimitSeconds}s.`, 'info');

    if (useMetering) {
      recording.setOnRecordingStatusUpdate((nextStatus) => {
        if (!nextStatus.isRecording || typeof nextStatus.metering !== 'number') {
          return;
        }

        const db = nextStatus.metering;
        setMicDb(db);
        lastMeterDurationMsRef.current = nextStatus.durationMillis;

        if (db > -2) {
          saturatedCountRef.current += 1;
          setMicLevel((previous) => previous * 0.8 + 0.2 * 0.2);
          if (!loopbackWarnedRef.current) {
            loopbackWarnedRef.current = true;
          }

          if (
            !hadUsableMicInputRef.current &&
            nextStatus.durationMillis >= 2500 &&
            saturatedCountRef.current >= 12 &&
            !abortDueToSaturationRef.current
          ) {
            abortDueToSaturationRef.current = true;
            showToast('Mic input saturated. Stopping and discarding this recording.', 'warning');
            void stopRecording();
          }
          return;
        }

        saturatedCountRef.current = 0;
        const looksLikeSpeech = db >= -55 && db <= -6;
        if (looksLikeSpeech) {
          usableSampleStreakRef.current += 1;
          if (usableSampleStreakRef.current >= 2) {
            hadUsableMicInputRef.current = true;
            lastUsableInputMsRef.current = nextStatus.durationMillis;
          }
        } else {
          usableSampleStreakRef.current = 0;
        }

        loopbackWarnedRef.current = false;
        const floorDb = -60;
        const ceilDb = -10;
        const clamped = Math.min(ceilDb, Math.max(floorDb, db));
        const normalized = (clamped - floorDb) / (ceilDb - floorDb);
        setMicLevel((previous) => previous * 0.7 + normalized * 0.3);
      });
    }

    intervalRef.current = setInterval(() => {
      setRecordingSeconds((seconds) => {
        const next = seconds + 1;
        if (next >= recordingLimitSeconds) {
          void stopRecording();
        }
        return next;
      });
    }, 1000);
  }, [activeQuestion, activeSession, recordingLimitSeconds, stopRecording, useMetering]);

  const onSubmitAttempt = useCallback(
    async (attempt: Answer) => {
      if (!activeSession || !activeQuestion) {
        return;
      }

      if (submittingAttemptTimestamps.has(attempt.timestamp)) {
        return;
      }

      const fallbackTranscript = transcriptDraft.trim() || `Recorded answer at ${attempt.timestamp}`;
      setSubmittingAttemptTimestamps((current) => new Set(current).add(attempt.timestamp));

      try {
        const result = await submitAttemptForEvaluation({
          sessionId: activeSession.id,
          questionValueKey: buildQuestionValueKey(activeQuestion),
          answerTimestamp: attempt.timestamp,
          transcript: fallbackTranscript,
          isOnline,
        });

        showToast(result === 'pending' ? 'Attempt queued for evaluation (offline).' : 'Attempt evaluated online.', result === 'pending' ? 'info' : 'success');
        await refreshAttempts();
        await refreshPendingCount();
      } catch {
        showToast('Attempt could not be submitted. Try again.', 'warning');
      } finally {
        setSubmittingAttemptTimestamps((current) => {
          const next = new Set(current);
          next.delete(attempt.timestamp);
          return next;
        });
      }
    },
    [activeQuestion, activeSession, isOnline, refreshAttempts, refreshPendingCount, submittingAttemptTimestamps, transcriptDraft]
  );

  const onToggleAttemptPlayback = useCallback(
    async (attemptTimestamp: string, uri: string | null) => {
      if (!uri) {
        showToast('No local recording for this attempt.', 'warning');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      if (activePlaybackAttemptTimestamp === attemptTimestamp && soundRef.current) {
        const currentStatus = await soundRef.current.getStatusAsync();
        if (currentStatus.isLoaded && currentStatus.isPlaying) {
          await soundRef.current.pauseAsync();
          showToast('Playback paused.', 'info');
          return;
        }

        if (currentStatus.isLoaded) {
          const hasReachedEnd =
            typeof currentStatus.durationMillis === 'number' &&
            currentStatus.durationMillis > 0 &&
            currentStatus.positionMillis >= currentStatus.durationMillis - 250;

          if (hasReachedEnd) {
            await soundRef.current.setPositionAsync(0);
            setPlaybackPositionMillis(0);
          }

          await soundRef.current.playAsync();
          showToast(hasReachedEnd ? 'Replaying local recording.' : 'Playing local recording.', 'info');
          return;
        }
      }

      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      const { sound, status: initialStatus } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true },
        (nextStatus) => {
          if (!nextStatus.isLoaded) {
            return;
          }

          setPlaybackPositionMillis(nextStatus.positionMillis);
          setPlaybackDurationMillis(nextStatus.durationMillis ?? 0);
          setIsPlaybackActive(nextStatus.isPlaying);

          if (nextStatus.didJustFinish) {
            setIsPlaybackActive(false);
            setPlaybackPositionMillis(0);
            showToast('Playback finished.', 'info');
          }
        }
      );

      soundRef.current = sound;
      setActivePlaybackAttemptTimestamp(attemptTimestamp);
      setPlaybackPositionMillis(initialStatus.isLoaded ? initialStatus.positionMillis : 0);
      setPlaybackDurationMillis(initialStatus.isLoaded ? (initialStatus.durationMillis ?? 0) : 0);
      setIsPlaybackActive(true);

      if (initialStatus.isLoaded && initialStatus.durationMillis && initialStatus.durationMillis > 0) {
        showToast(`Playing local recording (${formatMillis(initialStatus.durationMillis)}).`, 'info');
        return;
      }

      showToast('Playing local recording.', 'info');
    },
    [activePlaybackAttemptTimestamp, formatMillis]
  );

  const onSeekPlayback = useCallback(
    async (value: number) => {
      if (!soundRef.current || activePlaybackAttemptTimestamp === null) {
        return;
      }

      await soundRef.current.setPositionAsync(Math.floor(value));
      setPlaybackPositionMillis(Math.floor(value));
    },
    [activePlaybackAttemptTimestamp]
  );

  const onToggleRecording = useCallback(() => {
    if (isRecording) {
      void stopRecording();
      return;
    }

    void startRecording();
  }, [isRecording, startRecording, stopRecording]);

  const onDeleteAttempt = useCallback(
    async (attempt: Answer) => {
      if (!activeSession || !activeQuestion) {
        return;
      }

      if (attempt.evaluation || isAttemptPending(attempt)) {
        showToast('Only non-submitted attempts can be deleted.', 'warning');
        return;
      }

      const wasDeleted = await deleteAttempt({
        sessionId: activeSession.id,
        questionValueKey: buildQuestionValueKey(activeQuestion),
        answerTimestamp: attempt.timestamp,
      });

      if (!wasDeleted) {
        showToast('Attempt could not be deleted.', 'warning');
        return;
      }

      if (activePlaybackAttemptTimestamp === attempt.timestamp && soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
        setActivePlaybackAttemptTimestamp(null);
        setPlaybackPositionMillis(0);
        setPlaybackDurationMillis(0);
        setIsPlaybackActive(false);
      }

      showToast('Attempt deleted.', 'success');
      await refreshAttempts();
      await refreshPendingCount();
    },
    [
      activePlaybackAttemptTimestamp,
      activeQuestion,
      activeSession,
      isAttemptPending,
      refreshAttempts,
      refreshPendingCount,
    ]
  );

  const onSelectSession = useCallback((sessionId: string) => {
    const nextSession = sessions.find((session) => session.id === sessionId);
    setActiveSessionId(sessionId);
    setActiveQuestionValueKey(nextSession?.questionList.questions[0] ? buildQuestionValueKey(nextSession.questionList.questions[0]) : null);
    setShowPastAnswers(false);
    setActiveAttemptTabs({});

    void patchAppSettings({ activeSessionId: sessionId });
  }, [sessions]);

  const onSelectQuestion = useCallback((questionValueKey: string) => {
    setActiveQuestionValueKey(questionValueKey);
    setShowPastAnswers(false);
    setActiveAttemptTabs({});
  }, []);

  const onPickRandomQuestion = useCallback(() => {
    if (!activeSession || activeSession.questionList.questions.length === 0) {
      return;
    }

    const sessionQuestionKeys = activeSession.questionList.questions.map((question) => buildQuestionValueKey(question));
    const usedForSession = randomCycleBySession[activeSession.id] ?? [];

    const remaining = sessionQuestionKeys.filter((key) => !usedForSession.includes(key));
    const cyclePool = remaining.length > 0 ? remaining : sessionQuestionKeys;
    const nextQuestionKey = pickRandom(cyclePool);

    setActiveQuestionValueKey(nextQuestionKey);

    setRandomCycleBySession((current) => {
      const existingUsed = current[activeSession.id] ?? [];
      const nextUsed = remaining.length > 0 ? [...existingUsed, nextQuestionKey] : [nextQuestionKey];
      return {
        ...current,
        [activeSession.id]: nextUsed,
      };
    });
  }, [activeSession, randomCycleBySession]);

  return (
    <View style={styles.screenWrapper}>
    <AppScreen
      title="Practice"
      subtitle="Run mock interview questions and capture answer attempts with recording controls."
      excludeBottomSafeArea
      contentBottomPadding={contentBottomPadding}>
      {sessions.length === 0 ? (
        <AppCard title="No Sessions Yet">
          <Text style={styles.emptyHeadline} testID="practice-no-sessions-headline">No sessions yet</Text>
          <Text style={styles.bodyText} testID="practice-no-sessions-body">
            Generate a session in Prepare to start practising.
          </Text>
          <AppButton
            label="Go to Prepare"
            testID="practice-no-sessions-cta"
            onPress={() => router.push('/(tabs)')}
            variant="ghost"
          />
        </AppCard>
      ) : (
        <>
      <AppCard title="Session + Question Selection">
        <Text style={styles.metaText}>Session</Text>
        <Pressable testID="practice-session-dropdown-trigger" style={styles.dropdownTrigger} onPress={() => setIsSessionDropdownOpen(true)}>
          <Text style={styles.dropdownTriggerText}>
            {activeSession ? toOneLinePreview(activeSession.title, 72) : 'Select a session'}
          </Text>
          <IconSymbol name="chevron.down" size={14} color={AppTheme.colors.textMuted} />
        </Pressable>

        <View style={styles.questionSubsection}>
          <View style={styles.questionSectionHeader}>
            <Text style={styles.metaText}>Question</Text>
            <Pressable
              testID="practice-random-question-icon-button"
              accessibilityLabel="Pick random question"
              onPress={onPickRandomQuestion}
              style={styles.shuffleButton}
              disabled={!activeSession || questionDropdownOptions.length === 0}>
              <IconSymbol name="shuffle" size={16} color={AppTheme.colors.textMuted} />
            </Pressable>
          </View>
          <Pressable
            testID="practice-question-dropdown-trigger"
            style={styles.dropdownTrigger}
            onPress={() => setIsQuestionDropdownOpen(true)}
            disabled={!activeSession || questionDropdownOptions.length === 0}>
            <Text style={styles.dropdownTriggerText}>
              {activeQuestion ? toOneLinePreview(activeQuestion.value, 96) : 'Select a question'}
            </Text>
            <IconSymbol name="chevron.down" size={14} color={AppTheme.colors.textMuted} />
          </Pressable>
        </View>
      </AppCard>

      <SelectorDropdown
        visible={isSessionDropdownOpen}
        title="Select Session"
        options={sessionDropdownOptions}
        selectedKey={activeSessionId}
        onSelect={onSelectSession}
        onClose={() => setIsSessionDropdownOpen(false)}
        optionTestIDPrefix="practice-dropdown"
      />

      <SelectorDropdown
        visible={isQuestionDropdownOpen}
        title="Select Question"
        options={questionDropdownOptions}
        selectedKey={activeQuestionValueKey}
        onSelect={onSelectQuestion}
        onClose={() => setIsQuestionDropdownOpen(false)}
        optionTestIDPrefix="practice-dropdown"
      />

      <AppCard title="Selected Question Details">
        {activeQuestion ? (
          <View style={styles.questionCard} testID="practice-selected-question-details">
            <Text style={styles.questionDetailTitle} testID="practice-selected-question-full-text">{activeQuestion.value}</Text>
            <View style={styles.questionMetaRow}>
              <View style={styles.questionMetaBadge} testID="practice-selected-question-category-badge">
                <Text style={styles.questionMetaBadgeText}>{`Category: ${activeQuestion.category}`}</Text>
              </View>
              <View style={styles.questionMetaBadge} testID="practice-selected-question-difficulty-badge">
                <Text style={styles.questionMetaBadgeText}>{`Difficulty: ${activeQuestion.difficulty}`}</Text>
              </View>
            </View>

            {isRecording ? (
              <View testID="practice-mic-meter" style={styles.meterRow}>
                <Text style={styles.metaText}>Mic Level</Text>
                <View style={styles.meterTrack}>
                  <View style={[styles.meterFill, { width: `${Math.max(4, Math.round(micLevel * 100))}%` }]} />
                </View>
                <Text style={styles.metaText}>{micDb !== null ? `${Math.round(micDb)} dB` : 'n/a'}</Text>
              </View>
            ) : null}

            {isRecording ? (
              <View testID="practice-recording-timer" style={styles.recordingTimerRow}>
                <Text style={styles.recordingTimerText}>
                  {formatSeconds(recordingSeconds)} / {formatSeconds(recordingLimitSeconds)}
                </Text>
                <View style={styles.recordingTimerTrack}>
                  <View style={[styles.recordingTimerFill, { width: `${Math.min(100, Math.round((recordingSeconds / recordingLimitSeconds) * 100))}%` }]} />
                </View>
              </View>
            ) : null}

            <View
              style={isRecording ? styles.recordingActiveWrapper : null}
              testID={isRecording ? 'practice-recording-button-active' : undefined}>
              <AppButton
                label={isRecording ? 'Stop Recording' : 'Start Recording'}
                onPress={onToggleRecording}
                variant={isRecording ? 'ghost' : 'primary'}
              />
            </View>

            <AppButton
              label={showNotes ? 'Hide notes' : 'Add notes'}
              onPress={() => setShowNotes((v) => !v)}
              testID="practice-add-notes-button"
              variant="ghost"
            />
            {showNotes ? (
              <AppInput
                multiline
                numberOfLines={3}
                onChangeText={setTranscriptDraft}
                placeholder="Optional notes used as candidate answer text when submitting"
                testID="practice-notes-input"
                value={transcriptDraft}
              />
            ) : transcriptDraft ? (
              <Pressable testID="practice-notes-summary" onPress={() => setShowNotes(true)} style={styles.notesSummaryRow}>
                <Text style={styles.notesSummaryText} numberOfLines={1}>{toOneLinePreview(transcriptDraft)}</Text>
                <IconSymbol name="pencil" size={12} color={AppTheme.colors.textMuted} />
              </Pressable>
            ) : null}

          </View>
        ) : (
          <Text style={styles.bodyText}>Select a question to view full details.</Text>
        )}
      </AppCard>

      <AppCard title="Past Answers">
        {activeQuestion ? (
          <>
            <View style={styles.pastAnswersHeaderRow}>
              <Text style={styles.bodyText}>{`Count: ${attempts.length}`}</Text>
              <Pressable testID="practice-past-answers-toggle" onPress={() => setShowPastAnswers((value) => !value)}>
                <View style={showPastAnswers ? styles.chevronRotated : null}>
                  <IconSymbol name="chevron.right" size={16} color={AppTheme.colors.textMuted} />
                </View>
              </Pressable>
            </View>

            {showPastAnswers ? (
              <View style={styles.collapsibleBody} testID="practice-past-answers-content">
                {attempts.length === 0 ? <Text style={styles.bodyText}>No attempts yet for this question.</Text> : null}
                {attempts.map((attempt, index) => {
                  const isPending = isAttemptPending(attempt);
                  const isSubmitted = Boolean(attempt.evaluation) || isPending;
                  const attemptStatus = attempt.evaluation ? 'completed' : isPending ? 'pending' : 'draft';
                  const attemptNumber = attempts.length - index;
                  const activeTab = activeAttemptTabs[attempt.timestamp] ?? 'candidate_answer';
                  const hasAttemptAudio = Boolean(attempt.audio_file_path);
                  const isActivePlaybackAttempt = activePlaybackAttemptTimestamp === attempt.timestamp;
                  const attemptPlaybackPosition = isActivePlaybackAttempt ? playbackPositionMillis : 0;
                  const attemptPlaybackDuration = isActivePlaybackAttempt ? playbackDurationMillis : 0;
                  const isAttemptSubmitting = submittingAttemptTimestamps.has(attempt.timestamp);

                  return (
                    <View key={attempt.timestamp} style={styles.attemptRow} testID={`practice-attempt-row-${attempt.timestamp}`}>
                      <View style={styles.attemptHeaderRow}>
                        <Text style={styles.attemptTitle} testID={`practice-attempt-title-${attempt.timestamp}`}>{`Attempt #${attemptNumber}`}</Text>
                        {attempt.evaluation ? (
                          <View style={styles.scoreBadge} testID={`practice-attempt-score-badge-${attempt.timestamp}`}>
                            <Text style={styles.scoreBadgeText}>{`${attempt.evaluation.score}/10`}</Text>
                          </View>
                        ) : null}
                        <View style={styles.attemptStatusBadge} testID={`practice-attempt-status-${attempt.timestamp}`}>
                          <IconSymbol name={getAttemptStatusIconName(attemptStatus)} size={16} color={getAttemptStatusColor(attemptStatus)} />
                          <Text style={styles.metaText}>{attemptStatus}</Text>
                        </View>
                      </View>
                      <Text style={styles.metaText}>{formatAttemptTimestamp(attempt.timestamp)}</Text>
                      <View style={styles.buttonRow}>
                        {!isSubmitted ? (
                          <AppButton
                            label="Submit"
                            onPress={() => onSubmitAttempt(attempt)}
                            loading={isAttemptSubmitting}
                            disabled={isAttemptSubmitting}
                            testID={`practice-attempt-submit-${attempt.timestamp}`}
                          />
                        ) : null}
                        {!isSubmitted ? <AppButton label="Delete" onPress={() => onDeleteAttempt(attempt)} variant="ghost" /> : null}
                      </View>
                      {attempt.evaluation ? (
                        <View style={styles.evaluationPanel}>
                          <View style={styles.evaluationTabRow}>
                            {ATTEMPT_EVALUATION_TABS.map((tab) => {
                              const selected = tab.key === activeTab;
                              return (
                                <Pressable
                                  key={tab.key}
                                  testID={`practice-attempt-tab-${attempt.timestamp}-${tab.key}`}
                                  onPress={() => {
                                    setActiveAttemptTabs((current) => ({
                                      ...current,
                                      [attempt.timestamp]: tab.key,
                                    }));
                                  }}
                                  style={[styles.evaluationTabButton, selected ? styles.evaluationTabButtonActive : null]}>
                                  <Text numberOfLines={1} style={[styles.evaluationTabText, selected ? styles.evaluationTabTextActive : null]}>{tab.label}</Text>
                                </Pressable>
                              );
                            })}
                          </View>
                          <ScrollView style={styles.evaluationTabPanel} testID={`practice-attempt-tab-panel-${attempt.timestamp}`} nestedScrollEnabled>
                            {activeTab === 'candidate_answer' ? <Text style={styles.bodyText}>{attempt.evaluation.candidate_answer}</Text> : null}
                            {activeTab === 'feedback' ? <Text style={styles.bodyText}>{attempt.evaluation.feedback}</Text> : null}
                            {activeTab === 'model_answer' ? <Text style={styles.bodyText}>{attempt.evaluation.model_answer}</Text> : null}
                            {activeTab === 'gaps_identified' ? (
                              attempt.evaluation.gaps_identified.length > 0 ? (
                                <View style={styles.gapList}>
                                  {attempt.evaluation.gaps_identified.map((gap, gapIndex) => (
                                    <Text key={`${attempt.timestamp}-gap-${gapIndex.toString()}`} style={styles.bodyText}>{`• ${gap}`}</Text>
                                  ))}
                                </View>
                              ) : (
                                <Text style={styles.bodyText}>No gaps identified.</Text>
                              )
                            ) : null}
                          </ScrollView>
                        </View>
                      ) : null}
                      {hasAttemptAudio ? (
                        <View
                          style={[styles.playbackPanel, !isActivePlaybackAttempt ? styles.playbackPanelInactive : null]}
                          testID={`practice-attempt-playback-panel-${attempt.timestamp}`}>
                          <View style={styles.playbackControlRow}>
                            <Pressable
                              accessibilityLabel={activePlaybackAttemptTimestamp === attempt.timestamp && isPlaybackActive ? 'Pause attempt playback' : 'Play attempt playback'}
                              onPress={() => onToggleAttemptPlayback(attempt.timestamp, attempt.audio_file_path)}
                              style={styles.attemptPlaybackButton}
                              testID={`practice-attempt-playback-${attempt.timestamp}`}>
                              <IconSymbol
                                name={getAttemptPlaybackIconName(isActivePlaybackAttempt && isPlaybackActive)}
                                size={20}
                                color={AppTheme.colors.textPrimary}
                              />
                            </Pressable>
                            <Slider
                              style={styles.playbackSlider}
                              disabled={!isActivePlaybackAttempt}
                              minimumValue={0}
                              maximumValue={Math.max(attemptPlaybackDuration, 1)}
                              value={Math.min(attemptPlaybackPosition, Math.max(attemptPlaybackDuration, 1))}
                              onSlidingComplete={onSeekPlayback}
                              minimumTrackTintColor={AppTheme.colors.accent}
                              maximumTrackTintColor={AppTheme.colors.borderStrong}
                              thumbTintColor={AppTheme.colors.accent}
                            />
                          </View>
                          <View style={styles.playbackTimesRow}>
                            <Text style={styles.metaText}>{formatMillis(attemptPlaybackPosition)}</Text>
                            <Text style={styles.metaText}>{formatMillis(attemptPlaybackDuration)}</Text>
                          </View>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : null}
          </>
        ) : (
          <Text style={styles.bodyText}>Select a question to review previous attempts.</Text>
        )}
      </AppCard>
        </>
      )}
    </AppScreen>
    <ToastContainer toastState={toastState} />
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
  },
  emptyHeadline: {
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.typography.headingFamily,
    fontSize: 20,
    textTransform: 'uppercase',
  },
  bodyText: {
    color: AppTheme.colors.textSecondary,
    fontFamily: AppTheme.typography.bodyFamily,
    fontSize: 15,
    lineHeight: 22,
  },
  metaText: {
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.typography.monoFamily,
    fontSize: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: AppTheme.spacing.sm,
  },
  dropdownTrigger: {
    borderWidth: 1,
    borderColor: AppTheme.colors.borderStrong,
    backgroundColor: AppTheme.colors.surfaceSecondary,
    paddingHorizontal: AppTheme.spacing.sm,
    paddingVertical: AppTheme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: AppTheme.spacing.sm,
  },
  dropdownTriggerText: {
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.typography.bodyFamily,
    fontSize: 14,
    flex: 1,
  },
  selectorWrap: {
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
  },
  choiceChipSelected: {
    borderColor: AppTheme.colors.accent,
  },
  choiceText: {
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.typography.bodyFamily,
    fontSize: 12,
  },
  choiceTextSelected: {
    color: AppTheme.colors.textPrimary,
  },
  questionCard: {
    gap: AppTheme.spacing.xs,
  },
  pastAnswersHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chevronRotated: {
    transform: [{ rotate: '90deg' }],
  },
  collapsibleBody: {
    gap: AppTheme.spacing.sm,
  },
  questionDetailTitle: {
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.typography.headingFamily,
    fontSize: 24,
    lineHeight: 30,
  },
  questionMetaRow: {
    flexDirection: 'row',
    gap: AppTheme.spacing.xs,
    flexWrap: 'wrap',
  },
  questionMetaBadge: {
    paddingHorizontal: AppTheme.spacing.xs,
    paddingVertical: AppTheme.spacing.xxs,
    borderWidth: 1,
    borderColor: AppTheme.colors.borderSubtle,
    backgroundColor: AppTheme.colors.surfacePrimary,
  },
  questionMetaBadgeText: {
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.typography.monoFamily,
    fontSize: 12,
  },
  attemptRow: {
    borderWidth: 1,
    borderColor: AppTheme.colors.borderSubtle,
    backgroundColor: AppTheme.colors.surfaceSecondary,
    padding: AppTheme.spacing.sm,
    gap: AppTheme.spacing.xs,
  },
  attemptTitle: {
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.typography.headingFamily,
    fontSize: 17,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  attemptHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: AppTheme.spacing.xs,
  },
  attemptStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppTheme.spacing.xxs,
    paddingHorizontal: AppTheme.spacing.xs,
    paddingVertical: AppTheme.spacing.xxs,
    borderWidth: 1,
    borderColor: AppTheme.colors.borderSubtle,
    backgroundColor: AppTheme.colors.surfacePrimary,
    flexShrink: 0,
  },
  attemptPlaybackButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AppTheme.colors.borderStrong,
    backgroundColor: AppTheme.colors.surfacePrimary,
  },
  scoreBadge: {
    paddingHorizontal: AppTheme.spacing.xs,
    paddingVertical: AppTheme.spacing.xxs,
    borderWidth: 1,
    borderColor: AppTheme.colors.success,
    backgroundColor: AppTheme.colors.surfacePrimary,
  },
  scoreBadgeText: {
    color: AppTheme.colors.success,
    fontFamily: AppTheme.typography.monoFamily,
    fontSize: 12,
  },
  recordingActiveWrapper: {
    borderWidth: 1,
    borderColor: AppTheme.colors.warning,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },
  recordingTimerRow: {
    gap: AppTheme.spacing.xs,
  },
  recordingTimerText: {
    color: AppTheme.colors.accent,
    fontFamily: AppTheme.typography.monoFamily,
    fontSize: 13,
  },
  recordingTimerTrack: {
    height: 4,
    backgroundColor: AppTheme.colors.borderStrong,
  },
  recordingTimerFill: {
    height: '100%',
    backgroundColor: AppTheme.colors.accent,
  },
  questionSubsection: {
    backgroundColor: AppTheme.colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: AppTheme.colors.borderSubtle,
    padding: AppTheme.spacing.xs,
    gap: AppTheme.spacing.xs,
  },
  questionSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shuffleButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppTheme.spacing.xs,
    borderWidth: 1,
    borderColor: AppTheme.colors.borderSubtle,
    backgroundColor: AppTheme.colors.surfaceSecondary,
    paddingHorizontal: AppTheme.spacing.sm,
    paddingVertical: AppTheme.spacing.xs,
  },
  notesSummaryText: {
    flex: 1,
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.typography.bodyFamily,
    fontSize: 13,
  },
  evaluationPanel: {
    gap: AppTheme.spacing.sm,
  },
  evaluationTabRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    borderBottomWidth: 1,
    borderBottomColor: AppTheme.colors.borderStrong,
  },
  evaluationTabButton: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppTheme.colors.surfacePrimary,
    paddingHorizontal: AppTheme.spacing.xs,
    paddingVertical: AppTheme.spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  evaluationTabButtonActive: {
    borderBottomColor: AppTheme.colors.accent,
    backgroundColor: AppTheme.colors.surfaceTertiary,
  },
  evaluationTabText: {
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.typography.bodyFamily,
    fontSize: 10,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  evaluationTabTextActive: {
    color: AppTheme.colors.textPrimary,
  },
  evaluationTabPanel: {
    borderWidth: 1,
    borderColor: AppTheme.colors.borderSubtle,
    backgroundColor: AppTheme.colors.surfacePrimary,
    padding: AppTheme.spacing.sm,
    maxHeight: 220,
  },
  gapList: {
    gap: AppTheme.spacing.xs,
  },
  playbackPanel: {
    gap: AppTheme.spacing.xs,
  },
  playbackControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppTheme.spacing.xs,
  },
  playbackSlider: {
    flex: 1,
  },
  playbackPanelInactive: {
    opacity: 0.72,
  },
  playbackTimesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  meterRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: AppTheme.spacing.sm,
  },
  meterTrack: {
    backgroundColor: AppTheme.colors.borderStrong,
    flex: 1,
    height: 8,
  },
  meterFill: {
    backgroundColor: AppTheme.colors.accent,
    height: '100%',
  },
});
import Slider from '@react-native-community/slider';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { Audio } from 'expo-av';
import * as Network from 'expo-network';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppCard } from '@/components/ui/app-card';
import { AppInput } from '@/components/ui/app-input';
import { AppScreen } from '@/components/ui/app-screen';
import { IconSymbol } from '@/components/ui/icon-symbol';
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
import { getAppSettings } from '@/lib/repositories/settings-repository';

type AttemptEvaluationTabKey = 'candidate_answer' | 'feedback' | 'gaps_identified' | 'model_answer';

const ATTEMPT_EVALUATION_TABS: { key: AttemptEvaluationTabKey; label: string }[] = [
  { key: 'candidate_answer', label: 'Candidate' },
  { key: 'feedback', label: 'Feedback' },
  { key: 'gaps_identified', label: 'Gaps' },
  { key: 'model_answer', label: 'Model' },
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

interface DropdownOption {
  key: string;
  label: string;
}

interface SelectorDropdownProps {
  visible: boolean;
  title: string;
  options: DropdownOption[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onClose: () => void;
}

function SelectorDropdown({ visible, title, options, selectedKey, onSelect, onClose }: SelectorDropdownProps) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.dropdownBackdrop} onPress={onClose} testID={`practice-dropdown-backdrop-${title.replace(/\s+/g, '-').toLowerCase()}`}>
        <View style={styles.dropdownPanel}>
          <Text style={styles.dropdownTitle} testID={`practice-dropdown-title-${title.replace(/\s+/g, '-').toLowerCase()}`}>{title}</Text>
          <ScrollView style={styles.dropdownList}>
            {options.map((option) => {
              const selected = option.key === selectedKey;
              return (
                <Pressable
                  key={option.key}
                  testID={`practice-dropdown-option-${option.key}`}
                  onPress={() => {
                    onSelect(option.key);
                    onClose();
                  }}
                  style={[styles.dropdownRow, selected ? styles.dropdownRowSelected : null]}>
                  <Text style={[styles.dropdownText, selected ? styles.dropdownTextSelected : null]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

export default function PracticeScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const contentBottomPadding = tabBarHeight;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeQuestionValueKey, setActiveQuestionValueKey] = useState<string | null>(null);
  const [randomCycleBySession, setRandomCycleBySession] = useState<Record<string, string[]>>({});
  const [attempts, setAttempts] = useState<Answer[]>([]);
  const [transcriptDraft, setTranscriptDraft] = useState('');
  const [status, setStatus] = useState('');
  const [recordingLimitSeconds, setRecordingLimitSeconds] = useState(DEFAULT_APP_SETTINGS.recordingLimitSeconds);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
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
        label: toOneLinePreview(question.value, 96),
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
    setPendingCount(items.length);

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

    const nextSessionId =
      activeSessionId && nextSessions.some((session) => session.id === activeSessionId)
        ? activeSessionId
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
        setStatus(`Auto-evaluated ${processed} pending attempt(s) after reconnect.`);
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
      setStatus('Recording failed to produce an audio file.');
      return;
    }

    if (abortDueToSaturationRef.current || shouldDiscardSaturated) {
      abortDueToSaturationRef.current = false;
      setStatus('Recording discarded due to saturated mic input (beep/loopback detected).');
      setRecordingSeconds(0);
      saturatedCountRef.current = 0;
      hadUsableMicInputRef.current = false;
      lastUsableInputMsRef.current = 0;
      usableSampleStreakRef.current = 0;
      lastMeterDurationMsRef.current = 0;
      return;
    }

    if (!enforceRecordingLimit(recordingSeconds, recordingLimitSeconds)) {
      setStatus(`Recording exceeded limit of ${recordingLimitSeconds} seconds and was discarded.`);
      setRecordingSeconds(0);
      return;
    }

    await appendAttempt({
      sessionId: activeSession.id,
      questionValueKey: buildQuestionValueKey(activeQuestion),
      transcript: transcriptDraft.trim() || `Attempt recorded at ${new Date().toLocaleTimeString()}`,
      audioFilePath: uri,
    });

    setStatus(`Attempt saved locally (${recordingSeconds}s). Submit to evaluate.`);
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
      setStatus('Create a session in Prepare first.');
      return;
    }

    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) {
      setStatus('Microphone permission is required to record attempts.');
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
    setStatus(`Recording... cap ${recordingLimitSeconds}s.`);

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
            setStatus('Mic input saturated. Stopping and discarding this recording.');
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

        setStatus(result === 'pending' ? 'Attempt queued for evaluation (offline).' : 'Attempt evaluated online.');
        await refreshAttempts();
        await refreshPendingCount();
      } catch {
        setStatus('Attempt could not be submitted. Try again.');
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
        setStatus('No local recording for this attempt.');
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
          setStatus('Playback paused.');
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
          setStatus(hasReachedEnd ? 'Replaying local recording.' : 'Playing local recording.');
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
            setStatus('Playback finished.');
          }
        }
      );

      soundRef.current = sound;
      setActivePlaybackAttemptTimestamp(attemptTimestamp);
      setPlaybackPositionMillis(initialStatus.isLoaded ? initialStatus.positionMillis : 0);
      setPlaybackDurationMillis(initialStatus.isLoaded ? (initialStatus.durationMillis ?? 0) : 0);
      setIsPlaybackActive(true);

      if (initialStatus.isLoaded && initialStatus.durationMillis && initialStatus.durationMillis > 0) {
        setStatus(`Playing local recording (${formatMillis(initialStatus.durationMillis)}).`);
        return;
      }

      setStatus('Playing local recording.');
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
        setStatus('Only non-submitted attempts can be deleted.');
        return;
      }

      const wasDeleted = await deleteAttempt({
        sessionId: activeSession.id,
        questionValueKey: buildQuestionValueKey(activeQuestion),
        answerTimestamp: attempt.timestamp,
      });

      if (!wasDeleted) {
        setStatus('Attempt could not be deleted.');
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

      setStatus('Attempt deleted.');
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
    <AppScreen
      title="Practice"
      subtitle="Run mock interview questions and capture answer attempts with recording controls."
      excludeBottomSafeArea
      contentBottomPadding={contentBottomPadding}>
      <AppCard title="Session + Question Selection">
        {sessions.length === 0 ? <Text style={styles.bodyText}>No sessions available.</Text> : null}
        <Text style={styles.metaText}>Session</Text>
        <Pressable testID="practice-session-dropdown-trigger" style={styles.dropdownTrigger} onPress={() => setIsSessionDropdownOpen(true)}>
          <Text style={styles.dropdownTriggerText}>
            {activeSession ? toOneLinePreview(activeSession.title, 72) : 'Select a session'}
          </Text>
          <Text style={styles.dropdownCaret}>v</Text>
        </Pressable>

        <Text style={styles.metaText}>Question</Text>
        <Pressable
          testID="practice-question-dropdown-trigger"
          style={styles.dropdownTrigger}
          onPress={() => setIsQuestionDropdownOpen(true)}
          disabled={!activeSession || questionDropdownOptions.length === 0}>
          <Text style={styles.dropdownTriggerText}>
            {activeQuestion ? toOneLinePreview(activeQuestion.value, 96) : 'Select a question'}
          </Text>
          <Text style={styles.dropdownCaret}>v</Text>
        </Pressable>

        <AppButton label="Pick Random Question" onPress={onPickRandomQuestion} variant="ghost" />
      </AppCard>

      <SelectorDropdown
        visible={isSessionDropdownOpen}
        title="Select Session"
        options={sessionDropdownOptions}
        selectedKey={activeSessionId}
        onSelect={onSelectSession}
        onClose={() => setIsSessionDropdownOpen(false)}
      />

      <SelectorDropdown
        visible={isQuestionDropdownOpen}
        title="Select Question"
        options={questionDropdownOptions}
        selectedKey={activeQuestionValueKey}
        onSelect={onSelectQuestion}
        onClose={() => setIsQuestionDropdownOpen(false)}
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
          </View>
        ) : (
          <Text style={styles.bodyText}>Select a question to view full details.</Text>
        )}
      </AppCard>

      <AppCard title="Question Runner">
        <Text style={styles.bodyText}>Network: {isOnline ? 'Online' : 'Offline'}</Text>
        <Text style={styles.bodyText}>Pending Evaluations: {pendingCount}</Text>
        <Text style={styles.bodyText}>Recording Cap: {recordingLimitSeconds}s</Text>
        <Text style={styles.bodyText}>Recorder: {isRecording ? 'Active' : 'Idle'}</Text>
        <View style={styles.meterRow}>
          <Text style={styles.metaText}>Mic Level</Text>
          <View style={styles.meterTrack}>
            <View style={[styles.meterFill, { width: `${isRecording ? Math.max(4, Math.round(micLevel * 100)) : 0}%` }]} />
          </View>
          <Text style={styles.metaText}>{micDb !== null ? `${Math.round(micDb)} dB` : 'n/a'}</Text>
        </View>

        <AppInput
          multiline
          numberOfLines={3}
          onChangeText={setTranscriptDraft}
          placeholder="Optional notes used as candidate answer text when submitting"
          value={transcriptDraft}
        />

        <AppButton
          label={isRecording ? 'Stop Recording' : 'Start Recording'}
          onPress={onToggleRecording}
          variant={isRecording ? 'ghost' : 'primary'}
        />

        <Text style={styles.bodyText}>Recording Seconds: {recordingSeconds}</Text>

        {!activeSession || !activeQuestion ? <Text style={styles.bodyText}>No session/questions available. Generate one from Prepare first.</Text> : null}

        {status ? <Text style={styles.statusText}>{status}</Text> : null}
      </AppCard>

      <AppCard title="Past Answers">
        {activeQuestion ? (
          <>
            <Pressable testID="practice-past-answers-toggle" style={styles.collapsibleHeader} onPress={() => setShowPastAnswers((value) => !value)}>
              <Text style={styles.questionTitle}>{`Past Answers (${attempts.length})`}</Text>
              <Text style={styles.metaText}>{showPastAnswers ? 'Hide' : 'Show'}</Text>
            </Pressable>

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
                        <View style={styles.attemptHeaderPrimary}>
                          <Text style={styles.attemptTitle} testID={`practice-attempt-title-${attempt.timestamp}`}>{`Attempt #${attemptNumber}`}</Text>
                          <View style={styles.attemptStatusBadge} testID={`practice-attempt-status-${attempt.timestamp}`}>
                            <IconSymbol name={getAttemptStatusIconName(attemptStatus)} size={16} color={getAttemptStatusColor(attemptStatus)} />
                            <Text style={styles.metaText}>{attemptStatus}</Text>
                          </View>
                        </View>
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
                      </View>
                      <Text style={styles.metaText}>{formatAttemptTimestamp(attempt.timestamp)}</Text>
                      {attempt.evaluation ? <Text style={styles.scoreText} testID={`practice-attempt-score-${attempt.timestamp}`}>{`${attempt.evaluation.score}/10`}</Text> : null}
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
                          <View style={styles.evaluationTabPanel} testID={`practice-attempt-tab-panel-${attempt.timestamp}`}>
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
                          </View>
                        </View>
                      ) : null}
                      {hasAttemptAudio ? (
                        <View
                          style={[styles.playbackPanel, !isActivePlaybackAttempt ? styles.playbackPanelInactive : null]}
                          testID={`practice-attempt-playback-panel-${attempt.timestamp}`}>
                          <Slider
                            disabled={!isActivePlaybackAttempt}
                            minimumValue={0}
                            maximumValue={Math.max(attemptPlaybackDuration, 1)}
                            value={Math.min(attemptPlaybackPosition, Math.max(attemptPlaybackDuration, 1))}
                            onSlidingComplete={onSeekPlayback}
                            minimumTrackTintColor={AppTheme.colors.accent}
                            maximumTrackTintColor={AppTheme.colors.borderStrong}
                            thumbTintColor={AppTheme.colors.accent}
                          />
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
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  bodyText: {
    color: AppTheme.colors.textSecondary,
    fontFamily: AppTheme.typography.bodyFamily,
    fontSize: 15,
    lineHeight: 22,
  },
  statusText: {
    color: AppTheme.colors.warning,
    fontFamily: AppTheme.typography.monoFamily,
    fontSize: 13,
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
  dropdownCaret: {
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.typography.monoFamily,
    fontSize: 12,
  },
  dropdownBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    flex: 1,
    justifyContent: 'center',
    padding: AppTheme.spacing.md,
  },
  dropdownPanel: {
    backgroundColor: AppTheme.colors.surfacePrimary,
    borderWidth: 1,
    borderColor: AppTheme.colors.borderStrong,
    maxHeight: '70%',
    padding: AppTheme.spacing.sm,
    gap: AppTheme.spacing.sm,
  },
  dropdownTitle: {
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.typography.headingFamily,
    fontSize: 16,
    textTransform: 'uppercase',
  },
  dropdownList: {
    maxHeight: 420,
  },
  dropdownRow: {
    borderWidth: 1,
    borderColor: AppTheme.colors.borderSubtle,
    backgroundColor: AppTheme.colors.surfaceSecondary,
    paddingHorizontal: AppTheme.spacing.sm,
    paddingVertical: AppTheme.spacing.sm,
  },
  dropdownRowSelected: {
    borderColor: AppTheme.colors.accent,
  },
  dropdownText: {
    color: AppTheme.colors.textSecondary,
    fontFamily: AppTheme.typography.bodyFamily,
    fontSize: 14,
  },
  dropdownTextSelected: {
    color: AppTheme.colors.textPrimary,
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
    borderWidth: 1,
    borderColor: AppTheme.colors.borderStrong,
    backgroundColor: AppTheme.colors.surfaceSecondary,
    padding: AppTheme.spacing.md,
    gap: AppTheme.spacing.xs,
  },
  collapsibleHeader: {
    borderWidth: 1,
    borderColor: AppTheme.colors.borderStrong,
    backgroundColor: AppTheme.colors.surfaceSecondary,
    padding: AppTheme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  collapsibleBody: {
    gap: AppTheme.spacing.sm,
  },
  questionTitle: {
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.typography.headingFamily,
    fontSize: 14,
    textTransform: 'uppercase',
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
  attemptHeaderPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppTheme.spacing.xs,
    flex: 1,
    minWidth: 0,
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
  scoreText: {
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.typography.headingFamily,
    fontSize: 28,
    lineHeight: 30,
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
  },
  gapList: {
    gap: AppTheme.spacing.xs,
  },
  playbackPanel: {
    gap: AppTheme.spacing.xs,
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
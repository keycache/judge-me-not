import Slider from '@react-native-community/slider';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { Audio } from 'expo-av';
import * as Network from 'expo-network';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppCard } from '@/components/ui/app-card';
import { AppInput } from '@/components/ui/app-input';
import { AppScreen } from '@/components/ui/app-screen';
import { AppTheme } from '@/constants/app-theme';
import { Answer } from '@/lib/domain/interview-models';
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

export default function PracticeScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const contentBottomPadding = tabBarHeight;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [attempts, setAttempts] = useState<Answer[]>([]);
  const [transcriptDraft, setTranscriptDraft] = useState('');
  const [status, setStatus] = useState('');
  const [recordingLimitSeconds, setRecordingLimitSeconds] = useState(DEFAULT_APP_SETTINGS.recordingLimitSeconds);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [lastRecordingUri, setLastRecordingUri] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  const [micDb, setMicDb] = useState<number | null>(null);
  const [activePlaybackAttemptId, setActivePlaybackAttemptId] = useState<string | null>(null);
  const [playbackPositionMillis, setPlaybackPositionMillis] = useState(0);
  const [playbackDurationMillis, setPlaybackDurationMillis] = useState(0);
  const [isPlaybackActive, setIsPlaybackActive] = useState(false);

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

  const activeQuestion = useMemo(() => {
    if (!activeSession || activeSession.questionList.questions.length === 0) {
      return null;
    }

    return activeSession.questionList.questions[Math.min(activeQuestionIndex, activeSession.questionList.questions.length - 1)] ?? null;
  }, [activeQuestionIndex, activeSession]);

  const refreshAttempts = useCallback(async () => {
    if (!activeSession || !activeQuestion) {
      setAttempts([]);
      return;
    }

    const nextAttempts = await listAttempts(activeSession.id, activeQuestion.id);
    setAttempts(nextAttempts);
  }, [activeQuestion, activeSession]);

  const refreshPendingCount = useCallback(async () => {
    const items = await listPendingEvaluations();
    setPendingCount(items.length);
  }, []);

  const reloadPracticeState = useCallback(async () => {
    const [nextSessions, settings] = await Promise.all([listSessions(), getAppSettings()]);
    setSessions(nextSessions);
    setRecordingLimitSeconds(settings.recordingLimitSeconds);

    if (!activeSessionId && nextSessions.length > 0) {
      setActiveSessionId(nextSessions[0].id);
      setActiveQuestionIndex(0);
    }
  }, [activeSessionId]);

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

    const subscription = Network.addNetworkStateListener((state) => {
      setIsOnline(Boolean(state.isConnected));
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

    const transcript = transcriptDraft.trim() || `Attempt recorded at ${new Date().toLocaleTimeString()}`;

    await appendAttempt({
      sessionId: activeSession.id,
      questionId: activeQuestion.id,
      transcript,
      audioFileUri: uri,
      durationSeconds: recordingSeconds,
    });

    setLastRecordingUri(uri);
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
      setActivePlaybackAttemptId(null);
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

        // A sustained near-0 dB reading in emulator usually indicates loopback/synthetic input.
        if (db > -2) {
          saturatedCountRef.current += 1;
          setMicLevel((previous) => previous * 0.8 + 0.2 * 0.2);
          if (!loopbackWarnedRef.current) {
            loopbackWarnedRef.current = true;
          }

          // If saturation persists, stop and discard this recording to avoid saving beep artifacts.
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
    async (answerId: string) => {
      if (!activeSession || !activeQuestion) {
        return;
      }

      const result = await submitAttemptForEvaluation({
        sessionId: activeSession.id,
        questionId: activeQuestion.id,
        answerId,
        isOnline,
      });

      setStatus(result === 'pending' ? 'Attempt queued for evaluation (offline).' : 'Attempt evaluated online.');
      await refreshAttempts();
      await refreshPendingCount();
    },
    [activeQuestion, activeSession, isOnline, refreshAttempts, refreshPendingCount]
  );

  const onToggleAttemptPlayback = useCallback(async (attemptId: string, uri: string | null) => {
    if (!uri) {
      setStatus('No local recording for this attempt.');
      return;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });

    if (activePlaybackAttemptId === attemptId && soundRef.current) {
      const currentStatus = await soundRef.current.getStatusAsync();
      if (currentStatus.isLoaded && currentStatus.isPlaying) {
        await soundRef.current.pauseAsync();
        setStatus('Playback paused.');
        return;
      }

      if (currentStatus.isLoaded) {
        await soundRef.current.playAsync();
        setStatus('Playing local recording.');
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
    setActivePlaybackAttemptId(attemptId);
    setPlaybackPositionMillis(initialStatus.isLoaded ? initialStatus.positionMillis : 0);
    setPlaybackDurationMillis(initialStatus.isLoaded ? (initialStatus.durationMillis ?? 0) : 0);
    setIsPlaybackActive(true);

    if (initialStatus.isLoaded && initialStatus.durationMillis && initialStatus.durationMillis > 0) {
      setStatus(`Playing local recording (${formatMillis(initialStatus.durationMillis)}).`);
      return;
    }

    setStatus('Playing local recording.');
  }, [activePlaybackAttemptId, formatMillis]);

  const onSeekPlayback = useCallback(async (value: number) => {
    if (!soundRef.current || activePlaybackAttemptId === null) {
      return;
    }

    await soundRef.current.setPositionAsync(Math.floor(value));
    setPlaybackPositionMillis(Math.floor(value));
  }, [activePlaybackAttemptId]);

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

      if (attempt.submittedAtIso) {
        setStatus('Only non-submitted attempts can be deleted.');
        return;
      }

      const wasDeleted = await deleteAttempt({
        sessionId: activeSession.id,
        questionId: activeQuestion.id,
        answerId: attempt.id,
      });

      if (!wasDeleted) {
        setStatus('Attempt could not be deleted.');
        return;
      }

      if (activePlaybackAttemptId === attempt.id && soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
        setActivePlaybackAttemptId(null);
        setPlaybackPositionMillis(0);
        setPlaybackDurationMillis(0);
        setIsPlaybackActive(false);
      }

      setStatus('Attempt deleted.');
      await refreshAttempts();
      await refreshPendingCount();
    },
    [activePlaybackAttemptId, activeQuestion, activeSession, refreshAttempts, refreshPendingCount]
  );

  const onSelectSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    setActiveQuestionIndex(0);
  }, []);

  return (
    <AppScreen
      title="Practice"
      subtitle="Run mock interview questions and capture answer attempts with recording controls."
      excludeBottomSafeArea
      contentBottomPadding={contentBottomPadding}>
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
          placeholder="Optional transcript notes for this spoken attempt"
          value={transcriptDraft}
        />

        <AppButton
          label={isRecording ? 'Stop Recording' : 'Start Recording'}
          onPress={onToggleRecording}
          variant={isRecording ? 'ghost' : 'primary'}
        />

        <Text style={styles.bodyText}>Recording Seconds: {recordingSeconds}</Text>
        {lastRecordingUri ? <Text style={styles.metaText}>Last local audio: {lastRecordingUri}</Text> : null}

        {activeSession && activeQuestion ? (
          <View style={styles.questionCard}>
            <Text style={styles.questionTitle}>{activeSession.title}</Text>
            <Text style={styles.questionPrompt}>{activeQuestion.prompt}</Text>
          </View>
        ) : (
          <Text style={styles.bodyText}>No session/questions available. Generate one from Prepare first.</Text>
        )}

        {status ? <Text style={styles.statusText}>{status}</Text> : null}
      </AppCard>

      <AppCard title="Attempt History">
        {attempts.length === 0 ? <Text style={styles.bodyText}>No attempts yet for this question.</Text> : null}
        {attempts.map((attempt) => (
          <View key={attempt.id} style={styles.attemptRow}>
            <Text style={styles.bodyText}>{attempt.createdAtIso}</Text>
            <Text style={styles.metaText}>Status: {attempt.evaluationStatus ?? 'draft'}</Text>
            <Text style={styles.metaText}>Recorded: {attempt.durationSeconds}s</Text>
            <Text style={styles.bodyText}>{attempt.transcript}</Text>
            {attempt.evaluation ? <Text style={styles.metaText}>Score: {attempt.evaluation.scoreOutOfTen}/10</Text> : null}
            <View style={styles.buttonRow}>
              {!attempt.submittedAtIso ? <AppButton label="Submit" onPress={() => onSubmitAttempt(attempt.id)} /> : null}
              <AppButton
                label={activePlaybackAttemptId === attempt.id && isPlaybackActive ? 'Pause' : 'Play'}
                onPress={() => onToggleAttemptPlayback(attempt.id, attempt.audioFileUri)}
                variant="ghost"
              />
              {!attempt.submittedAtIso ? (
                <AppButton label="Delete" onPress={() => onDeleteAttempt(attempt)} variant="ghost" />
              ) : null}
            </View>
            {activePlaybackAttemptId === attempt.id ? (
              <View style={styles.playbackPanel}>
                <Slider
                  minimumValue={0}
                  maximumValue={Math.max(playbackDurationMillis, 1)}
                  value={Math.min(playbackPositionMillis, Math.max(playbackDurationMillis, 1))}
                  onSlidingComplete={onSeekPlayback}
                  minimumTrackTintColor={AppTheme.colors.accent}
                  maximumTrackTintColor={AppTheme.colors.borderStrong}
                  thumbTintColor={AppTheme.colors.accent}
                />
                <View style={styles.playbackTimesRow}>
                  <Text style={styles.metaText}>{formatMillis(playbackPositionMillis)}</Text>
                  <Text style={styles.metaText}>{formatMillis(playbackDurationMillis)}</Text>
                </View>
              </View>
            ) : null}
          </View>
        ))}
      </AppCard>

      <AppCard title="Sessions">
        {sessions.length === 0 ? <Text style={styles.bodyText}>No sessions available.</Text> : null}
        {sessions.map((session) => (
          <Pressable key={session.id} onPress={() => onSelectSession(session.id)} style={styles.sessionRow}>
            <Text style={styles.questionTitle}>{session.title}</Text>
            <Text style={styles.metaText}>{session.questionList.questions.length} questions</Text>
          </Pressable>
        ))}
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
  questionCard: {
    borderWidth: 1,
    borderColor: AppTheme.colors.borderStrong,
    backgroundColor: AppTheme.colors.surfaceSecondary,
    padding: AppTheme.spacing.md,
    gap: AppTheme.spacing.xs,
  },
  questionTitle: {
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.typography.headingFamily,
    fontSize: 14,
    textTransform: 'uppercase',
  },
  questionPrompt: {
    color: AppTheme.colors.textSecondary,
    fontFamily: AppTheme.typography.bodyFamily,
    fontSize: 14,
    lineHeight: 20,
  },
  attemptRow: {
    borderWidth: 1,
    borderColor: AppTheme.colors.borderSubtle,
    backgroundColor: AppTheme.colors.surfaceSecondary,
    padding: AppTheme.spacing.sm,
    gap: AppTheme.spacing.xs,
  },
  sessionRow: {
    borderWidth: 1,
    borderColor: AppTheme.colors.borderSubtle,
    backgroundColor: AppTheme.colors.surfaceSecondary,
    padding: AppTheme.spacing.sm,
    gap: AppTheme.spacing.xs,
  },
  playbackPanel: {
    gap: AppTheme.spacing.xs,
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

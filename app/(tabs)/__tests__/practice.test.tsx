import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';

import { buildQuestionValueKey, Question } from '@/lib/domain/interview-models';
import { Session } from '@/lib/domain/session-models';
import {
    listAttempts,
    listPendingEvaluations,
    processPendingEvaluations,
    submitAttemptForEvaluation,
} from '@/lib/repositories/practice-repository';
import { listSessions } from '@/lib/repositories/session-repository';
import { getAppSettings, patchAppSettings } from '@/lib/repositories/settings-repository';
import PracticeScreen from '../practice';

jest.mock('@react-navigation/bottom-tabs', () => ({
  useBottomTabBarHeight: jest.fn(() => 0),
}));

jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}));

jest.mock('@react-navigation/native', () => ({
  // Keep focus effects inert in unit tests to avoid duplicate async reload cycles.
  useFocusEffect: jest.fn(),
}));

jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(async () => ({ isConnected: true })),
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock('expo-av', () => ({
  Audio: {
    requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
    setAudioModeAsync: jest.fn(async () => undefined),
    Recording: jest.fn(),
    Sound: {
      createAsync: jest.fn(),
    },
    RecordingOptionsPresets: {
      HIGH_QUALITY: {
        ios: {},
        android: {},
      },
    },
  },
}));

jest.mock('@react-native-community/slider', () => 'Slider');

jest.mock('@/components/ui/app-screen', () => ({
  AppScreen: ({ children }: { children: React.ReactNode }) => {
    const rn = jest.requireActual('react-native');
    return <rn.View>{children}</rn.View>;
  },
}));

jest.mock('@/components/ui/app-card', () => ({
  AppCard: ({ title, children }: { title?: string; children: React.ReactNode }) => {
    const rn = jest.requireActual('react-native');
    return (
      <rn.View>
      {title ? <rn.Text>{title}</rn.Text> : null}
      {children}
      </rn.View>
    );
  },
}));

jest.mock('@/components/ui/app-button', () => ({
  AppButton: ({ label, onPress, testID, disabled, loading }: { label: string; onPress: () => void; testID?: string; disabled?: boolean; loading?: boolean }) => {
    const rn = jest.requireActual('react-native');
    return (
      <rn.TouchableOpacity disabled={disabled} onPress={onPress} testID={testID}>
      {loading ? <rn.Text testID={testID ? `${testID}-spinner` : undefined}>loading</rn.Text> : null}
      <rn.Text>{label}</rn.Text>
      </rn.TouchableOpacity>
    );
  },
}));

jest.mock('@/components/ui/app-input', () => ({
  AppInput: ({ testID, onChangeText, value, placeholder }: { testID?: string; onChangeText?: (v: string) => void; value?: string; placeholder?: string }) => {
    const rn = jest.requireActual('react-native');
    return <rn.TextInput testID={testID} onChangeText={onChangeText} value={value} placeholder={placeholder} />;
  },
}));

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: ({ name }: { name: string }) => {
    const rn = jest.requireActual('react-native');
    return <rn.Text>{name}</rn.Text>;
  },
}));

jest.mock('@/lib/repositories/session-repository', () => ({
  listSessions: jest.fn(),
}));

jest.mock('@/lib/repositories/settings-repository', () => ({
  getAppSettings: jest.fn(),
  patchAppSettings: jest.fn(async (patch) => ({
    activeSessionId: patch.activeSessionId ?? null,
    recordingLimitSeconds: patch.recordingLimitSeconds ?? 120,
    promptSettings: {
      modelVariant: 'gemini-3.1-flash-lite-preview',
      evaluationStrictness: 'balanced',
      systemPersona: 'Coach',
      ...patch.promptSettings,
    },
  })),
}));

jest.mock('@/lib/repositories/practice-repository', () => ({
  appendAttempt: jest.fn(),
  deleteAttempt: jest.fn(),
  listAttempts: jest.fn(),
  listPendingEvaluations: jest.fn(),
  processPendingEvaluations: jest.fn(),
  submitAttemptForEvaluation: jest.fn(),
}));

const mockListSessions = listSessions as jest.MockedFunction<typeof listSessions>;
const mockGetAppSettings = getAppSettings as jest.MockedFunction<typeof getAppSettings>;
const mockPatchAppSettings = patchAppSettings as jest.MockedFunction<typeof patchAppSettings>;
const mockListAttempts = listAttempts as jest.MockedFunction<typeof listAttempts>;
const mockListPendingEvaluations = listPendingEvaluations as jest.MockedFunction<typeof listPendingEvaluations>;
const mockProcessPendingEvaluations = processPendingEvaluations as jest.MockedFunction<typeof processPendingEvaluations>;
const mockSubmitAttemptForEvaluation = submitAttemptForEvaluation as jest.MockedFunction<typeof submitAttemptForEvaluation>;

function buildQuestion(value: string, difficulty: 'Easy' | 'Medium' | 'Hard', category = 'Behavioral'): Question {
  return {
    value,
    category,
    difficulty,
    answer: 'Use STAR with measurable impact.',
    answers: [],
  };
}

function buildSession(id: string, title: string, questions: Question[], createdAtIso: string): Session {
  return {
    id,
    title,
    createdAtIso,
    updatedAtIso: createdAtIso,
    questionList: { questions },
    audioIndex: [],
    promptSnapshot: null,
  };
}

async function renderPracticeScreen() {
  const screen = render(<PracticeScreen />);

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  await waitFor(() => {
    expect(mockListSessions).toHaveBeenCalled();
    expect(mockGetAppSettings).toHaveBeenCalled();
    expect(mockListPendingEvaluations).toHaveBeenCalled();
    expect(mockProcessPendingEvaluations).toHaveBeenCalled();
  });

  return screen;
}

describe('practice screen selectors + details', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPatchAppSettings.mockResolvedValue({
      activeSessionId: null,
      recordingLimitSeconds: 120,
      promptSettings: {
        modelVariant: 'gemini-3.1-flash-lite-preview',
        evaluationStrictness: 'balanced',
        systemPersona: 'Coach',
      },
    });
    mockGetAppSettings.mockResolvedValue({
      activeSessionId: null,
      recordingLimitSeconds: 120,
      promptSettings: {
        modelVariant: 'gemini-3.1-flash-lite-preview',
        evaluationStrictness: 'balanced',
        systemPersona: 'Coach',
      },
    });
    mockListPendingEvaluations.mockResolvedValue([]);
    mockProcessPendingEvaluations.mockResolvedValue(0);
  });

  it('disables the draft submit button and shows a spinner while submission is in flight', async () => {
    const question = buildQuestion('Tell me about a leadership conflict.', 'Medium', 'Leadership');
    const session = buildSession('s-1', 'Management Round', [question], '2026-03-27T10:00:00.000Z');

    let resolveSubmission: ((value: 'pending' | 'completed') => void) | null = null;
    mockListSessions.mockResolvedValue([session]);
    mockListAttempts.mockResolvedValue([
      {
        audio_file_path: 'file:///tmp/draft.m4a',
        timestamp: '2026-03-27T21:05:01.151Z',
      },
    ]);
    mockSubmitAttemptForEvaluation.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSubmission = resolve;
        })
    );

    const screen = await renderPracticeScreen();

    fireEvent.press(screen.getByTestId('practice-past-answers-toggle'));

    await waitFor(() => {
      expect(screen.getByTestId('practice-attempt-submit-2026-03-27T21:05:01.151Z')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('practice-attempt-submit-2026-03-27T21:05:01.151Z'));

    await waitFor(() => {
      expect(mockSubmitAttemptForEvaluation).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('practice-attempt-submit-2026-03-27T21:05:01.151Z-spinner')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('practice-attempt-submit-2026-03-27T21:05:01.151Z'));
    expect(mockSubmitAttemptForEvaluation).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSubmission?.('completed');
      await Promise.resolve();
    });
  });

  it('renders session and question dropdown triggers', async () => {
    const sessionA = buildSession('s-1', 'Product Engineer Interview Round', [buildQuestion('Tell me about a challenge.', 'Easy')], '2026-03-27T10:00:00.000Z');
    mockListSessions.mockResolvedValue([sessionA]);
    mockListAttempts.mockResolvedValue([]);

    const screen = await renderPracticeScreen();

    await waitFor(() => {
      expect(screen.getByTestId('practice-session-dropdown-trigger')).toBeTruthy();
      expect(screen.getByTestId('practice-question-dropdown-trigger')).toBeTruthy();
    });
  });

  it('filters question options by selected session in dropdown', async () => {
    const qA = buildQuestion('Question from Session A', 'Easy', 'A');
    const qB = buildQuestion('Question from Session B', 'Medium', 'B');
    const sessionA = buildSession('s-1', 'Session A', [qA], '2026-03-27T10:00:00.000Z');
    const sessionB = buildSession('s-2', 'Session B', [qB], '2026-03-27T11:00:00.000Z');

    mockListSessions.mockResolvedValue([sessionB, sessionA]);
    mockListAttempts.mockResolvedValue([]);

    const screen = await renderPracticeScreen();

    await waitFor(() => {
      expect(screen.getAllByText('Session B').length).toBeGreaterThan(0);
    });

    fireEvent.press(screen.getByTestId('practice-session-dropdown-trigger'));
    fireEvent.press(screen.getByTestId('practice-dropdown-option-s-1'));

    await waitFor(() => {
      expect(screen.getAllByText('Session A').length).toBeGreaterThan(0);
    });

    fireEvent.press(screen.getByTestId('practice-question-dropdown-trigger'));

    await waitFor(() => {
      expect(screen.getAllByText('Question from Session A').length).toBeGreaterThan(0);
      expect(screen.queryByText('Question from Session B')).toBeNull();
    });
  });

  it('shows full selected question details and metadata', async () => {
    const longQuestion =
      'Explain a time you redesigned a critical release process with measurable quality improvements across teams.';
    const session = buildSession(
      's-1',
      'Engineering Leadership Panel',
      [buildQuestion(longQuestion, 'Hard', 'Execution')],
      '2026-03-27T10:00:00.000Z'
    );

    mockListSessions.mockResolvedValue([session]);
    mockListAttempts.mockResolvedValue([]);

    const screen = await renderPracticeScreen();

    await waitFor(() => {
      expect(screen.getByTestId('practice-selected-question-full-text')).toBeTruthy();
    });

    expect(screen.getByText(longQuestion)).toBeTruthy();
    expect(screen.getByTestId('practice-selected-question-category-badge')).toBeTruthy();
    expect(screen.getByTestId('practice-selected-question-difficulty-badge')).toBeTruthy();
    expect(screen.getByText('Category: Execution')).toBeTruthy();
    expect(screen.getByText('Difficulty: Hard')).toBeTruthy();
    expect(screen.queryByText(/Expected answer focus:/)).toBeNull();
  });

  it('shows user-friendly one-line preview labels in selectors', async () => {
    const longSessionTitle =
      'Platform Architecture Leadership Round\nWith Production Reliability And Cross Team Delivery Focus For Staff Engineers';
    const longQuestionValue =
      'Describe a production incident where you coordinated rollback, communication, and remediation across multiple teams while preserving customer trust and service SLOs.';
    const longQuestion = buildQuestion(longQuestionValue, 'Hard', 'Incident Management');

    const session = buildSession(
      's-1',
      longSessionTitle,
      [longQuestion],
      '2026-03-27T10:00:00.000Z'
    );
    const longQuestionKey = buildQuestionValueKey(longQuestion);

    mockListSessions.mockResolvedValue([session]);
    mockListAttempts.mockResolvedValue([]);

    const screen = await renderPracticeScreen();

    await waitFor(() => {
      expect(screen.getByTestId('practice-session-dropdown-trigger')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('practice-session-dropdown-trigger'));
    await waitFor(() => {
      expect(screen.getByTestId('practice-dropdown-option-s-1')).toBeTruthy();
      expect(screen.getAllByText(/\.\.\./).length).toBeGreaterThan(0);
    });

    fireEvent.press(screen.getByTestId('practice-question-dropdown-trigger'));
    await waitFor(() => {
      expect(screen.getByTestId(`practice-dropdown-option-${longQuestionKey}`)).toBeTruthy();
      expect(screen.getAllByText(/\.\.\./).length).toBeGreaterThan(0);
    });
  });

  it('toggles and resets past answers collapsible when question changes', async () => {
    const q1 = buildQuestion('Q1: Tell me about system design.', 'Medium');
    const q2 = buildQuestion('Q2: Tell me about incident response.', 'Medium');
    const session = buildSession('s-1', 'Platform Interview', [q1, q2], '2026-03-27T10:00:00.000Z');

    const q1Key = buildQuestionValueKey(q1);
    const q2Key = buildQuestionValueKey(q2);

    mockListSessions.mockResolvedValue([session]);
    mockListAttempts.mockImplementation(async (_sessionId, questionValueKey) => {
      if (questionValueKey === q1Key) {
        return [
          {
            audio_file_path: 'file:///tmp/a1.m4a',
            timestamp: '2026-03-27T10:10:00.000Z',
          },
        ];
      }

      if (questionValueKey === q2Key) {
        return [
          {
            audio_file_path: 'file:///tmp/a2.m4a',
            timestamp: '2026-03-27T10:20:00.000Z',
          },
        ];
      }

      return [];
    });

    const screen = await renderPracticeScreen();

    await waitFor(() => {
      expect(screen.getByTestId('practice-past-answers-toggle')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('practice-past-answers-toggle'));

    await waitFor(() => {
      expect(screen.getByTestId('practice-past-answers-content')).toBeTruthy();
      expect(screen.getByText('Attempt #1')).toBeTruthy();
      expect(screen.getByText('pencil')).toBeTruthy();
      expect(screen.getByTestId('practice-attempt-playback-2026-03-27T10:10:00.000Z')).toBeTruthy();
      expect(screen.getByTestId('practice-attempt-playback-panel-2026-03-27T10:10:00.000Z')).toBeTruthy();
      expect(screen.queryByText('Play')).toBeNull();
      expect(screen.queryByText('Audio: file:///tmp/a1.m4a')).toBeNull();
    });

    fireEvent.press(screen.getByTestId('practice-question-dropdown-trigger'));
    fireEvent.press(screen.getByTestId(`practice-dropdown-option-${q2Key}`));

    await waitFor(() => {
      expect(screen.queryByTestId('practice-past-answers-content')).toBeNull();
    });
  });

  it('shows evaluated answer details inside tabbed past answer content', async () => {
    const question = buildQuestion('Tell me about leading a difficult team transition.', 'Medium', 'Leadership');
    const session = buildSession('s-1', 'Management Skills Interview Assessment', [question], '2026-03-27T10:00:00.000Z');

    mockListSessions.mockResolvedValue([session]);
    mockListAttempts.mockResolvedValue([
      {
        audio_file_path: 'file:///tmp/evaluated.m4a',
        timestamp: '2026-03-27T21:05:01.151Z',
        evaluation: {
          score: 1,
          candidate_answer: 'I focused on communication and stability during the transition.',
          feedback: 'The answer stays high level and needs more concrete examples.',
          gaps_identified: ['Use a specific example', 'Quantify team impact'],
          model_answer: 'A stronger answer would cover the transition plan, resistance handling, and results.',
        },
      },
    ]);

    const screen = await renderPracticeScreen();

    fireEvent.press(screen.getByTestId('practice-past-answers-toggle'));

    await waitFor(() => {
      expect(screen.getByText('Attempt #1')).toBeTruthy();
      expect(screen.getByText('1/10')).toBeTruthy();
      expect(screen.getByText('checkmark.circle.fill')).toBeTruthy();
      expect(screen.getByTestId('practice-attempt-playback-2026-03-27T21:05:01.151Z')).toBeTruthy();
      expect(screen.getByTestId('practice-attempt-playback-panel-2026-03-27T21:05:01.151Z')).toBeTruthy();
      expect(screen.queryByText('Play')).toBeNull();
      expect(screen.queryByText(/Audio:/)).toBeNull();
      expect(screen.getByText('I focused on communication and stability during the transition.')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('practice-attempt-tab-2026-03-27T21:05:01.151Z-feedback'));

    await waitFor(() => {
      expect(screen.getByText('The answer stays high level and needs more concrete examples.')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('practice-attempt-tab-2026-03-27T21:05:01.151Z-gaps_identified'));

    await waitFor(() => {
      expect(screen.getByText('• Use a specific example')).toBeTruthy();
      expect(screen.getByText('• Quantify team impact')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('practice-attempt-tab-2026-03-27T21:05:01.151Z-model_answer'));

    await waitFor(() => {
      expect(screen.getByText('A stronger answer would cover the transition plan, resistance handling, and results.')).toBeTruthy();
    });
  });

  it('exposes an accessibility label for the attempt playback icon control', async () => {
    const question = buildQuestion('Tell me about a difficult migration.', 'Medium', 'Architecture');
    const session = buildSession('s-1', 'Architecture Review', [question], '2026-03-27T10:00:00.000Z');

    mockListSessions.mockResolvedValue([session]);
    mockListAttempts.mockResolvedValue([
      {
        audio_file_path: 'file:///tmp/migration.m4a',
        timestamp: '2026-03-27T21:15:01.151Z',
      },
    ]);

    const screen = await renderPracticeScreen();

    fireEvent.press(screen.getByTestId('practice-past-answers-toggle'));

    await waitFor(() => {
      expect(screen.getByLabelText('Play attempt playback')).toBeTruthy();
    });
  });
});

describe('practice screen phase 8c — recording UX + polish', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.requireMock('expo-av').Audio.Recording.mockImplementation(() => ({
      setProgressUpdateInterval: jest.fn(),
      prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
      startAsync: jest.fn().mockResolvedValue(undefined),
      setOnRecordingStatusUpdate: jest.fn(),
      stopAndUnloadAsync: jest.fn().mockResolvedValue(undefined),
      getURI: jest.fn().mockReturnValue('file:///tmp/test-rec.m4a'),
    }));
    mockPatchAppSettings.mockResolvedValue({
      activeSessionId: null,
      recordingLimitSeconds: 120,
      promptSettings: {
        modelVariant: 'gemini-3.1-flash-lite-preview',
        evaluationStrictness: 'balanced',
        systemPersona: 'Coach',
      },
    });
    mockGetAppSettings.mockResolvedValue({
      activeSessionId: null,
      recordingLimitSeconds: 120,
      promptSettings: {
        modelVariant: 'gemini-3.1-flash-lite-preview',
        evaluationStrictness: 'balanced',
        systemPersona: 'Coach',
      },
    });
    mockListPendingEvaluations.mockResolvedValue([]);
    mockProcessPendingEvaluations.mockResolvedValue(0);
  });

  it('recording timer is hidden when idle', async () => {
    mockListSessions.mockResolvedValue([]);
    mockListAttempts.mockResolvedValue([]);

    const screen = await renderPracticeScreen();

    expect(screen.queryByTestId('practice-recording-timer')).toBeNull();
  });

  it('recording timer is visible when recording', async () => {
    const session = buildSession('s-1', 'Test Session', [buildQuestion('Q1', 'Easy')], '2026-03-27T10:00:00.000Z');
    mockListSessions.mockResolvedValue([session]);
    mockListAttempts.mockResolvedValue([]);

    const screen = await renderPracticeScreen();

    fireEvent.press(screen.getByText('Start Recording'));

    await waitFor(() => {
      expect(screen.getByTestId('practice-recording-timer')).toBeTruthy();
    });

    screen.unmount();
  });

  it('mic meter is hidden when idle', async () => {
    mockListSessions.mockResolvedValue([]);
    mockListAttempts.mockResolvedValue([]);

    const screen = await renderPracticeScreen();

    expect(screen.queryByTestId('practice-mic-meter')).toBeNull();
  });

  it('recording button has active test id while recording', async () => {
    const session = buildSession('s-1', 'Test Session', [buildQuestion('Q1', 'Easy')], '2026-03-27T10:00:00.000Z');
    mockListSessions.mockResolvedValue([session]);
    mockListAttempts.mockResolvedValue([]);

    const screen = await renderPracticeScreen();

    expect(screen.queryByTestId('practice-recording-button-active')).toBeNull();

    fireEvent.press(screen.getByText('Start Recording'));

    await waitFor(() => {
      expect(screen.getByTestId('practice-recording-button-active')).toBeTruthy();
    });

    screen.unmount();
  });

  it('notes input is collapsed by default', async () => {
    const session = buildSession('s-1', 'Test Session', [buildQuestion('Q1', 'Easy')], '2026-03-27T10:00:00.000Z');
    mockListSessions.mockResolvedValue([session]);
    mockListAttempts.mockResolvedValue([]);

    const screen = await renderPracticeScreen();

    await waitFor(() => {
      expect(screen.getByTestId('practice-selected-question-details')).toBeTruthy();
    });

    expect(screen.queryByTestId('practice-notes-input')).toBeNull();
    expect(screen.getByTestId('practice-add-notes-button')).toBeTruthy();
  });

  it('notes input expands on add notes press', async () => {
    const session = buildSession('s-1', 'Test Session', [buildQuestion('Q1', 'Easy')], '2026-03-27T10:00:00.000Z');
    mockListSessions.mockResolvedValue([session]);
    mockListAttempts.mockResolvedValue([]);

    const screen = await renderPracticeScreen();

    await waitFor(() => {
      expect(screen.getByTestId('practice-add-notes-button')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('practice-add-notes-button'));

    await waitFor(() => {
      expect(screen.getByTestId('practice-notes-input')).toBeTruthy();
    });
  });

  it('notes collapsed summary is shown when content exists', async () => {
    const session = buildSession('s-1', 'Test Session', [buildQuestion('Q1', 'Easy')], '2026-03-27T10:00:00.000Z');
    mockListSessions.mockResolvedValue([session]);
    mockListAttempts.mockResolvedValue([]);

    const screen = await renderPracticeScreen();

    await waitFor(() => {
      expect(screen.getByTestId('practice-add-notes-button')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('practice-add-notes-button'));

    await waitFor(() => {
      expect(screen.getByTestId('practice-notes-input')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByTestId('practice-notes-input'), 'This is my draft answer content');

    fireEvent.press(screen.getByTestId('practice-add-notes-button'));

    await waitFor(() => {
      expect(screen.getByTestId('practice-notes-summary')).toBeTruthy();
      expect(screen.getByText('This is my draft answer content')).toBeTruthy();
    });
  });

  it('random question picker is an icon button not a full-width AppButton', async () => {
    const session = buildSession('s-1', 'Test Session', [buildQuestion('Q1', 'Easy')], '2026-03-27T10:00:00.000Z');
    mockListSessions.mockResolvedValue([session]);
    mockListAttempts.mockResolvedValue([]);

    const screen = await renderPracticeScreen();

    await waitFor(() => {
      expect(screen.getByTestId('practice-random-question-icon-button')).toBeTruthy();
      expect(screen.queryByText('Pick Random Question')).toBeNull();
    });
  });

  it('past answers toggle uses chevron icon instead of Show/Hide text', async () => {
    const session = buildSession('s-1', 'Test Session', [buildQuestion('Q1', 'Easy')], '2026-03-27T10:00:00.000Z');
    mockListSessions.mockResolvedValue([session]);
    mockListAttempts.mockResolvedValue([]);

    const screen = await renderPracticeScreen();

    const toggle = screen.getByTestId('practice-past-answers-toggle');
    expect(within(toggle).queryByText('Show')).toBeNull();
    expect(within(toggle).queryByText('Hide')).toBeNull();
    expect(within(toggle).getByText('chevron.right')).toBeTruthy();
  });

  it('attempt score renders as compact badge in header row', async () => {
    const question = buildQuestion('Tell me about leadership.', 'Medium', 'Leadership');
    const session = buildSession('s-1', 'Management Round', [question], '2026-03-27T10:00:00.000Z');

    mockListSessions.mockResolvedValue([session]);
    mockListAttempts.mockResolvedValue([
      {
        audio_file_path: 'file:///tmp/evaluated.m4a',
        timestamp: '2026-03-27T21:05:01.151Z',
        evaluation: {
          score: 7,
          candidate_answer: 'Answer text',
          feedback: 'Good answer',
          gaps_identified: [],
          model_answer: 'Model answer',
        },
      },
    ]);

    const screen = await renderPracticeScreen();

    fireEvent.press(screen.getByTestId('practice-past-answers-toggle'));

    await waitFor(() => {
      expect(screen.getByTestId('practice-attempt-score-badge-2026-03-27T21:05:01.151Z')).toBeTruthy();
      expect(screen.getByText('7/10')).toBeTruthy();
    });
  });

  it('attempt score large standalone text is absent', async () => {
    const question = buildQuestion('Tell me about leadership.', 'Medium', 'Leadership');
    const session = buildSession('s-1', 'Management Round', [question], '2026-03-27T10:00:00.000Z');

    mockListSessions.mockResolvedValue([session]);
    mockListAttempts.mockResolvedValue([
      {
        audio_file_path: 'file:///tmp/evaluated.m4a',
        timestamp: '2026-03-27T21:05:01.151Z',
        evaluation: {
          score: 7,
          candidate_answer: 'Answer text',
          feedback: 'Good answer',
          gaps_identified: [],
          model_answer: 'Model answer',
        },
      },
    ]);

    const screen = await renderPracticeScreen();

    fireEvent.press(screen.getByTestId('practice-past-answers-toggle'));

    await waitFor(() => {
      expect(screen.queryByTestId('practice-attempt-score-2026-03-27T21:05:01.151Z')).toBeNull();
      expect(screen.getByTestId('practice-attempt-score-badge-2026-03-27T21:05:01.151Z')).toBeTruthy();
    });
  });

  it('evaluation panel uses maxHeight not percentage height', async () => {
    const question = buildQuestion('Tell me about leadership.', 'Medium', 'Leadership');
    const session = buildSession('s-1', 'Management Round', [question], '2026-03-27T10:00:00.000Z');

    mockListSessions.mockResolvedValue([session]);
    mockListAttempts.mockResolvedValue([
      {
        audio_file_path: 'file:///tmp/evaluated.m4a',
        timestamp: '2026-03-27T21:05:01.151Z',
        evaluation: {
          score: 7,
          candidate_answer: 'Answer text',
          feedback: 'Good answer',
          gaps_identified: [],
          model_answer: 'Model answer',
        },
      },
    ]);

    const screen = await renderPracticeScreen();

    fireEvent.press(screen.getByTestId('practice-past-answers-toggle'));

    await waitFor(() => {
      const panel = screen.getByTestId('practice-attempt-tab-panel-2026-03-27T21:05:01.151Z');
      expect(panel).toBeTruthy();
      expect(panel).toHaveStyle({ maxHeight: 220 });
    });
  });
});

describe('practice screen phase 8e — no-sessions empty state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { useRouter } = jest.requireMock('expo-router') as { useRouter: jest.Mock };
    useRouter.mockReturnValue({ push: jest.fn() });

    mockPatchAppSettings.mockResolvedValue({
      activeSessionId: null,
      recordingLimitSeconds: 120,
      promptSettings: {
        modelVariant: 'gemini-3.1-flash-lite-preview',
        evaluationStrictness: 'balanced',
        systemPersona: 'Coach',
      },
    });
    mockGetAppSettings.mockResolvedValue({
      activeSessionId: null,
      recordingLimitSeconds: 120,
      promptSettings: {
        modelVariant: 'gemini-3.1-flash-lite-preview',
        evaluationStrictness: 'balanced',
        systemPersona: 'Coach',
      },
    });
    mockListPendingEvaluations.mockResolvedValue([]);
    mockProcessPendingEvaluations.mockResolvedValue(0);
    mockListAttempts.mockResolvedValue([]);
  });

  it('shows single empty state card with headline and CTA when no sessions exist', async () => {
    mockListSessions.mockResolvedValue([]);

    const screen = await renderPracticeScreen();

    await waitFor(() => {
      expect(screen.getByTestId('practice-no-sessions-headline')).toBeTruthy();
      expect(screen.getByText('No sessions yet')).toBeTruthy();
      expect(screen.getByTestId('practice-no-sessions-cta')).toBeTruthy();
      expect(screen.getByText('Go to Prepare')).toBeTruthy();
    });
  });

  it('hides selection dropdowns when no sessions exist', async () => {
    mockListSessions.mockResolvedValue([]);

    const screen = await renderPracticeScreen();

    await waitFor(() => {
      expect(screen.getByTestId('practice-no-sessions-headline')).toBeTruthy();
    });

    expect(screen.queryByTestId('practice-session-dropdown-trigger')).toBeNull();
    expect(screen.queryByTestId('practice-question-dropdown-trigger')).toBeNull();
  });

  it('CTA navigates to Prepare tab', async () => {
    mockListSessions.mockResolvedValue([]);
    const mockPush = jest.fn();
    const { useRouter } = jest.requireMock('expo-router') as { useRouter: jest.Mock };
    useRouter.mockReturnValue({ push: mockPush });

    const screen = await renderPracticeScreen();

    await waitFor(() => {
      expect(screen.getByTestId('practice-no-sessions-cta')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('practice-no-sessions-cta'));

    expect(mockPush).toHaveBeenCalledWith('/(tabs)');
  });
});

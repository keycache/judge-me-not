import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as Network from 'expo-network';
import type { ReactNode } from 'react';

import { useApiKey } from '@/hooks/use-api-key';
import { buildQuestionValueKey } from '@/lib/domain/interview-models';
import { evaluateInterviewAnswer, generateInterviewQuestions } from '@/lib/genai';
import { clearAllAppData } from '@/lib/repositories/app-reset';
import { appendAttempt, listPendingEvaluations } from '@/lib/repositories/practice-repository';
import { createSessionFromQuestionList, listSessions, saveSession } from '@/lib/repositories/session-repository';
import { __resetJsonStorageForTests } from '@/lib/storage/json-storage';
import PrepareScreen from '../index';
import InsightsScreen from '../insights';
import PracticeScreen from '../practice';
import ProfileScreen from '../profile';

let networkStateListener: ((state: { isConnected?: boolean | null }) => void) | null = null;

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('@react-navigation/bottom-tabs', () => ({
  useBottomTabBarHeight: jest.fn(() => 0),
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
}));

jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(async () => ({ isConnected: true })),
  addNetworkStateListener: jest.fn((listener: (state: { isConnected?: boolean | null }) => void) => {
    networkStateListener = listener;
    return { remove: jest.fn() };
  }),
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
  AppScreen: ({ children }: { children: ReactNode }) => {
    const rn = jest.requireActual('react-native');
    return <rn.View>{children}</rn.View>;
  },
}));

jest.mock('@/components/ui/app-card', () => ({
  AppCard: ({ title, children }: { title?: string; children: ReactNode }) => {
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
  AppInput: (props: Record<string, unknown>) => {
    const rn = jest.requireActual('react-native');
    return <rn.TextInput {...props} />;
  },
}));

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: ({ name }: { name: string }) => {
    const rn = jest.requireActual('react-native');
    return <rn.Text>{name}</rn.Text>;
  },
}));

jest.mock('@/lib/genai', () => ({
  generateInterviewQuestions: jest.fn(),
  evaluateInterviewAnswer: jest.fn(),
}));

jest.mock('@/hooks/use-api-key', () => ({
  useApiKey: jest.fn(),
}));

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockGenerateInterviewQuestions = generateInterviewQuestions as jest.MockedFunction<typeof generateInterviewQuestions>;
const mockEvaluateInterviewAnswer = evaluateInterviewAnswer as jest.MockedFunction<typeof evaluateInterviewAnswer>;
const mockGetNetworkStateAsync = Network.getNetworkStateAsync as jest.MockedFunction<typeof Network.getNetworkStateAsync>;
const mockUseApiKey = useApiKey as jest.MockedFunction<typeof useApiKey>;
const backingStore = new Map<string, string>();

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('prepare to practice flow', () => {
  beforeEach(() => {
    backingStore.clear();
    __resetJsonStorageForTests();
    jest.clearAllMocks();
    networkStateListener = null;

    storage.getItem.mockImplementation(async (key: string) => backingStore.get(key) ?? null);
    storage.setItem.mockImplementation(async (key: string, value: string) => {
      backingStore.set(key, value);
    });
    storage.removeItem.mockImplementation(async (key: string) => {
      backingStore.delete(key);
    });

    mockGenerateInterviewQuestions.mockResolvedValue({
      proposedSessionName: 'Incident Response Loop',
      questionList: {
        questions: [
          {
            value: 'Tell me about a production incident you led.',
            category: 'Behavioral',
            difficulty: 'Medium',
            answer: 'Explain the incident, mitigation, communication, and measurable follow-up.',
            answers: [],
          },
        ],
      },
    });

    mockEvaluateInterviewAnswer.mockResolvedValue({
      score: 9,
      candidate_answer: 'I led mitigation and follow-up work.',
      feedback: 'Strong ownership and communication.',
      gaps_identified: ['Add more concrete metrics'],
      model_answer: 'A strong answer should cover impact, mitigation, and learning outcomes.',
    });
    mockGetNetworkStateAsync.mockResolvedValue({ isConnected: true });
    mockUseApiKey.mockReturnValue({
      apiKey: 'sk-existing',
      isLoading: false,
      loadApiKey: jest.fn(async () => 'sk-existing'),
      persistApiKey: jest.fn(async (value: string) => value),
      removeApiKey: jest.fn(async () => undefined),
    });
  });

  it('creates a generated session in Prepare, evaluates an attempt in Practice, and surfaces the result in Insights', async () => {
    const prepareScreen = render(<PrepareScreen />);

    fireEvent.changeText(
      prepareScreen.getByTestId('prepare-text-description'),
      'Senior platform engineer role with distributed systems and incident response ownership.'
    );
    fireEvent.changeText(prepareScreen.getByTestId('prepare-batch-size'), '2');
    fireEvent.press(prepareScreen.getByTestId('prepare-generate-session'));

    await waitFor(() => {
      expect(prepareScreen.getByText('Incident Response Loop')).toBeTruthy();
    });

    const sessions = await listSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].title).toBe('Incident Response Loop');

    const question = sessions[0].questionList.questions[0];
    const attempt = await appendAttempt({
      sessionId: sessions[0].id,
      questionValueKey: buildQuestionValueKey(question),
      transcript: 'I owned the mitigation plan and postmortem.',
      audioFilePath: 'file:///attempt-1.m4a',
    });

    prepareScreen.unmount();

    const practiceScreen = render(<PracticeScreen />);
    await flushAsyncWork();

    await waitFor(() => {
      expect(practiceScreen.getByTestId('practice-selected-question-full-text').props.children).toBe(
        'Tell me about a production incident you led.'
      );
    });

    fireEvent.press(practiceScreen.getByTestId('practice-past-answers-toggle'));

    await waitFor(() => {
      expect(practiceScreen.getByText('Attempt #1')).toBeTruthy();
      expect(practiceScreen.getByText('draft')).toBeTruthy();
      expect(practiceScreen.getByTestId(`practice-attempt-submit-${attempt.timestamp}`)).toBeTruthy();
    });

    fireEvent.press(practiceScreen.getByTestId(`practice-attempt-submit-${attempt.timestamp}`));

    await waitFor(() => {
      expect(practiceScreen.getByText('Attempt evaluated online.')).toBeTruthy();
      expect(practiceScreen.getByText('completed')).toBeTruthy();
      expect(practiceScreen.getByText('9/10')).toBeTruthy();
      expect(practiceScreen.getByText('I led mitigation and follow-up work.')).toBeTruthy();
    });

    expect(mockEvaluateInterviewAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        question: 'Tell me about a production incident you led.',
        audioFilePath: 'file:///attempt-1.m4a',
      })
    );

    practiceScreen.unmount();

    const insightsScreen = render(<InsightsScreen />);
    await flushAsyncWork();

    await waitFor(() => {
      expect(insightsScreen.getByTestId('insights-readiness-metric')).toBeTruthy();
      expect(insightsScreen.getByText('90%')).toBeTruthy();
      expect(insightsScreen.getByText('Average score 9/10')).toBeTruthy();
      expect(insightsScreen.getByText('Strongest category: Behavioral')).toBeTruthy();
      expect(insightsScreen.getByText('Most frequent gap: Add more concrete metrics')).toBeTruthy();
    });
  });

  it('queues an offline submit and auto-evaluates it after reconnect', async () => {
    const prepareScreen = render(<PrepareScreen />);

    fireEvent.changeText(
      prepareScreen.getByTestId('prepare-text-description'),
      'Senior platform engineer role with distributed systems and incident response ownership.'
    );
    fireEvent.changeText(prepareScreen.getByTestId('prepare-batch-size'), '2');
    fireEvent.press(prepareScreen.getByTestId('prepare-generate-session'));

    await waitFor(() => {
      expect(prepareScreen.getByText('Incident Response Loop')).toBeTruthy();
    });

    const sessions = await listSessions();
    const question = sessions[0].questionList.questions[0];
    const attempt = await appendAttempt({
      sessionId: sessions[0].id,
      questionValueKey: buildQuestionValueKey(question),
      transcript: 'I owned the mitigation plan and postmortem.',
      audioFilePath: 'file:///attempt-2.m4a',
    });

    prepareScreen.unmount();
    mockGetNetworkStateAsync.mockResolvedValueOnce({ isConnected: false });

    const practiceScreen = render(<PracticeScreen />);
    await flushAsyncWork();

    fireEvent.press(practiceScreen.getByTestId('practice-past-answers-toggle'));

    await waitFor(() => {
      expect(practiceScreen.getByTestId('practice-selected-question-details')).toBeTruthy();
      expect(practiceScreen.getByTestId(`practice-attempt-submit-${attempt.timestamp}`)).toBeTruthy();
    });

    fireEvent.press(practiceScreen.getByTestId(`practice-attempt-submit-${attempt.timestamp}`));

    await waitFor(() => {
      expect(practiceScreen.getByText('Attempt queued for evaluation (offline).')).toBeTruthy();
      expect(practiceScreen.getByText('pending')).toBeTruthy();
    });

    await expect(listPendingEvaluations()).resolves.toHaveLength(1);

    expect(mockEvaluateInterviewAnswer).not.toHaveBeenCalled();

    await act(async () => {
      networkStateListener?.({ isConnected: true });
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(practiceScreen.getByText('Auto-evaluated 1 pending attempt(s) after reconnect.')).toBeTruthy();
      expect(practiceScreen.getByText('completed')).toBeTruthy();
      expect(practiceScreen.getByText('9/10')).toBeTruthy();
    });

    await expect(listPendingEvaluations()).resolves.toHaveLength(0);

    expect(mockEvaluateInterviewAnswer).toHaveBeenCalledTimes(1);
  });

  it('restores the selected practice session after an app restart', async () => {
    const prepareScreen = render(<PrepareScreen />);

    fireEvent.changeText(
      prepareScreen.getByTestId('prepare-text-description'),
      'Senior platform engineer role with distributed systems and incident response ownership.'
    );
    fireEvent.changeText(prepareScreen.getByTestId('prepare-batch-size'), '2');
    fireEvent.press(prepareScreen.getByTestId('prepare-generate-session'));

    await waitFor(() => {
      expect(prepareScreen.getByText('Incident Response Loop')).toBeTruthy();
    });

    const generatedSessions = await listSessions();
    const extraSession = createSessionFromQuestionList({
      sessionNameFromModel: 'Architecture Recovery Loop',
      questionList: {
        questions: [
          {
            value: 'How do you recover a distributed system after a failed rollout?',
            category: 'System Design',
            difficulty: 'Hard',
            answer: 'Cover rollback, mitigation, communications, and validation.',
            answers: [],
          },
        ],
      },
      createdAt: new Date('2026-03-27T12:00:00.000Z'),
    });
    await saveSession(extraSession);

    prepareScreen.unmount();

    const firstPracticeScreen = render(<PracticeScreen />);
    await flushAsyncWork();

    fireEvent.press(firstPracticeScreen.getByTestId('practice-session-dropdown-trigger'));
    fireEvent.press(firstPracticeScreen.getByTestId(`practice-dropdown-option-${extraSession.id}`));

    await waitFor(() => {
      expect(firstPracticeScreen.getByTestId('practice-selected-question-full-text').props.children).toBe(
        'How do you recover a distributed system after a failed rollout?'
      );
    });

    firstPracticeScreen.unmount();

    const restartedPracticeScreen = render(<PracticeScreen />);
    await flushAsyncWork();

    await waitFor(() => {
      expect(restartedPracticeScreen.getByText(extraSession.title)).toBeTruthy();
      expect(restartedPracticeScreen.getByTestId('practice-selected-question-full-text').props.children).toBe(
        'How do you recover a distributed system after a failed rollout?'
      );
    });

    expect(generatedSessions).toHaveLength(1);
  });

  it('persists profile prompt settings across relaunch and propagates them into evaluation', async () => {
    const profileScreen = render(<ProfileScreen />);
    await flushAsyncWork();

    fireEvent.press(profileScreen.getAllByText('gemini-2.5-flash-lite-preview')[0]);
    fireEvent.press(profileScreen.getAllByText('strict')[0]);
    fireEvent.changeText(profileScreen.getByDisplayValue('Direct and constructive interview coach'), 'Strict systems interviewer');
    fireEvent.changeText(profileScreen.getByDisplayValue('120'), '180');
    fireEvent.press(profileScreen.getByText('Save Prompt + Practice Settings'));

    await waitFor(() => {
      expect(profileScreen.getByText('Prompt and practice settings updated.')).toBeTruthy();
    });

    profileScreen.unmount();

    const relaunchedProfile = render(<ProfileScreen />);
    await flushAsyncWork();

    await waitFor(() => {
      expect(relaunchedProfile.getByDisplayValue('Strict systems interviewer')).toBeTruthy();
      expect(relaunchedProfile.getByDisplayValue('180')).toBeTruthy();
    });

    relaunchedProfile.unmount();

    const prepareScreen = render(<PrepareScreen />);
    fireEvent.changeText(
      prepareScreen.getByTestId('prepare-text-description'),
      'Senior platform engineer role with distributed systems and incident response ownership.'
    );
    fireEvent.changeText(prepareScreen.getByTestId('prepare-batch-size'), '2');
    fireEvent.press(prepareScreen.getByTestId('prepare-generate-session'));

    await waitFor(() => {
      expect(prepareScreen.getByText('Incident Response Loop')).toBeTruthy();
    });

    const sessions = await listSessions();
    const question = sessions[0].questionList.questions[0];
    const attempt = await appendAttempt({
      sessionId: sessions[0].id,
      questionValueKey: buildQuestionValueKey(question),
      transcript: 'I owned the mitigation plan and postmortem.',
      audioFilePath: 'file:///attempt-3.m4a',
    });

    prepareScreen.unmount();

    const practiceScreen = render(<PracticeScreen />);
    await flushAsyncWork();

    await waitFor(() => {
      expect(practiceScreen.getByTestId('practice-selected-question-details')).toBeTruthy();
    });

    fireEvent.press(practiceScreen.getByTestId('practice-past-answers-toggle'));
    fireEvent.press(practiceScreen.getByTestId(`practice-attempt-submit-${attempt.timestamp}`));

    await waitFor(() => {
      expect(practiceScreen.getByText('Attempt evaluated online.')).toBeTruthy();
    });

    expect(mockEvaluateInterviewAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        promptSettings: {
          modelVariant: 'gemini-2.5-flash-lite-preview',
          evaluationStrictness: 'strict',
          systemPersona: 'Strict systems interviewer',
        },
      })
    );
  });

  it('can create a brand-new session in the same run after clear all data', async () => {
    const seededSession = createSessionFromQuestionList({
      sessionNameFromModel: 'Seed Session',
      questionList: {
        questions: [
          {
            value: 'Tell me about incident response ownership.',
            category: 'Behavioral',
            difficulty: 'Medium',
            answer: 'Discuss leadership, mitigation, and follow-through.',
            answers: [],
          },
        ],
      },
      createdAt: new Date('2026-03-27T09:00:00.000Z'),
    });
    await saveSession(seededSession);

    await clearAllAppData();

    const prepareScreen = render(<PrepareScreen />);
    await flushAsyncWork();

    await waitFor(() => {
      expect(prepareScreen.getByTestId('prepare-no-sessions')).toBeTruthy();
    });

    fireEvent.changeText(
      prepareScreen.getByTestId('prepare-text-description'),
      'Senior platform engineer role with distributed systems and incident response ownership.'
    );
    fireEvent.changeText(prepareScreen.getByTestId('prepare-batch-size'), '2');
    fireEvent.press(prepareScreen.getByTestId('prepare-generate-session'));

    await waitFor(() => {
      expect(prepareScreen.getByText('Incident Response Loop')).toBeTruthy();
    });

    const sessions = await listSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].title).toBe('Incident Response Loop');
  });
});

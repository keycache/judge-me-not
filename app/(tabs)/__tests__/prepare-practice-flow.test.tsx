import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { buildQuestionValueKey } from '@/lib/domain/interview-models';
import { evaluateInterviewAnswer, generateInterviewQuestions } from '@/lib/genai';
import { appendAttempt } from '@/lib/repositories/practice-repository';
import { listSessions } from '@/lib/repositories/session-repository';
import { __resetJsonStorageForTests } from '@/lib/storage/json-storage';
import PrepareScreen from '../index';
import PracticeScreen from '../practice';

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
  AppButton: ({ label, onPress, testID, disabled }: { label: string; onPress: () => void; testID?: string; disabled?: boolean }) => {
    const rn = jest.requireActual('react-native');
    return (
      <rn.TouchableOpacity disabled={disabled} onPress={onPress} testID={testID}>
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

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockGenerateInterviewQuestions = generateInterviewQuestions as jest.MockedFunction<typeof generateInterviewQuestions>;
const mockEvaluateInterviewAnswer = evaluateInterviewAnswer as jest.MockedFunction<typeof evaluateInterviewAnswer>;
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
  });

  it('creates a generated session in Prepare and evaluates an attempt in Practice', async () => {
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
      expect(practiceScreen.getByText(`Audio: ${attempt.audio_file_path}`)).toBeTruthy();
      expect(practiceScreen.getByText('Status: draft')).toBeTruthy();
    });

    fireEvent.press(practiceScreen.getByText('Submit'));

    await waitFor(() => {
      expect(practiceScreen.getByText('Attempt evaluated online.')).toBeTruthy();
      expect(practiceScreen.getByText('Status: completed')).toBeTruthy();
      expect(practiceScreen.getByText('Score: 9/10')).toBeTruthy();
    });

    expect(mockEvaluateInterviewAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        question: 'Tell me about a production incident you led.',
        audioFilePath: 'file:///attempt-1.m4a',
      })
    );
  });
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { clearAllAppData } from '@/lib/repositories/app-reset';
import { createSessionFromQuestionList, saveSession } from '@/lib/repositories/session-repository';
import { __resetJsonStorageForTests } from '@/lib/storage/json-storage';
import PrepareScreen from '../index';
import InsightsScreen from '../insights';
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

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const backingStore = new Map<string, string>();

function buildQuestionList() {
  return {
    questions: [
      {
        value: 'Tell me about a difficult incident you handled.',
        category: 'Behavioral',
        difficulty: 'Medium' as const,
        answer: 'Explain context, actions, and results.',
        answers: [],
      },
    ],
  };
}

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('empty states after clear all', () => {
  beforeEach(async () => {
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

    const session = createSessionFromQuestionList({
      sessionNameFromModel: 'Reset Empty State Session',
      questionList: buildQuestionList(),
      createdAt: new Date('2026-03-27T11:00:00.000Z'),
    });
    await saveSession(session);

    await clearAllAppData();
  });

  it('shows prepare empty state after clear all', async () => {
    const screen = render(<PrepareScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('prepare-no-sessions')).toBeTruthy();
      expect(screen.getByText('Generate Session')).toBeTruthy();
    });
  });

  it('shows practice empty state after clear all', async () => {
    const screen = render(<PracticeScreen />);
    await flushAsyncWork();

    await waitFor(() => {
      expect(screen.getByText('No sessions available.')).toBeTruthy();
      expect(screen.getByText('No session/questions available. Generate one from Prepare first.')).toBeTruthy();
      expect(screen.getByText('Pending Evaluations: 0')).toBeTruthy();
    });
  });

  it('shows insights empty state after clear all', async () => {
    const screen = render(<InsightsScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('insights-empty-state')).toBeTruthy();
      expect(screen.getByText('Sessions tracked: 0')).toBeTruthy();
      expect(screen.getByText('Attempts tracked: 0')).toBeTruthy();
    });
  });
});

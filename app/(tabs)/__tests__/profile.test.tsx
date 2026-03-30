import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Alert } from 'react-native';

import { useApiKey } from '@/hooks/use-api-key';
import { clearAllAppData } from '@/lib/repositories/app-reset';
import { getAppSettings, patchAppSettings } from '@/lib/repositories/settings-repository';
import ProfileScreen from '../profile';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('@react-navigation/bottom-tabs', () => ({
  useBottomTabBarHeight: jest.fn(() => 0),
}));

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

jest.mock('@/hooks/use-api-key', () => ({
  useApiKey: jest.fn(),
}));

jest.mock('@/lib/repositories/app-reset', () => ({
  clearAllAppData: jest.fn(async () => undefined),
}));

jest.mock('@/lib/repositories/settings-repository', () => ({
  getAppSettings: jest.fn(),
  patchAppSettings: jest.fn(),
}));

const mockUseApiKey = useApiKey as jest.MockedFunction<typeof useApiKey>;
const mockClearAllAppData = clearAllAppData as jest.MockedFunction<typeof clearAllAppData>;
const mockGetAppSettings = getAppSettings as jest.MockedFunction<typeof getAppSettings>;
const mockPatchAppSettings = patchAppSettings as jest.MockedFunction<typeof patchAppSettings>;

describe('profile screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    mockUseApiKey.mockReturnValue({
      apiKey: 'sk-existing',
      isLoading: false,
      loadApiKey: jest.fn(async () => null),
      persistApiKey: jest.fn(async (value: string) => value),
      removeApiKey: jest.fn(async () => undefined),
    });

    mockGetAppSettings.mockResolvedValue({
      activeSessionId: null,
      recordingLimitSeconds: 120,
      promptSettings: {
        modelVariant: 'gemini-3.1-flash-lite-preview',
        evaluationStrictness: 'balanced',
        systemPersona: 'Direct and constructive interview coach',
      },
    });

    mockPatchAppSettings.mockImplementation(async (patch) => ({
      activeSessionId: patch.activeSessionId ?? null,
      recordingLimitSeconds: patch.recordingLimitSeconds ?? 120,
      promptSettings: {
        modelVariant: patch.promptSettings?.modelVariant ?? 'gemini-3.1-flash-lite-preview',
        evaluationStrictness: patch.promptSettings?.evaluationStrictness ?? 'balanced',
        systemPersona: patch.promptSettings?.systemPersona ?? 'Direct and constructive interview coach',
      },
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('opens destructive confirmation and executes clear-all when confirmed', async () => {
    const loadApiKey = jest.fn(async () => null);
    mockUseApiKey.mockReturnValue({
      apiKey: 'sk-existing',
      isLoading: false,
      loadApiKey,
      persistApiKey: jest.fn(async (value: string) => value),
      removeApiKey: jest.fn(async () => undefined),
    });

    const screen = render(<ProfileScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('profile-clear-all-data')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('profile-clear-all-data'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Clear all app data?',
      expect.stringContaining('removes sessions, attempts, pending evaluations'),
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
        expect.objectContaining({ text: 'Clear All', style: 'destructive', onPress: expect.any(Function) }),
      ])
    );

    const alertButtons = (Alert.alert as jest.Mock).mock.calls[0][2] as Array<{ text: string; onPress?: () => void }>;
    const destructiveAction = alertButtons.find((button) => button.text === 'Clear All');

    await act(async () => {
      destructiveAction?.onPress?.();
    });

    await waitFor(() => {
      expect(mockClearAllAppData).toHaveBeenCalled();
      expect(loadApiKey).toHaveBeenCalled();
      expect(screen.getByText('All local app data cleared. Returning to setup.')).toBeTruthy();
    });
  });

  it('does not clear data when destructive confirmation is cancelled', async () => {
    const loadApiKey = jest.fn(async () => null);
    mockUseApiKey.mockReturnValue({
      apiKey: 'sk-existing',
      isLoading: false,
      loadApiKey,
      persistApiKey: jest.fn(async (value: string) => value),
      removeApiKey: jest.fn(async () => undefined),
    });

    const screen = render(<ProfileScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('profile-clear-all-data')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('profile-clear-all-data'));

    const alertButtons = (Alert.alert as jest.Mock).mock.calls[0][2] as Array<{ text: string; onPress?: () => void }>;
    const cancelAction = alertButtons.find((button) => button.text === 'Cancel');

    await act(async () => {
      cancelAction?.onPress?.();
    });

    expect(mockClearAllAppData).not.toHaveBeenCalled();
    expect(loadApiKey).not.toHaveBeenCalled();
    expect(screen.queryByText('All local app data cleared. Returning to setup.')).toBeNull();
  });
});

describe('profile screen phase 8d — structural polish', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    mockUseApiKey.mockReturnValue({
      apiKey: 'sk-existing',
      isLoading: false,
      loadApiKey: jest.fn(async () => null),
      persistApiKey: jest.fn(async (value: string) => value),
      removeApiKey: jest.fn(async () => undefined),
    });

    mockGetAppSettings.mockResolvedValue({
      activeSessionId: null,
      recordingLimitSeconds: 120,
      promptSettings: {
        modelVariant: 'gemini-3.1-flash-lite-preview',
        evaluationStrictness: 'balanced',
        systemPersona: 'Direct and constructive interview coach',
      },
    });

    mockPatchAppSettings.mockImplementation(async (patch) => ({
      activeSessionId: patch.activeSessionId ?? null,
      recordingLimitSeconds: patch.recordingLimitSeconds ?? 120,
      promptSettings: {
        modelVariant: patch.promptSettings?.modelVariant ?? 'gemini-3.1-flash-lite-preview',
        evaluationStrictness: patch.promptSettings?.evaluationStrictness ?? 'balanced',
        systemPersona: patch.promptSettings?.systemPersona ?? 'Direct and constructive interview coach',
      },
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('App State card is removed', async () => {
    const screen = render(<ProfileScreen />);

    await waitFor(() => {
      expect(screen.getByText('API Settings')).toBeTruthy();
    });

    expect(screen.queryByText('App State')).toBeNull();
  });

  it('key status renders inside API Settings card', async () => {
    const screen = render(<ProfileScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('profile-key-status')).toBeTruthy();
      expect(screen.getByText('Current key status: Configured')).toBeTruthy();
    });
  });

  it('danger zone wrapper has warning left border', async () => {
    const screen = render(<ProfileScreen />);

    await waitFor(() => {
      const wrapper = screen.getByTestId('profile-danger-zone-wrapper');
      expect(wrapper).toBeTruthy();
      expect(wrapper).toHaveStyle({ borderLeftColor: '#F59E0B' });
    });
  });

  it('prompt preview is collapsed by default', async () => {
    const screen = render(<ProfileScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('profile-prompt-preview-toggle')).toBeTruthy();
      expect(screen.getByText('Show Prompt Preview')).toBeTruthy();
      expect(screen.queryByTestId('profile-prompt-preview-text')).toBeNull();
    });
  });

  it('prompt preview expands on show press', async () => {
    const screen = render(<ProfileScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('profile-prompt-preview-toggle')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('profile-prompt-preview-toggle'));

    await waitFor(() => {
      expect(screen.getByTestId('profile-prompt-preview-text')).toBeTruthy();
      expect(screen.getByText('Hide Prompt Preview')).toBeTruthy();
    });
  });

  it('model variant renders as radio list with per-variant row test IDs', async () => {
    const screen = render(<ProfileScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('profile-model-variant-row-gemini-2.5-flash-lite-preview')).toBeTruthy();
      expect(screen.getByTestId('profile-model-variant-row-gemini-3.1-flash-lite-preview')).toBeTruthy();
    });
  });
});

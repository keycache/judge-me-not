import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { Session } from '@/lib/domain/session-models';
import { generateInterviewQuestions } from '@/lib/genai';
import { createSessionFromQuestionList, listSessions, saveSession } from '@/lib/repositories/session-repository';
import { getAppSettings } from '@/lib/repositories/settings-repository';
import PrepareScreen from '../index';

jest.mock('@react-navigation/bottom-tabs', () => ({
  useBottomTabBarHeight: jest.fn(() => 0),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
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

jest.mock('@/lib/genai', () => ({
  generateInterviewQuestions: jest.fn(),
}));

jest.mock('@/lib/repositories/settings-repository', () => ({
  getAppSettings: jest.fn(),
}));

jest.mock('@/lib/repositories/session-repository', () => ({
  createSessionFromQuestionList: jest.fn(),
  deleteSession: jest.fn(),
  listSessions: jest.fn(),
  saveSession: jest.fn(),
}));

const mockListSessions = listSessions as jest.MockedFunction<typeof listSessions>;
const mockGenerateInterviewQuestions = generateInterviewQuestions as jest.MockedFunction<typeof generateInterviewQuestions>;
const mockCreateSessionFromQuestionList = createSessionFromQuestionList as jest.MockedFunction<typeof createSessionFromQuestionList>;
const mockSaveSession = saveSession as jest.MockedFunction<typeof saveSession>;
const mockGetAppSettings = getAppSettings as jest.MockedFunction<typeof getAppSettings>;

function buildSession(overrides: Partial<Session>): Session {
  return {
    id: 'session-1',
    title: 'Session Title',
    createdAtIso: '2026-03-27T10:00:00.000Z',
    updatedAtIso: '2026-03-27T10:00:00.000Z',
    questionList: {
      questions: [
        {
          value: 'Tell me about a challenge you solved.',
          category: 'Behavioral',
          difficulty: 'Medium',
          answer: 'Use STAR and quantify impact.',
          answers: [],
        },
      ],
    },
    audioIndex: [],
    promptSnapshot: {
      modelVariant: 'gemini-3.1-flash-lite-preview',
      evaluationStrictness: 'balanced',
      systemPersona: 'Coach',
      resolvedPrompt: 'stub',
    },
    sourceContext: {
      inputMode: 'text',
      sourceText: 'Default source text',
    },
    ...overrides,
  };
}

describe('prepare session details modal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListSessions.mockResolvedValue([]);
    mockGetAppSettings.mockResolvedValue({
      activeSessionId: null,
      recordingLimitSeconds: 120,
      promptSettings: {
        modelVariant: 'gemini-3.1-flash-lite-preview',
        evaluationStrictness: 'balanced',
        systemPersona: 'Coach',
      },
    });
  });

  it('shows text source and generation settings for text sessions', async () => {
    const textSession = buildSession({
      title: 'Backend Interview Prep',
      sourceContext: {
        inputMode: 'text',
        sourceText: 'Senior backend role with distributed systems focus.',
      },
      promptSnapshot: {
        modelVariant: 'gemini-2.5-flash-lite-preview',
        evaluationStrictness: 'strict',
        systemPersona: 'Direct and concise',
        resolvedPrompt: 'prompt',
      },
    });

    mockListSessions.mockResolvedValue([textSession]);

    const screen = render(<PrepareScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('prepare-session-row-0')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('prepare-session-row-0'));

    await waitFor(() => {
      expect(screen.getByTestId('prepare-session-details-modal')).toBeTruthy();
      expect(screen.getByTestId('prepare-session-details-source-text')).toBeTruthy();
      expect(screen.getByText('Senior backend role with distributed systems focus.')).toBeTruthy();
      expect(screen.getByText('Model: gemini-2.5-flash-lite-preview')).toBeTruthy();
      expect(screen.getByText('Strictness: strict')).toBeTruthy();
      expect(screen.getByText('Persona: Direct and concise')).toBeTruthy();
    });
  });

  it('shows image carousel metadata for image sessions', async () => {
    const imageSession = buildSession({
      id: 'session-2',
      title: 'Image Interview Session',
      sourceContext: {
        inputMode: 'image',
        imageUris: ['file:///tmp/a.png', 'file:///tmp/b.png'],
      },
    });

    mockListSessions.mockResolvedValue([imageSession]);

    const screen = render(<PrepareScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('prepare-session-row-0')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('prepare-session-row-0'));

    await waitFor(() => {
      expect(screen.getByTestId('prepare-session-details-modal')).toBeTruthy();
      expect(screen.getByTestId('prepare-session-details-image-count')).toBeTruthy();
      expect(screen.getByText('Image 1 of 2')).toBeTruthy();
      expect(screen.getByText('file:///tmp/a.png')).toBeTruthy();
    });
  });

  it('exposes an accessibility label for the session delete icon action', async () => {
    const textSession = buildSession({
      title: 'Backend Interview Prep',
      sourceContext: {
        inputMode: 'text',
        sourceText: 'Senior backend role with distributed systems focus.',
      },
    });

    mockListSessions.mockResolvedValue([textSession]);

    const screen = render(<PrepareScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('Delete Backend Interview Prep')).toBeTruthy();
    });
  });

  it('shows loading feedback while a session is being generated and uses model-proposed title', async () => {
    let resolveGeneration: ((value: { proposedSessionName?: string; questionList: Session['questionList'] }) => void) | null = null;
    const generationPromise = new Promise<{ proposedSessionName?: string; questionList: Session['questionList'] }>((resolve) => {
      resolveGeneration = resolve;
    });

    mockGenerateInterviewQuestions.mockReturnValue(generationPromise);
    mockCreateSessionFromQuestionList.mockImplementation(({ sessionNameFromModel, questionList }) =>
      buildSession({
        title: sessionNameFromModel,
        questionList,
      })
    );
    mockSaveSession.mockImplementation(async (session) => session);

    const screen = render(<PrepareScreen />);

    fireEvent.changeText(screen.getByTestId('prepare-text-description'), 'Senior platform engineer role with distributed systems focus.');
    fireEvent.changeText(screen.getByTestId('prepare-batch-size'), '2');
    fireEvent.press(screen.getByTestId('prepare-generate-session'));

    await waitFor(() => {
      expect(screen.getByTestId('prepare-generation-loading')).toBeTruthy();
      expect(screen.getByText('Generating session draft...')).toBeTruthy();
    });

    resolveGeneration?.({
      proposedSessionName: 'Distributed Systems Loop',
      questionList: {
        questions: [
          {
            value: 'Tell me about a distributed systems incident.',
            category: 'Behavioral',
            difficulty: 'Medium',
            answer: 'Explain the incident, mitigation, and lessons learned.',
            answers: [],
          },
        ],
      },
    });

    await waitFor(() => {
      expect(mockCreateSessionFromQuestionList).toHaveBeenCalledWith(
        expect.objectContaining({ sessionNameFromModel: 'Distributed Systems Loop' })
      );
      expect(screen.queryByTestId('prepare-generation-loading')).toBeNull();
    });
  });
});
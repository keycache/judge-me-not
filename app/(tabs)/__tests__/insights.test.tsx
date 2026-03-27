import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { listSessions } from '@/lib/repositories/session-repository';
import InsightsScreen from '../insights';

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

jest.mock('@/lib/repositories/session-repository', () => ({
  listSessions: jest.fn(),
}));

const mockListSessions = listSessions as jest.MockedFunction<typeof listSessions>;

describe('insights screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows an empty state when no evaluated attempts exist', async () => {
    mockListSessions.mockResolvedValue([]);

    const screen = render(<InsightsScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('insights-empty-state')).toBeTruthy();
      expect(screen.getByText(/unlock readiness and coaching trends/i)).toBeTruthy();
    });
  });

  it('shows summary metrics when evaluated attempts exist', async () => {
    mockListSessions.mockResolvedValue([
      {
        id: 'session-1',
        title: 'Incident Response Loop',
        createdAtIso: '2026-03-27T10:00:00.000Z',
        updatedAtIso: '2026-03-27T10:00:00.000Z',
        audioIndex: [],
        promptSnapshot: null,
        questionList: {
          questions: [
            {
              value: 'Tell me about a production incident.',
              category: 'Incident Management',
              difficulty: 'Medium',
              answer: 'Explain incident handling.',
              answers: [
                {
                  audio_file_path: 'file:///a1.m4a',
                  timestamp: '2026-03-27T10:10:00.000Z',
                  evaluation: {
                    score: 8,
                    candidate_answer: 'I led mitigation.',
                    feedback: 'Good structure.',
                    gaps_identified: ['Add clearer metrics'],
                    model_answer: 'Stronger answer.',
                  },
                },
              ],
            },
          ],
        },
      },
    ]);

    const screen = render(<InsightsScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('insights-readiness-metric')).toBeTruthy();
      expect(screen.getByText('80%')).toBeTruthy();
      expect(screen.getByText('Strongest category: Incident Management')).toBeTruthy();
      expect(screen.getByText('Most frequent gap: Add clearer metrics')).toBeTruthy();
    });
  });

  it('switches between all-session and per-session summaries', async () => {
    mockListSessions.mockResolvedValue([
      {
        id: 'session-1',
        title: 'Incident Response Loop',
        createdAtIso: '2026-03-27T10:00:00.000Z',
        updatedAtIso: '2026-03-27T10:00:00.000Z',
        audioIndex: [],
        promptSnapshot: null,
        questionList: {
          questions: [
            {
              value: 'Tell me about a production incident.',
              category: 'Incident Management',
              difficulty: 'Medium',
              answer: 'Explain incident handling.',
              answers: [
                {
                  audio_file_path: 'file:///a1.m4a',
                  timestamp: '2026-03-27T10:10:00.000Z',
                  evaluation: {
                    score: 8,
                    candidate_answer: 'I led mitigation.',
                    feedback: 'Good structure.',
                    gaps_identified: ['Add clearer metrics'],
                    model_answer: 'Stronger answer.',
                  },
                },
              ],
            },
          ],
        },
      },
      {
        id: 'session-2',
        title: 'Architecture Review Loop',
        createdAtIso: '2026-03-27T11:00:00.000Z',
        updatedAtIso: '2026-03-27T11:00:00.000Z',
        audioIndex: [],
        promptSnapshot: null,
        questionList: {
          questions: [
            {
              value: 'Tell me about a system design trade-off.',
              category: 'System Design',
              difficulty: 'Hard',
              answer: 'Explain trade-offs and impact.',
              answers: [
                {
                  audio_file_path: 'file:///a2.m4a',
                  timestamp: '2026-03-27T11:10:00.000Z',
                  evaluation: {
                    score: 6,
                    candidate_answer: 'I discussed a caching strategy.',
                    feedback: 'Needs stronger trade-off framing.',
                    gaps_identified: ['Clarify trade-offs'],
                    model_answer: 'More balanced answer.',
                  },
                },
              ],
            },
          ],
        },
      },
    ]);

    const screen = render(<InsightsScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('insights-readiness-metric')).toBeTruthy();
      expect(screen.getByText('70%')).toBeTruthy();
      expect(screen.getByTestId('insights-session-scope-copy')).toBeTruthy();
      expect(screen.getByText('Aggregated across 2 sessions')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('insights-session-dropdown-trigger'));
    fireEvent.press(screen.getByTestId('insights-dropdown-option-session-2'));

    await waitFor(() => {
      expect(screen.getByText('60%')).toBeTruthy();
      expect(screen.getByText('Average score 6/10')).toBeTruthy();
      expect(screen.getByText('Strongest category: System Design')).toBeTruthy();
      expect(screen.getByText('Most frequent gap: Clarify trade-offs')).toBeTruthy();
      expect(screen.getByText('Filtered to Architecture Review Loop')).toBeTruthy();
    });
  });
});

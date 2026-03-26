import React, { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { ApiKeyProvider, useApiKey } from '../use-api-key';

jest.mock('@/lib/settings-store', () => ({
  getApiKey: jest.fn(),
  saveApiKey: jest.fn(),
  clearApiKey: jest.fn(),
}));

import { clearApiKey, getApiKey, saveApiKey } from '@/lib/settings-store';

type ApiKeySnapshot = {
  apiKey: string | null;
  isLoading: boolean;
  persistApiKey: (value: string) => Promise<string>;
  removeApiKey: () => Promise<void>;
};

const mockedGetApiKey = getApiKey as jest.MockedFunction<typeof getApiKey>;
const mockedSaveApiKey = saveApiKey as jest.MockedFunction<typeof saveApiKey>;
const mockedClearApiKey = clearApiKey as jest.MockedFunction<typeof clearApiKey>;

let consoleErrorSpy: jest.SpyInstance;

function Observer({ onUpdate }: { onUpdate: (snapshot: ApiKeySnapshot) => void }) {
  const state = useApiKey();

  useEffect(() => {
    onUpdate(state);
  }, [onUpdate, state]);

  return null;
}

describe('useApiKey provider integration', () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const originalConsoleError = console.error;

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      const firstArg = String(args[0] ?? '');
      if (firstArg.includes('react-test-renderer is deprecated')) {
        return;
      }

      if (firstArg.includes('The current testing environment is not configured to support act')) {
        return;
      }

      // Keep unexpected console errors visible in test output.
      originalConsoleError(...args);
    });
  });

  let renderer: ReactTestRenderer | null = null;
  let latestSnapshot: ApiKeySnapshot | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    latestSnapshot = null;
    mockedGetApiKey.mockResolvedValue(null);
    mockedSaveApiKey.mockImplementation(async (value) => value.trim());
    mockedClearApiKey.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    if (renderer) {
      await act(async () => {
        renderer?.unmount();
      });
      renderer = null;
    }
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  async function renderProvider() {
    await act(async () => {
      renderer = create(
        React.createElement(
          ApiKeyProvider,
          null,
          React.createElement(Observer, {
            onUpdate: (snapshot) => {
              latestSnapshot = snapshot;
            },
          })
        )
      );
    });

    await act(async () => {
      await Promise.resolve();
    });
  }

  it('hydrates stored key and exits loading state', async () => {
    mockedGetApiKey.mockResolvedValue('sk-from-store');

    await renderProvider();

    expect(latestSnapshot?.isLoading).toBe(false);
    expect(latestSnapshot?.apiKey).toBe('sk-from-store');
    expect(mockedGetApiKey).toHaveBeenCalledTimes(1);
  });

  it('updates context state after persist and clear actions', async () => {
    await renderProvider();

    expect(latestSnapshot?.apiKey).toBeNull();

    await act(async () => {
      await latestSnapshot?.persistApiKey('  sk-new-key  ');
    });

    expect(mockedSaveApiKey).toHaveBeenCalledWith('  sk-new-key  ');
    expect(latestSnapshot?.apiKey).toBe('sk-new-key');

    await act(async () => {
      await latestSnapshot?.removeApiKey();
    });

    expect(mockedClearApiKey).toHaveBeenCalledTimes(1);
    expect(latestSnapshot?.apiKey).toBeNull();
  });
});

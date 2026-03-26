import { createContext, createElement, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { clearApiKey, getApiKey, saveApiKey } from '@/lib/settings-store';

interface ApiKeyContextValue {
  apiKey: string | null;
  isLoading: boolean;
  loadApiKey: () => Promise<string | null>;
  persistApiKey: (value: string) => Promise<string>;
  removeApiKey: () => Promise<void>;
}

const ApiKeyContext = createContext<ApiKeyContextValue | null>(null);
const HYDRATION_TIMEOUT_MS = 1500;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallbackValue: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(fallbackValue), timeoutMs);
    }),
  ]);
}

export function ApiKeyProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadApiKey = useCallback(async (): Promise<string | null> => {
    setIsLoading(true);
    try {
      const value = await withTimeout(getApiKey(), HYDRATION_TIMEOUT_MS, null);
      setApiKey(value);
      return value;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const persistApiKey = useCallback(async (value: string) => {
    const saved = await saveApiKey(value);
    setApiKey(saved);
    return saved;
  }, []);

  const removeApiKey = useCallback(async () => {
    await clearApiKey();
    setApiKey(null);
  }, []);

  useEffect(() => {
    void loadApiKey();
  }, [loadApiKey]);

  const value = useMemo(
    () => ({ apiKey, isLoading, loadApiKey, persistApiKey, removeApiKey }),
    [apiKey, isLoading, loadApiKey, persistApiKey, removeApiKey]
  );

  return createElement(ApiKeyContext.Provider, { value }, children);
}

export function useApiKey() {
  const context = useContext(ApiKeyContext);

  if (!context) {
    throw new Error('useApiKey must be used within an ApiKeyProvider.');
  }

  return context;
}

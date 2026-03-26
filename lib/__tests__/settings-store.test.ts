import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_KEY_STORAGE_KEY, clearApiKey, getApiKey, saveApiKey } from '../settings-store';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const nativeUnavailableError = new Error('Native module is null, cannot access legacy storage');
const unexpectedError = new Error('disk failure');

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('settings store', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    storage.getItem.mockResolvedValue(null);
    storage.setItem.mockResolvedValue(undefined);
    storage.removeItem.mockResolvedValue(undefined);
    await clearApiKey();
  });

  it('normalizes and persists API key', async () => {
    await saveApiKey('  sk-test-123  ');

    expect(storage.setItem).toHaveBeenCalledWith(API_KEY_STORAGE_KEY, 'sk-test-123');
  });

  it('returns stored key from AsyncStorage when available', async () => {
    storage.getItem.mockResolvedValue('sk-live-value');

    const value = await getApiKey();

    expect(value).toBe('sk-live-value');
    expect(storage.getItem).toHaveBeenCalledWith(API_KEY_STORAGE_KEY);
  });

  it('uses in-memory fallback when native storage module is unavailable', async () => {
    storage.setItem.mockRejectedValue(nativeUnavailableError);
    storage.getItem.mockRejectedValue(nativeUnavailableError);

    await expect(saveApiKey('sk-fallback')).resolves.toBe('sk-fallback');
    await expect(getApiKey()).resolves.toBe('sk-fallback');
  });

  it('clears in-memory fallback even when native remove fails with unavailable error', async () => {
    storage.setItem.mockRejectedValue(nativeUnavailableError);
    storage.getItem.mockRejectedValue(nativeUnavailableError);
    storage.removeItem.mockRejectedValue(nativeUnavailableError);

    await saveApiKey('sk-to-clear');
    await clearApiKey();

    await expect(getApiKey()).resolves.toBeNull();
  });

  it('rethrows unexpected save failures', async () => {
    storage.setItem.mockRejectedValue(unexpectedError);

    await expect(saveApiKey('sk-fail')).rejects.toThrow('disk failure');
  });

  it('rethrows unexpected clear failures', async () => {
    storage.removeItem.mockRejectedValue(unexpectedError);

    await expect(clearApiKey()).rejects.toThrow('disk failure');
  });
});

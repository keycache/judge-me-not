import AsyncStorage from '@react-native-async-storage/async-storage';

import { getAppSettings, patchAppSettings, saveAppSettings } from '@/lib/repositories/settings-repository';
import { __resetJsonStorageForTests } from '@/lib/storage/json-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const backingStore = new Map<string, string>();

describe('settings repository', () => {
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
  });

  it('returns defaults when no settings are persisted', async () => {
    const settings = await getAppSettings();

    expect(settings.activeSessionId).toBeNull();
    expect(settings.recordingLimitSeconds).toBe(120);
  });

  it('persists and patches settings json', async () => {
    await saveAppSettings({ activeSessionId: 'session-1', recordingLimitSeconds: 180 });

    const patched = await patchAppSettings({ activeSessionId: 'session-2' });

    expect(patched.activeSessionId).toBe('session-2');
    expect(patched.recordingLimitSeconds).toBe(180);
  });
});

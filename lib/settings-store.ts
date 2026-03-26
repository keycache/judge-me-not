import AsyncStorage from '@react-native-async-storage/async-storage';

let inMemoryApiKey: string | null = null;

export const API_KEY_STORAGE_KEY = 'judge-me-not.api-key';

function isNativeStorageUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return /native module is null|legacy storage/i.test(error.message);
}

export async function getApiKey(): Promise<string | null> {
  try {
    const value = await AsyncStorage.getItem(API_KEY_STORAGE_KEY);
    inMemoryApiKey = value;
    return value;
  } catch (error) {
    if (isNativeStorageUnavailable(error)) {
      return inMemoryApiKey;
    }

    return inMemoryApiKey;
  }
}

export async function saveApiKey(rawApiKey: string): Promise<string> {
  const normalized = rawApiKey.trim();
  inMemoryApiKey = normalized;

  try {
    await AsyncStorage.setItem(API_KEY_STORAGE_KEY, normalized);
  } catch (error) {
    if (!isNativeStorageUnavailable(error)) {
      throw error;
    }
  }

  return normalized;
}

export async function clearApiKey(): Promise<void> {
  inMemoryApiKey = null;

  try {
    await AsyncStorage.removeItem(API_KEY_STORAGE_KEY);
  } catch (error) {
    if (!isNativeStorageUnavailable(error)) {
      throw error;
    }
  }
}

import AsyncStorage from '@react-native-async-storage/async-storage';

const memoryStore = new Map<string, string>();

function isNativeStorageUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return /native module is null|legacy storage/i.test(error.message);
}

export async function readJsonValue<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) {
      return fallback;
    }

    memoryStore.set(key, raw);
    return JSON.parse(raw) as T;
  } catch (error) {
    if (isNativeStorageUnavailable(error)) {
      const fromMemory = memoryStore.get(key);
      return fromMemory ? (JSON.parse(fromMemory) as T) : fallback;
    }

    return fallback;
  }
}

export async function writeJsonValue<T>(key: string, value: T): Promise<void> {
  const raw = JSON.stringify(value);
  memoryStore.set(key, raw);

  try {
    await AsyncStorage.setItem(key, raw);
  } catch (error) {
    if (!isNativeStorageUnavailable(error)) {
      throw error;
    }
  }
}

export async function removeJsonValue(key: string): Promise<void> {
  memoryStore.delete(key);

  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    if (!isNativeStorageUnavailable(error)) {
      throw error;
    }
  }
}

export function __resetJsonStorageForTests() {
  memoryStore.clear();
}

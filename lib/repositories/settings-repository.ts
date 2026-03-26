import { AppSettings, DEFAULT_APP_SETTINGS } from '@/lib/domain/session-models';
import { readJsonValue, writeJsonValue } from '@/lib/storage/json-storage';

const SETTINGS_STORAGE_KEY = 'judge-me-not.settings.json';

export async function getAppSettings(): Promise<AppSettings> {
  return readJsonValue<AppSettings>(SETTINGS_STORAGE_KEY, DEFAULT_APP_SETTINGS);
}

export async function saveAppSettings(nextSettings: AppSettings): Promise<AppSettings> {
  await writeJsonValue(SETTINGS_STORAGE_KEY, nextSettings);
  return nextSettings;
}

export async function patchAppSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getAppSettings();
  const merged = { ...current, ...patch };
  await writeJsonValue(SETTINGS_STORAGE_KEY, merged);
  return merged;
}

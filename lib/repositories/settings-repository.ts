import { AppSettings, DEFAULT_APP_SETTINGS, PromptSettings } from '@/lib/domain/session-models';
import { readJsonValue, writeJsonValue } from '@/lib/storage/json-storage';

const SETTINGS_STORAGE_KEY = 'judge-me-not.settings.json';

function withDefaults(input: Partial<AppSettings>): AppSettings {
  return {
    ...DEFAULT_APP_SETTINGS,
    ...input,
    promptSettings: {
      ...DEFAULT_APP_SETTINGS.promptSettings,
      ...input.promptSettings,
    },
  };
}

export async function getAppSettings(): Promise<AppSettings> {
  const settings = await readJsonValue<Partial<AppSettings>>(SETTINGS_STORAGE_KEY, DEFAULT_APP_SETTINGS);
  return withDefaults(settings);
}

export async function saveAppSettings(nextSettings: AppSettings): Promise<AppSettings> {
  const normalized = withDefaults(nextSettings);
  await writeJsonValue(SETTINGS_STORAGE_KEY, normalized);
  return normalized;
}

export async function patchAppSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getAppSettings();
  const merged = withDefaults({
    ...current,
    ...patch,
    promptSettings: {
      ...current.promptSettings,
      ...patch.promptSettings,
    },
  });
  await writeJsonValue(SETTINGS_STORAGE_KEY, merged);
  return merged;
}

export async function patchPromptSettings(patch: Partial<PromptSettings>): Promise<AppSettings> {
  const current = await getAppSettings();

  return patchAppSettings({
    promptSettings: {
      ...current.promptSettings,
      ...patch,
    },
  });
}

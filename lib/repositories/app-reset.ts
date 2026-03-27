import { clearApiKey } from '@/lib/settings-store';
import { removeJsonValue } from '@/lib/storage/json-storage';

const RESETTABLE_JSON_KEYS = [
  'judge-me-not.sessions.json',
  'judge-me-not.pending-evals.json',
  'judge-me-not.settings.json',
] as const;

export async function clearAllAppData(): Promise<void> {
  for (const key of RESETTABLE_JSON_KEYS) {
    await removeJsonValue(key);
  }

  await clearApiKey();
}

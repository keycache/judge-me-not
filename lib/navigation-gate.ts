import { hasValidApiKey } from '@/lib/api-key';

export type GateTarget = '/setup-api' | '/(tabs)' | 'loading';

export interface GateInput {
  hasHydrated: boolean;
  apiKey: string | null;
}

export function resolveGateTarget(input: GateInput): GateTarget {
  if (!input.hasHydrated) {
    return 'loading';
  }

  if (!hasValidApiKey(input.apiKey)) {
    return '/setup-api';
  }

  return '/(tabs)';
}

export function shouldRedirectToSetup(apiKey: string | null): boolean {
  return !hasValidApiKey(apiKey);
}

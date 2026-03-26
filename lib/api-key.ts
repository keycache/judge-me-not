export function hasValidApiKey(apiKey: string | null | undefined): boolean {
  return Boolean(apiKey && apiKey.trim().length > 0);
}

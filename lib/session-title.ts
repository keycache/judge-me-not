import { InputMode } from '@/lib/interview-rules';

export const MAX_SESSION_TITLE_CHARS = 60;

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

function stripWrappingQuotes(input: string): string {
  return input.replace(/^["'`]+|["'`]+$/g, '');
}

function trimToLength(input: string, maxChars: number): string {
  if (input.length <= maxChars) {
    return input;
  }

  const sliced = input.slice(0, maxChars - 1).trimEnd();
  return `${sliced}...`;
}

function titleCaseFromWords(input: string): string {
  return input
    .split(' ')
    .filter(Boolean)
    .slice(0, 10)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function normalizeSessionTitleCandidate(input: string | null | undefined): string | undefined {
  const normalized = stripWrappingQuotes(normalizeWhitespace(input ?? ''));
  if (!normalized) {
    return undefined;
  }

  return trimToLength(normalized, MAX_SESSION_TITLE_CHARS);
}

export function generateSessionOneLinerTitle(input: {
  mode: InputMode;
  sourceText: string;
  imageCount: number;
  fallback: string;
}): string {
  if (input.mode === 'image') {
    const base = input.imageCount > 0 ? `Image Interview Session (${input.imageCount} Images)` : 'Image Interview Session';
    return trimToLength(base, MAX_SESSION_TITLE_CHARS);
  }

  const normalized = normalizeWhitespace(input.sourceText);
  if (normalized.length === 0) {
    return trimToLength(input.fallback, MAX_SESSION_TITLE_CHARS);
  }

  const firstSentence = normalized.split(/[.!?]/)[0] || normalized;
  const titleCandidate = titleCaseFromWords(firstSentence);
  return trimToLength(titleCandidate || input.fallback, MAX_SESSION_TITLE_CHARS);
}

export function resolveSessionTitle(input: {
  proposedTitle?: string | null;
  mode: InputMode;
  sourceText: string;
  imageCount: number;
  fallback: string;
}): string {
  return (
    normalizeSessionTitleCandidate(input.proposedTitle) ??
    generateSessionOneLinerTitle({
      mode: input.mode,
      sourceText: input.sourceText,
      imageCount: input.imageCount,
      fallback: input.fallback,
    })
  );
}

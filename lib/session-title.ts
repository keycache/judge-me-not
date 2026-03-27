import { InputMode } from '@/lib/interview-rules';

const MAX_SESSION_TITLE_CHARS = 60;

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
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

// Placeholder one-liner title generator for Phase 5B.
// In Phase 5D this should be replaced by LLM-derived naming from generation output.
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

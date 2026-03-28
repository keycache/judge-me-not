export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type InputMode = 'text' | 'image';

export interface ImageInput {
  uri: string;
  fileSizeBytes: number;
  dedupeKey: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export const MAX_IMAGES = 5;
export const MAX_IMAGE_SIZE_BYTES = 6 * 1024 * 1024;
export const MAX_QUESTIONS_PER_BATCH = 30;

export function validateInputMode(mode: InputMode, text: string, images: ImageInput[]): ValidationResult {
  const hasText = text.trim().length > 0;
  const hasImages = images.length > 0;

  if (mode === 'text' && hasImages) {
    return { ok: false, errors: ['Image input is not allowed when text mode is selected.'] };
  }

  if (mode === 'image' && hasText) {
    return { ok: false, errors: ['Text input is not allowed when image mode is selected.'] };
  }

  if (mode === 'text' && !hasText) {
    return { ok: false, errors: ['Text description is required in text mode.'] };
  }

  if (mode === 'image' && !hasImages) {
    return { ok: false, errors: ['At least one image is required in image mode.'] };
  }

  return { ok: true, errors: [] };
}

export function validateImageSelection(images: ImageInput[]): ValidationResult {
  const errors: string[] = [];

  if (images.length === 0) {
    errors.push('At least one image is required.');
  }

  if (images.length > MAX_IMAGES) {
    errors.push(`A maximum of ${MAX_IMAGES} images can be uploaded.`);
  }

  for (const image of images) {
    if (image.fileSizeBytes > MAX_IMAGE_SIZE_BYTES) {
      errors.push(`Image ${image.uri} exceeds the 6MB size limit.`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function validateQuestionsPerBatch(count: number): ValidationResult {
  if (!Number.isInteger(count)) {
    return { ok: false, errors: ['Questions per batch must be an integer.'] };
  }

  if (count < 1) {
    return { ok: false, errors: ['Questions per batch must be at least 1.'] };
  }

  if (count > MAX_QUESTIONS_PER_BATCH) {
    return {
      ok: false,
      errors: [`Questions per batch cannot exceed ${MAX_QUESTIONS_PER_BATCH}.`],
    };
  }

  return { ok: true, errors: [] };
}

export function scoreOutOfTenToHundred(scoreOutOfTen: number): number {
  const clamped = Math.max(0, Math.min(10, scoreOutOfTen));
  return Math.round(clamped * 10);
}

function toSlugPart(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function formatTimestamp(timestamp: Date): string {
  const year = timestamp.getFullYear().toString();
  const month = String(timestamp.getMonth() + 1).padStart(2, '0');
  const day = String(timestamp.getDate()).padStart(2, '0');
  const hour = String(timestamp.getHours()).padStart(2, '0');
  const minute = String(timestamp.getMinutes()).padStart(2, '0');
  const second = String(timestamp.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hour}${minute}${second}`;
}

export function buildHumanFriendlySessionId(sessionNameFromModel: string, timestamp: Date = new Date()): string {
  const base = toSlugPart(sessionNameFromModel) || 'interview-session';
  return `${base}-${formatTimestamp(timestamp)}`;
}

import {
  buildHumanFriendlySessionId,
  MAX_IMAGE_SIZE_BYTES,
  MAX_IMAGES,
  scoreOutOfTenToHundred,
  validateImageSelection,
  validateInputMode,
  validateQuestionsPerBatch,
} from '../interview-rules';

describe('interview rules', () => {
  describe('validateInputMode', () => {
    it('accepts valid text mode payload', () => {
      const result = validateInputMode('text', 'Senior frontend role', []);
      expect(result.ok).toBe(true);
    });

    it('rejects text mode when images are also provided', () => {
      const result = validateInputMode('text', 'JD text', [{ uri: 'a.png', fileSizeBytes: 1024 }]);
      expect(result.ok).toBe(false);
      expect(result.errors[0]).toMatch(/not allowed/i);
    });

    it('accepts valid image mode payload', () => {
      const result = validateInputMode('image', '', [{ uri: 'a.png', fileSizeBytes: 1024 }]);
      expect(result.ok).toBe(true);
    });

    it('rejects image mode when text is also provided', () => {
      const result = validateInputMode('image', 'JD text', [{ uri: 'a.png', fileSizeBytes: 1024 }]);
      expect(result.ok).toBe(false);
      expect(result.errors[0]).toMatch(/text input is not allowed/i);
    });

    it('rejects text mode when description is empty', () => {
      const result = validateInputMode('text', '   ', []);
      expect(result.ok).toBe(false);
      expect(result.errors[0]).toMatch(/text description is required/i);
    });

    it('rejects image mode when no images are provided', () => {
      const result = validateInputMode('image', '', []);
      expect(result.ok).toBe(false);
      expect(result.errors[0]).toMatch(/at least one image is required/i);
    });
  });

  describe('validateImageSelection', () => {
    it('rejects empty image list', () => {
      const result = validateImageSelection([]);
      expect(result.ok).toBe(false);
      expect(result.errors.join(' ')).toMatch(/at least one image is required/i);
    });

    it('rejects more than max images', () => {
      const images = Array.from({ length: MAX_IMAGES + 1 }, (_, i) => ({
        uri: `img-${i}.png`,
        fileSizeBytes: 1000,
      }));
      const result = validateImageSelection(images);
      expect(result.ok).toBe(false);
      expect(result.errors.join(' ')).toMatch(/maximum of 5 images/i);
    });

    it('rejects image larger than 6MB', () => {
      const result = validateImageSelection([
        { uri: 'large.png', fileSizeBytes: MAX_IMAGE_SIZE_BYTES + 1 },
      ]);
      expect(result.ok).toBe(false);
      expect(result.errors.join(' ')).toMatch(/6MB size limit/i);
    });

    it('accepts valid image list', () => {
      const result = validateImageSelection([
        { uri: '1.png', fileSizeBytes: 1024 },
        { uri: '2.png', fileSizeBytes: 2048 },
      ]);
      expect(result.ok).toBe(true);
    });
  });

  describe('validateQuestionsPerBatch', () => {
    it('accepts a value in allowed range', () => {
      expect(validateQuestionsPerBatch(20).ok).toBe(true);
      expect(validateQuestionsPerBatch(30).ok).toBe(true);
    });

    it('rejects values above 30', () => {
      const result = validateQuestionsPerBatch(31);
      expect(result.ok).toBe(false);
      expect(result.errors[0]).toMatch(/cannot exceed 30/i);
    });

    it('rejects values below 1', () => {
      const result = validateQuestionsPerBatch(0);
      expect(result.ok).toBe(false);
      expect(result.errors[0]).toMatch(/at least 1/i);
    });

    it('rejects non-integer values', () => {
      const result = validateQuestionsPerBatch(2.5);
      expect(result.ok).toBe(false);
      expect(result.errors[0]).toMatch(/must be an integer/i);
    });
  });

  describe('scoreOutOfTenToHundred', () => {
    it('converts score correctly', () => {
      expect(scoreOutOfTenToHundred(8.4)).toBe(84);
    });

    it('clamps out of range values', () => {
      expect(scoreOutOfTenToHundred(11)).toBe(100);
      expect(scoreOutOfTenToHundred(-2)).toBe(0);
    });
  });

  describe('buildHumanFriendlySessionId', () => {
    it('creates slug + timestamp', () => {
      const fixed = new Date(2026, 2, 26, 14, 30, 45);
      const id = buildHumanFriendlySessionId('Senior Frontend Architect', fixed);
      expect(id).toBe('senior-frontend-architect-20260326-143045');
    });

    it('falls back to default name when model gives empty label', () => {
      const fixed = new Date(2026, 2, 26, 14, 30, 45);
      const id = buildHumanFriendlySessionId('   ', fixed);
      expect(id).toBe('interview-session-20260326-143045');
    });
  });
});

import { generateSessionOneLinerTitle } from '@/lib/session-title';

describe('session title generation', () => {
  it('creates a concise one-liner for text mode', () => {
    const title = generateSessionOneLinerTitle({
      mode: 'text',
      sourceText:
        'A modern minimalist app icon on a pure white background representing a private AI chat system for automotive use.',
      imageCount: 0,
      fallback: 'Interview Session',
    });

    expect(title.length).toBeLessThanOrEqual(60);
    expect(title).not.toMatch(/\n/);
  });

  it('uses fallback when text mode source is empty', () => {
    const title = generateSessionOneLinerTitle({
      mode: 'text',
      sourceText: '   ',
      imageCount: 0,
      fallback: 'Interview Session',
    });

    expect(title).toBe('Interview Session');
  });

  it('builds image-mode title with image count', () => {
    const title = generateSessionOneLinerTitle({
      mode: 'image',
      sourceText: '',
      imageCount: 3,
      fallback: 'Image Interview Session',
    });

    expect(title).toMatch(/3 Images/);
    expect(title.length).toBeLessThanOrEqual(60);
  });
});

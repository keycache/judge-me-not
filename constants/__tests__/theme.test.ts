import { AppTheme } from '../app-theme';

describe('theme tokens', () => {
  it('exposes expected dark design tokens', () => {
    expect(AppTheme.colors.background).toBeTruthy();
    expect(AppTheme.colors.surfacePrimary).toBeTruthy();
    expect(AppTheme.colors.borderStrong).toBeTruthy();
    expect(AppTheme.colors.textPrimary).toBeTruthy();
    expect(AppTheme.colors.accent).toBeTruthy();
  });

  it('exposes spacing and sharp corner tokens', () => {
    expect(AppTheme.spacing.md).toBeGreaterThan(0);
    expect(AppTheme.spacing.xl).toBeGreaterThan(AppTheme.spacing.md);
    expect(AppTheme.radius.none).toBe(0);
  });
});

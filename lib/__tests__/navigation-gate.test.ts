import { resolveGateTarget, shouldRedirectToSetup } from '../navigation-gate';

describe('navigation gate', () => {
  it('stays in loading until storage hydration is complete', () => {
    const target = resolveGateTarget({ hasHydrated: false, apiKey: null });
    expect(target).toBe('loading');
  });

  it('routes to setup when key is missing after hydration', () => {
    const target = resolveGateTarget({ hasHydrated: true, apiKey: null });
    expect(target).toBe('/setup-api');
  });

  it('routes to tabs when key is present', () => {
    const target = resolveGateTarget({ hasHydrated: true, apiKey: 'sk-test-123' });
    expect(target).toBe('/(tabs)');
  });

  it('marks blank strings as missing key', () => {
    expect(shouldRedirectToSetup('  ')).toBe(true);
  });
});

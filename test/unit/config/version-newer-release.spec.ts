import { bringsNewerBackend } from '../../../src/config/domain/services/version-newer-release';

const release = (backend: string | null) => ({ components: { backend } });

describe('Whether the latest release is news for this installation', () => {
  it('is news when it ships a newer backend', () => {
    expect(bringsNewerBackend(release('1.36.0'), '1.35.0')).toBe(true);
    expect(bringsNewerBackend(release('v1.35.10'), '1.35.9')).toBe(true);
  });

  it('is not news for an installation that already runs it, although the product number is higher', () => {
    // Product 1.38.0 is backend 1.35.0: comparing 1.38.0 with 1.35.0 told up-to-date installations to update
    expect(bringsNewerBackend(release('1.35.0'), '1.35.0')).toBe(false);
  });

  it('is not news for an installation ahead of it', () => {
    expect(bringsNewerBackend(release('1.35.0'), '1.36.0')).toBe(false);
  });

  it('says nothing when the release does not say its backend', () => {
    expect(bringsNewerBackend(release(null), '1.35.0')).toBe(false);
    expect(bringsNewerBackend(null, '1.35.0')).toBe(false);
  });
});

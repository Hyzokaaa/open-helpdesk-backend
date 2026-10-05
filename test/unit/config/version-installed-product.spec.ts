import { findInstalledProduct } from '../../../src/config/domain/services/version-installed-product';

const releases = [
  { product: '1.24.0', components: { backend: '1.21.0', client: '1.21.0' } },
  { product: '1.23.2', components: { backend: '1.20.10', client: '1.20.11' } },
  { product: '1.23.1', components: { backend: '1.20.10', client: '1.20.11' } },
  { product: '1.23.0', components: { backend: '1.20.9', client: '1.20.11' } },
];

describe('findInstalledProduct', () => {
  it('finds the product whose components match the installed ones', () => {
    expect(findInstalledProduct(releases, '1.21.0', '1.21.0')).toBe('1.24.0');
  });

  it('picks the newest product when several ship the same components', () => {
    expect(findInstalledProduct(releases, '1.20.10', '1.20.11')).toBe('1.23.2');
  });

  it('returns null for components that no release ships together', () => {
    expect(findInstalledProduct(releases, '1.21.0', '1.20.11')).toBeNull();
    expect(findInstalledProduct(releases, '1.22.0', '1.22.0')).toBeNull();
  });

  it('returns null when the client version is unknown', () => {
    expect(findInstalledProduct(releases, '1.21.0', null)).toBeNull();
  });

  it('recognises the latest release while the manifest has not caught up with it yet', () => {
    const latest = { product: '1.25.0', components: { backend: '1.22.0', client: '1.22.0' } };
    expect(findInstalledProduct(releases, '1.22.0', '1.22.0', latest)).toBe('1.25.0');
    expect(findInstalledProduct(releases, '1.22.0', '1.21.0', latest)).toBeNull();
  });
});

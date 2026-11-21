import { PrivateNetworkUrlError, ensurePublicUrl, isPrivateAddress, privateNetworkUrlsAllowed } from '../../../src/shared/infrastructure/private-network';

describe('Private network addresses', () => {
  it.each([
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.10', '169.254.169.254',
    '100.64.0.1', '0.0.0.0', '::1', '::', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', 'not-an-ip',
  ])('%s is private', (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each(['8.8.8.8', '172.32.0.1', '1.1.1.1', '2606:4700:4700::1111', '::ffff:8.8.8.8'])('%s is public', (address) => {
    expect(isPrivateAddress(address)).toBe(false);
  });

  it('refuses a host that resolves to a private address, even next to a public one', async () => {
    const resolve = async () => ['93.184.216.34', '10.0.0.5'];
    await expect(ensurePublicUrl('https://matrix.example.org', resolve)).rejects.toBeInstanceOf(PrivateNetworkUrlError);
  });

  it('refuses private IPs typed directly and hosts that do not resolve', async () => {
    await expect(ensurePublicUrl('http://169.254.169.254/latest', async () => [])).rejects.toBeInstanceOf(PrivateNetworkUrlError);
    await expect(ensurePublicUrl('http://[::1]:8008', async () => [])).rejects.toBeInstanceOf(PrivateNetworkUrlError);
    await expect(ensurePublicUrl('https://nowhere.invalid', async () => [])).rejects.toBeInstanceOf(PrivateNetworkUrlError);
  });

  it('lets a public server through', async () => {
    await expect(ensurePublicUrl('https://matrix.example.org', async () => ['93.184.216.34'])).resolves.toBeUndefined();
  });

  it('allows private servers unless ALLOW_PRIVATE_NETWORK_URLS=false', () => {
    expect(privateNetworkUrlsAllowed({})).toBe(true);
    expect(privateNetworkUrlsAllowed({ ALLOW_PRIVATE_NETWORK_URLS: 'true' })).toBe(true);
    expect(privateNetworkUrlsAllowed({ ALLOW_PRIVATE_NETWORK_URLS: 'false' })).toBe(false);
    expect(privateNetworkUrlsAllowed({ ALLOW_PRIVATE_NETWORK_URLS: ' FALSE ' })).toBe(false);
  });
});
